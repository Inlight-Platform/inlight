-- Support creating scoped group admins before their Inlight account exists.

create or replace function public.claim_pending_group_admins_for_user(_user_id uuid default auth.uid())
returns integer
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  normalized_email text;
  claimed_count integer := 0;
begin
  if _user_id is null then
    return 0;
  end if;

  select lower(email)
    into normalized_email
    from auth.users
   where id = _user_id;

  if normalized_email is null or normalized_email = '' then
    return 0;
  end if;

  update public.group_admins
     set user_id = _user_id,
         email = normalized_email,
         status = 'active',
         updated_at = now()
   where lower(email) = normalized_email
     and status = 'pending'
     and (user_id is null or user_id = _user_id);

  get diagnostics claimed_count = row_count;
  return claimed_count;
end;
$function$;

grant execute on function public.claim_pending_group_admins_for_user(uuid) to authenticated;

-- Existing email-only active rows were effectively pending until the account existed.
update public.group_admins
   set status = 'pending',
       updated_at = now()
 where user_id is null
   and status = 'active';

select public.claim_pending_group_admins_for_user(u.id)
  from auth.users u
 where exists (
   select 1
     from public.group_admins ga
    where ga.status = 'pending'
      and lower(ga.email) = lower(u.email)
 );

create or replace function public.accept_platform_invite_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  update public.platform_invites
     set accepted_at = coalesce(accepted_at, now()),
         accepted_by = coalesce(accepted_by, new.id)
   where lower(email) = lower(coalesce(new.email, ''))
     and accepted_at is null;

  perform public.claim_pending_group_admins_for_user(new.id);

  return new;
end;
$function$;

create or replace function public.claim_invites_on_signup(
  _credit_token text default null,
  _platform_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  platform_claimed boolean := false;
  credit_claim_result jsonb := jsonb_build_object('claimed', false);
  platform_rows integer := 0;
  group_admin_rows integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if nullif(btrim(_platform_token), '') is not null then
    update public.platform_invites pi
       set accepted_at = coalesce(pi.accepted_at, now()),
           accepted_by = coalesce(pi.accepted_by, auth.uid())
     where pi.token = btrim(_platform_token)
       and lower(pi.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
       and pi.accepted_at is null;

    get diagnostics platform_rows = row_count;
    platform_claimed := platform_rows > 0;
  end if;

  group_admin_rows := public.claim_pending_group_admins_for_user(auth.uid());

  if nullif(btrim(_credit_token), '') is not null then
    credit_claim_result := public.accept_project_credit_invite(_credit_token);
  end if;

  return jsonb_build_object(
    'platform_invite_claimed', platform_claimed,
    'credit_invite_claimed', coalesce((credit_claim_result ->> 'claimed')::boolean, false),
    'credit_invite', credit_claim_result,
    'group_admin_invites_claimed', group_admin_rows
  );
end;
$function$;

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
as $function$
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
  values (
    new_group.id,
    target_user_id,
    normalized_email,
    case when target_user_id is null then 'pending' else 'active' end,
    'admin',
    auth.uid()
  )
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
$function$;

create or replace function public.add_group_admin_by_email(_group_id uuid, _email text)
returns public.group_admins
language plpgsql
security definer
set search_path = public
as $function$
declare
  normalized_email text := lower(trim(_email));
  target_user_id uuid;
  admin_row public.group_admins%rowtype;
  target_status text;
begin
  if auth.uid() is null or not public.is_group_faculty(auth.uid(), _group_id) then
    raise exception 'Not authorized to manage group admins';
  end if;

  if normalized_email is null or normalized_email = '' or normalized_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address';
  end if;

  select id into target_user_id
  from auth.users
  where lower(email) = normalized_email
  order by created_at desc
  limit 1;

  target_status := case when target_user_id is null then 'pending' else 'active' end;

  select * into admin_row
  from public.group_admins
  where group_id = _group_id
    and lower(email) = normalized_email
  limit 1;

  if admin_row.id is not null then
    update public.group_admins
       set user_id = coalesce(target_user_id, user_id),
           email = normalized_email,
           status = case when coalesce(target_user_id, user_id) is null then 'pending' else 'active' end,
           updated_at = now()
     where id = admin_row.id
     returning * into admin_row;
    return admin_row;
  end if;

  if target_user_id is not null then
    select * into admin_row
    from public.group_admins
    where group_id = _group_id
      and user_id = target_user_id
    limit 1;

    if admin_row.id is not null then
      update public.group_admins
         set email = normalized_email,
             status = 'active',
             updated_at = now()
       where id = admin_row.id
       returning * into admin_row;
      return admin_row;
    end if;
  end if;

  insert into public.group_admins (group_id, user_id, email, status, role, invited_by)
  values (_group_id, target_user_id, normalized_email, target_status, 'admin', auth.uid())
  returning * into admin_row;

  return admin_row;
end;
$function$;

notify pgrst, 'reload schema';
