-- Group-admin access requires the token for the individual assignment.
create table public.group_admin_invites (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.group_admins(id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(32), 'hex'),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  claimed_by uuid references auth.users(id),
  check ((claimed_at is null) = (claimed_by is null))
);
create unique index group_admin_invites_pending_assignment_key
  on public.group_admin_invites(admin_id) where claimed_at is null;
alter table public.group_admin_invites enable row level security;
revoke all on public.group_admin_invites from public, anon, authenticated;
grant all on public.group_admin_invites to service_role;

insert into public.group_admin_invites (admin_id)
select id from public.group_admins where status = 'pending';

create or replace function public.add_group_admin_by_email(_group_id uuid, _email text)
returns public.group_admins language plpgsql security definer set search_path = public, auth
as $function$
declare
  normalized_email text := lower(btrim(coalesce(_email, '')));
  target_user uuid;
  admin_row public.group_admins%rowtype;
begin
  if auth.uid() is null or not public.is_group_faculty(auth.uid(), _group_id) then
    raise exception 'Not authorized to manage group admins';
  end if;
  if normalized_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid email address';
  end if;
  perform 1 from public.groups where id = _group_id for update;
  if not found then raise exception 'Group not found'; end if;

  select id into target_user from auth.users where lower(btrim(email)) = normalized_email
    order by created_at desc limit 1;
  select * into admin_row from public.group_admins
   where group_id = _group_id and (lower(btrim(email)) = normalized_email
      or (target_user is not null and user_id = target_user))
   order by (lower(btrim(email)) = normalized_email) desc nulls last limit 1 for update;
  if found then
    if admin_row.status = 'active' then return admin_row; end if;
    if (admin_row.user_id is not null and admin_row.user_id is distinct from target_user)
       or (admin_row.email is not null and lower(btrim(admin_row.email)) <> normalized_email) then
      raise exception 'Existing pending admin identity conflicts with this email';
    end if;
  else
    insert into public.group_admins (group_id, user_id, email, status, role, invited_by)
    values (_group_id, null, normalized_email, 'pending', 'admin', auth.uid())
    returning * into admin_row;
  end if;
  insert into public.group_admin_invites (admin_id) values (admin_row.id)
    on conflict (admin_id) where claimed_at is null do nothing;
  return admin_row;
end;
$function$;

create or replace function public.create_group_admin_invite(_group_id uuid, _email text, _note text default null)
returns jsonb language plpgsql security definer set search_path = public, auth
as $function$
declare
  normalized_email text := lower(btrim(coalesce(_email, '')));
  normalized_note text := nullif(btrim(coalesce(_note, '')), '');
  admin_row public.group_admins%rowtype;
  group_row public.groups%rowtype;
  invite_row public.group_admin_invites%rowtype;
  account_exists boolean;
begin
  if auth.uid() is null or not (public.has_role(auth.uid(), 'admin'::public.app_role)
      or public.is_scoped_group_admin(auth.uid(), _group_id)) then
    raise exception 'Not authorized to manage group admins';
  end if;
  select * into group_row from public.groups where id = _group_id;
  if group_row.id is null then raise exception 'Group not found'; end if;
  admin_row := public.add_group_admin_by_email(_group_id, normalized_email);
  if admin_row.status = 'active' then
    return jsonb_build_object('admin_id', admin_row.id, 'email', admin_row.email,
      'status', 'active', 'outcome', 'already_active', 'existing_user', true,
      'account_exists', true, 'group_name', group_row.name, 'group_slug', group_row.slug);
  end if;
  select * into invite_row from public.group_admin_invites
    where admin_id = admin_row.id and claimed_at is null;
  select exists(select 1 from auth.users where lower(btrim(email)) = normalized_email) into account_exists;
  -- Preserve the existing independent platform signup eligibility mechanism.
  insert into public.platform_invites (email, inviter_id, personal_note)
    values (normalized_email, auth.uid(), normalized_note)
    on conflict (lower(email)) where accepted_at is null do nothing;
  return jsonb_build_object('admin_id', admin_row.id, 'email', normalized_email,
    'status', 'pending', 'existing_user', false, 'account_exists', account_exists,
    'token', invite_row.token, 'group_name', group_row.name, 'group_slug', group_row.slug);
end;
$function$;

create or replace function public.claim_pending_group_admins_for_user(_user_id uuid default auth.uid())
returns integer language sql security definer set search_path = public, auth
as $function$ select 0 $function$;
revoke all on function public.claim_pending_group_admins_for_user(uuid) from public, anon, authenticated, service_role;

create or replace function public.claim_invites_on_signup(_credit_token text default null, _platform_token text default null)
returns jsonb language plpgsql security definer set search_path = public, auth
as $function$
declare
  caller_id uuid := auth.uid();
  caller_email text;
  confirmed boolean;
  invite_row public.group_admin_invites%rowtype;
  admin_row public.group_admins%rowtype;
  invite_admin_id uuid;
  violated_constraint text;
  claim_status text := 'not_found';
  platform_claimed boolean := false;
  platform_rows integer := 0;
  member_rows integer := 0;
  credit_result jsonb := jsonb_build_object('claimed', false);
begin
  if caller_id is null then raise exception 'Not authenticated'; end if;
  select lower(btrim(email)), email_confirmed_at is not null into caller_email, confirmed
    from auth.users where id = caller_id;
  if nullif(btrim(_platform_token), '') is not null then
    -- Discover the assignment without locking the child; deletion locks the
    -- assignment before cascading to its invitation.
    select admin_id into invite_admin_id from public.group_admin_invites where token = btrim(_platform_token);
    if found then
      select * into admin_row from public.group_admins where id = invite_admin_id for update;
      select * into invite_row from public.group_admin_invites
        where token = btrim(_platform_token) and admin_id = invite_admin_id for update;
      if not found or admin_row.id is null then
        claim_status := 'unavailable';
      elsif confirmed is not true then
        claim_status := 'unconfirmed';
      elsif caller_email is null or coalesce(nullif(lower(btrim(admin_row.email)), ''),
          (select lower(btrim(u.email)) from auth.users u where u.id = admin_row.user_id)) is distinct from caller_email
         or (admin_row.user_id is not null and admin_row.user_id <> caller_id) then
        claim_status := 'not_matching';
      elsif invite_row.claimed_at is not null then
        claim_status := case when invite_row.claimed_by = caller_id then 'already_claimed' else 'not_matching' end;
      elsif admin_row.status <> 'pending' then
        claim_status := 'unavailable';
      elsif exists (select 1 from public.group_admins other
        where other.group_id = admin_row.group_id and other.user_id = caller_id and other.id <> admin_row.id) then
        claim_status := 'assignment_conflict';
      else
        begin
          update public.group_admins set user_id = caller_id, status = 'active', updated_at = now()
            where id = admin_row.id and status = 'pending';
          update public.group_admin_invites set claimed_at = now(), claimed_by = caller_id where id = invite_row.id;
          claim_status := 'claimed';
        exception when unique_violation then
          get stacked diagnostics violated_constraint = constraint_name;
          if violated_constraint = 'group_admins_group_user_key' then
            claim_status := 'assignment_conflict';
          else
            raise;
          end if;
        end;
      end if;
    else
      update public.platform_invites pi set accepted_at = coalesce(pi.accepted_at, now()),
        accepted_by = coalesce(pi.accepted_by, caller_id)
      where pi.token = btrim(_platform_token)
        and lower(pi.email) = lower(coalesce(auth.jwt() ->> 'email', '')) and pi.accepted_at is null;
      get diagnostics platform_rows = row_count;
      platform_claimed := platform_rows > 0;
    end if;
  end if;
  member_rows := public.claim_group_member_invites_for_user(caller_id);
  if nullif(btrim(_credit_token), '') is not null then
    credit_result := public.accept_project_credit_invite(_credit_token);
  end if;
  return jsonb_build_object('platform_invite_claimed', platform_claimed,
    'credit_invite_claimed', coalesce((credit_result ->> 'claimed')::boolean, false),
    'credit_invite', credit_result, 'group_admin_invite_status', claim_status,
    'group_admin_invites_claimed', case when claim_status = 'claimed' then 1 else 0 end,
    'group_member_invites_claimed', member_rows);
end;
$function$;

create or replace function public.accept_platform_invite_on_signup()
returns trigger language plpgsql security definer set search_path = public
as $function$
begin
  update public.platform_invites set accepted_at = coalesce(accepted_at, now()),
    accepted_by = coalesce(accepted_by, new.id)
  where lower(email) = lower(coalesce(new.email, '')) and accepted_at is null;
  if new.email_confirmed_at is not null then
    perform public.claim_group_member_invites_for_user(new.id);
  end if;
  return new;
end;
$function$;

create or replace function public.handle_user_email_confirmed()
returns trigger language plpgsql security definer set search_path = public
as $function$
declare safe_display_name text;
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    safe_display_name := coalesce(trim(substring(new.raw_user_meta_data->>'display_name' from 1 for 100)), split_part(new.email, '@', 1));
    if length(safe_display_name) = 0 then safe_display_name := split_part(new.email, '@', 1); end if;
    insert into public.profiles (user_id, email, display_name) values (new.id, new.email, safe_display_name)
      on conflict (user_id) do nothing;
    perform public.claim_group_member_invites_for_user(new.id);
  end if;
  return new;
end;
$function$;

create or replace function public.admin_create_group(
  _name text, _slug text, _description text default null, _initial_admin_email text default null
) returns jsonb language plpgsql security definer set search_path = public, auth
as $function$
declare
  result jsonb;
  group_row public.groups%rowtype;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin'::public.app_role) then raise exception 'Admin only'; end if;
  if btrim(coalesce(_initial_admin_email, '')) = '' then raise exception 'Initial admin email is required'; end if;
  result := public.admin_create_group_with_admins(_name, _slug, _description, array[_initial_admin_email]);
  select * into group_row from public.groups where id = (result->'group'->>'id')::uuid;
  return jsonb_build_object('id', group_row.id, 'slug', group_row.slug, 'name', group_row.name,
    'description', group_row.description, 'created_at', group_row.created_at, 'updated_at', group_row.updated_at);
end;
$function$;

notify pgrst, 'reload schema';
