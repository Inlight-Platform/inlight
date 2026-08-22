create or replace function public.admin_list_groups()
returns table(
  id uuid,
  slug text,
  name text,
  description text,
  created_at timestamptz,
  updated_at timestamptz,
  active_member_count bigint,
  active_admin_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    g.id,
    g.slug,
    g.name,
    g.description,
    g.created_at,
    g.updated_at,
    count(distinct gm.id) filter (where gm.status = 'active') as active_member_count,
    count(distinct ga.id) filter (where ga.status = 'active') as active_admin_count
  from public.groups g
  left join public.group_members gm on gm.group_id = g.id
  left join public.group_admins ga on ga.group_id = g.id
  where public.has_role(auth.uid(), 'admin'::public.app_role)
  group by g.id, g.slug, g.name, g.description, g.created_at, g.updated_at
  order by g.created_at desc;
$$;

create or replace function public.admin_create_group(
  _name text,
  _slug text,
  _description text default null,
  _initial_admin_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_name text := trim(coalesce(_name, ''));
  normalized_slug text := lower(trim(coalesce(_slug, '')));
  normalized_description text := nullif(trim(coalesce(_description, '')), '');
  normalized_email text := lower(trim(coalesce(_initial_admin_email, '')));
  target_user_id uuid;
  new_group public.groups%rowtype;
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Admin only';
  end if;

  if normalized_name = '' then
    raise exception 'Group name is required';
  end if;

  if normalized_slug = '' then
    raise exception 'Group slug is required';
  end if;

  if normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Group slug can only use lowercase letters, numbers, and hyphens';
  end if;

  if normalized_email = '' then
    raise exception 'Initial admin email is required';
  end if;

  if normalized_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' then
    raise exception 'Initial admin email is invalid';
  end if;

  select id into target_user_id
  from auth.users
  where lower(email) = normalized_email
  limit 1;

  insert into public.groups (name, slug, description, faculty_owner_id)
  values (normalized_name, normalized_slug, normalized_description, target_user_id)
  returning * into new_group;

  insert into public.group_admins (group_id, user_id, email, status, role, invited_by)
  values (new_group.id, target_user_id, normalized_email, 'active', 'admin', auth.uid())
  on conflict do nothing;

  return jsonb_build_object(
    'id', new_group.id,
    'slug', new_group.slug,
    'name', new_group.name,
    'description', new_group.description,
    'created_at', new_group.created_at,
    'updated_at', new_group.updated_at
  );
end;
$$;

create or replace function public.admin_update_group(
  _group_id uuid,
  _name text,
  _slug text,
  _description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_name text := trim(coalesce(_name, ''));
  normalized_slug text := lower(trim(coalesce(_slug, '')));
  normalized_description text := nullif(trim(coalesce(_description, '')), '');
  updated_group public.groups%rowtype;
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Admin only';
  end if;

  if _group_id is null then
    raise exception 'Group is required';
  end if;

  if normalized_name = '' then
    raise exception 'Group name is required';
  end if;

  if normalized_slug = '' then
    raise exception 'Group slug is required';
  end if;

  if normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Group slug can only use lowercase letters, numbers, and hyphens';
  end if;

  update public.groups
     set name = normalized_name,
         slug = normalized_slug,
         description = normalized_description
   where id = _group_id
   returning * into updated_group;

  if updated_group.id is null then
    raise exception 'Group not found';
  end if;

  return jsonb_build_object(
    'id', updated_group.id,
    'slug', updated_group.slug,
    'name', updated_group.name,
    'description', updated_group.description,
    'created_at', updated_group.created_at,
    'updated_at', updated_group.updated_at
  );
end;
$$;

grant execute on function public.admin_list_groups() to authenticated;
grant execute on function public.admin_create_group(text, text, text, text) to authenticated;
grant execute on function public.admin_update_group(uuid, text, text, text) to authenticated;

notify pgrst, 'reload schema';
