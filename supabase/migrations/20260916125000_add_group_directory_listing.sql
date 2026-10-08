-- Keep department discoverability separate from private-content access.

alter table public.groups
  add column if not exists is_listed boolean not null default true;

drop policy if exists "Groups readable by everyone" on public.groups;
drop policy if exists "Groups visible by directory or membership" on public.groups;
create policy "Groups visible by directory or membership"
on public.groups
for select
using (
  is_listed
  or public.is_group_member(auth.uid(), id)
  or public.is_scoped_group_admin(auth.uid(), id)
  or public.has_role(auth.uid(), 'admin'::public.app_role)
);

create or replace function public.update_group_directory_listing(
  _group_id uuid,
  _is_listed boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null or not public.is_scoped_group_admin(auth.uid(), _group_id) then
    raise exception 'Only group admins can update directory listing';
  end if;

  update public.groups
  set is_listed = coalesce(_is_listed, true),
      updated_at = now()
  where id = _group_id;

  if not found then
    raise exception 'Group not found';
  end if;

  return coalesce(_is_listed, true);
end;
$function$;

revoke all on function public.update_group_directory_listing(uuid, boolean) from public;
grant execute on function public.update_group_directory_listing(uuid, boolean) to authenticated;

create or replace function public.request_group_membership(_group_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  requester_id uuid := auth.uid();
  membership_id uuid;
  membership_status text;
  group_name text;
  group_slug text;
  group_is_listed boolean;
  requester_name text;
begin
  if requester_id is null then
    raise exception 'Authentication required';
  end if;

  select g.name, g.slug, g.is_listed
    into group_name, group_slug, group_is_listed
    from public.groups g
   where g.id = _group_id;

  if group_slug is null then
    raise exception 'Group not found';
  end if;

  select gm.id, gm.status
    into membership_id, membership_status
    from public.group_members gm
   where gm.group_id = _group_id
     and gm.user_id = requester_id;

  if membership_status = 'active' then
    raise exception 'You are already an active member';
  end if;

  if membership_status = 'pending' then
    return membership_id;
  end if;

  if not group_is_listed then
    raise exception 'This department is not accepting directory requests';
  end if;

  insert into public.group_members (group_id, user_id, status)
  values (_group_id, requester_id, 'pending')
  returning id into membership_id;

  select coalesce(nullif(btrim(p.display_name), ''), 'Someone')
    into requester_name
    from public.profiles_public p
   where p.user_id = requester_id;

  requester_name := coalesce(requester_name, 'Someone');

  insert into public.notifications (user_id, type, title, body, data)
  select
    admin_users.user_id,
    'group_join_request',
    'New request to join ' || group_name,
    requester_name || ' requested to join ' || group_name || '.',
    jsonb_build_object(
      'group_id', _group_id,
      'group_slug', group_slug,
      'membership_id', membership_id,
      'requester_id', requester_id
    )
  from (
    select ga.user_id
      from public.group_admins ga
     where ga.group_id = _group_id
       and ga.status = 'active'
       and ga.user_id is not null
    union
    select g.faculty_owner_id
      from public.groups g
     where g.id = _group_id
       and g.faculty_owner_id is not null
  ) admin_users
  where admin_users.user_id <> requester_id;

  return membership_id;
end;
$function$;

notify pgrst, 'reload schema';
