-- Requires groups.is_listed and the existing group membership helpers.
-- Readiness is independent of the saved listing preference and legacy ownership.
create or replace function public.group_has_confirmed_active_admin(_group_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public, auth
as $function$
  select exists (
    select 1 from public.group_admins ga
    join auth.users u on (
      (ga.user_id is not null and u.id = ga.user_id) or
      (ga.user_id is null and ga.email is not null and lower(u.email) = lower(ga.email))
    )
    where ga.group_id = _group_id and ga.status = 'active'
      and u.email_confirmed_at is not null
  );
$function$;
revoke all on function public.group_has_confirmed_active_admin(uuid) from public, anon, authenticated, service_role;

-- Policy functions run as the migration owner. Reject an owner unable to read
-- through RLS, or existing scoped helpers owned by a different role.
do $preflight$
declare
  relation_name text;
  helper_oid regprocedure;
begin
  if not has_schema_privilege(current_user, 'public', 'USAGE')
     or not has_schema_privilege(current_user, 'auth', 'USAGE')
     or not has_schema_privilege(current_user, 'private', 'USAGE') then
    raise exception 'Readiness owner lacks required schema usage';
  end if;
  foreach relation_name in array array['public.groups','public.group_admins','public.group_members','auth.users'] loop
    if not has_table_privilege(current_user, relation_name, 'SELECT')
       or row_security_active(relation_name::regclass) then
      raise exception 'Readiness owner needs SELECT and effective RLS bypass on %', relation_name;
    end if;
  end loop;
  foreach helper_oid in array array[
    'public.is_group_member(uuid,uuid)'::regprocedure,
    'public.is_scoped_group_admin(uuid,uuid)'::regprocedure
  ] loop
    if not exists (select 1 from pg_catalog.pg_proc p where p.oid = helper_oid and p.proowner = (select oid from pg_catalog.pg_roles where rolname = current_user) and p.prosecdef)
       or not has_function_privilege(current_user, helper_oid, 'EXECUTE') then
      raise exception 'Readiness requires same-owner security-definer access helper %', helper_oid;
    end if;
  end loop;
  if not has_function_privilege(current_user, 'auth.uid()', 'EXECUTE')
     or not has_function_privilege(current_user, 'public.has_role(uuid,public.app_role)', 'EXECUTE')
     or not has_function_privilege(current_user, 'private.has_role(uuid,public.app_role)', 'EXECUTE') then
    raise exception 'Readiness owner lacks required identity or role helper execution';
  end if;
end;
$preflight$;

-- Safe to call for an arbitrary group: unlisted groups always return false.
create or replace function public.group_is_discoverable(_group_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public, auth
as $function$
  select exists (select 1 from public.groups g where g.id = _group_id
    and g.is_listed and public.group_has_confirmed_active_admin(g.id));
$function$;
revoke all on function public.group_is_discoverable(uuid) from public, anon, authenticated, service_role;
grant execute on function public.group_is_discoverable(uuid) to anon, authenticated, service_role;

-- Caller identity comes only from auth.uid(); never accept a caller-supplied user.
create or replace function public.group_visible_to_caller(_group_id uuid)
returns boolean language plpgsql stable security definer set search_path = pg_catalog, public, auth
as $function$
declare
  caller uuid := auth.uid();
begin
  if public.group_is_discoverable(_group_id) then return true; end if;
  if caller is null then return false; end if;
  return public.is_group_member(caller, _group_id)
    or public.is_scoped_group_admin(caller, _group_id)
    or (exists (select 1 from public.groups g where g.id = _group_id)
        and public.has_role(caller, 'admin'::public.app_role));
end;
$function$;
revoke all on function public.group_visible_to_caller(uuid) from public, anon, authenticated, service_role;
grant execute on function public.group_visible_to_caller(uuid) to anon, authenticated, service_role;

-- Restrictive policies also constrain any other permissive policies already present.
drop policy if exists "Group discovery readiness" on public.groups;
create policy "Group discovery readiness" on public.groups as restrictive for select
using (public.group_visible_to_caller(id));

drop policy if exists "Users can request to join" on public.group_members;
drop policy if exists "Self request readiness" on public.group_members;
create policy "Self request readiness" on public.group_members as restrictive for insert
with check (
  user_id is distinct from auth.uid() or status <> 'pending'
  or public.group_is_discoverable(group_id)
);

create or replace function public.get_discoverable_groups()
returns table(id uuid, slug text, name text, description text)
language sql stable security definer set search_path = pg_catalog, public, auth
as $function$
  select g.id, g.slug, g.name, g.description from public.groups g
  where g.is_listed and public.group_has_confirmed_active_admin(g.id)
  order by g.name, g.id;
$function$;
revoke all on function public.get_discoverable_groups() from public;
grant execute on function public.get_discoverable_groups() to anon, authenticated, service_role;

create or replace function public.request_group_membership(_group_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
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
   where g.id = _group_id
   for update;

  if group_slug is null then
    raise exception using errcode = 'P0001', message = 'This department is not accepting join requests';
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

  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Join requests require READ COMMITTED transaction isolation';
  end if;

  if not group_is_listed then
    raise exception using errcode = 'P0001', message = 'This department is not accepting join requests';
  end if;

  if not public.group_has_confirmed_active_admin(_group_id) then
    raise exception using errcode = 'P0001', message = 'This department is not accepting join requests';
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

revoke all on function public.request_group_membership(uuid) from public, anon;
grant execute on function public.request_group_membership(uuid) to authenticated;

-- CREATE OR REPLACE preserves an existing owner and role memberships can
-- confer EXECUTE indirectly. Fail rather than silently weakening isolation.
do $postflight$
declare
  helper_oid regprocedure;
begin
  foreach helper_oid in array array[
    'public.group_has_confirmed_active_admin(uuid)'::regprocedure,
    'public.group_is_discoverable(uuid)'::regprocedure,
    'public.group_visible_to_caller(uuid)'::regprocedure,
    'public.get_discoverable_groups()'::regprocedure,
    'public.request_group_membership(uuid)'::regprocedure
  ] loop
    if not exists (select 1 from pg_catalog.pg_proc p where p.oid = helper_oid
      and p.proowner = (select oid from pg_catalog.pg_roles where rolname = current_user)
      and p.prosecdef) then
      raise exception 'Readiness function must be owned by migration owner: %', helper_oid;
    end if;
  end loop;
  if has_function_privilege('anon', 'public.group_has_confirmed_active_admin(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.group_has_confirmed_active_admin(uuid)', 'EXECUTE') then
    raise exception 'Client roles must not inherit raw readiness execution';
  end if;
end;
$postflight$;
notify pgrst, 'reload schema';
