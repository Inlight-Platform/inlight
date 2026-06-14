-- Let selected Inlight accounts invite non-.edu users to create accounts.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.platform_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  inviter_id uuid not null,
  token text not null default encode(gen_random_bytes(24), 'hex'),
  personal_note text,
  accepted_at timestamptz,
  accepted_by uuid,
  created_at timestamptz not null default now()
);

create unique index if not exists platform_invites_token_key
  on public.platform_invites (token);

create unique index if not exists platform_invites_pending_email_key
  on public.platform_invites (lower(email))
  where accepted_at is null;

alter table public.platform_invites enable row level security;

drop policy if exists "Platform inviters can view their invites" on public.platform_invites;
create policy "Platform inviters can view their invites"
on public.platform_invites
for select
to authenticated
using (
  inviter_id = auth.uid()
  or public.has_role(auth.uid(), 'admin'::public.app_role)
);

create or replace function public.is_platform_inviter(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select public.has_role(_user_id, 'admin'::public.app_role)
$function$;

create or replace function public.is_signup_email_allowed(_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    lower(coalesce(_email, '')) ~ '^[^@]+@[^@]+\.edu$'
    or lower(coalesce(_email, '')) in (
      'info@inlight.social',
      'alabfestival@gmail.com',
      'clelyfdes@gmail.com',
      'clelyfernandes19@gmail.com',
      'baileymadison941@gmail.com'
    )
    or exists (
      select 1
      from public.platform_invites pi
      where lower(pi.email) = lower(btrim(coalesce(_email, '')))
        and pi.accepted_at is null
    )
$function$;

create or replace function public.create_platform_invite(_email text, _note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  normalized_email text := lower(btrim(coalesce(_email, '')));
  invite_row public.platform_invites%rowtype;
begin
  if auth.uid() is null or not public.is_platform_inviter(auth.uid()) then
    raise exception 'Not authorized to create platform invites';
  end if;

  if normalized_email = '' or normalized_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address';
  end if;

  select *
    into invite_row
    from public.platform_invites
   where lower(email) = normalized_email
     and accepted_at is null
   limit 1;

  if found then
    update public.platform_invites
       set personal_note = nullif(btrim(_note), '')
     where id = invite_row.id
     returning * into invite_row;
  else
    insert into public.platform_invites (email, inviter_id, personal_note)
    values (normalized_email, auth.uid(), nullif(btrim(_note), ''))
    returning * into invite_row;
  end if;

  return jsonb_build_object(
    'id', invite_row.id,
    'email', invite_row.email,
    'token', invite_row.token,
    'created_at', invite_row.created_at,
    'accepted_at', invite_row.accepted_at
  );
end;
$function$;

create or replace function public.enforce_signup_email_policy()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  normalized_email text := lower(coalesce(new.email, ''));
begin
  if normalized_email = '' then
    return new;
  end if;

  if public.is_signup_email_allowed(normalized_email) then
    return new;
  end if;

  raise exception 'Only university .edu email addresses or invited emails are allowed to sign up.';
end;
$function$;

drop trigger if exists enforce_signup_email_policy_on_auth_users on auth.users;
create trigger enforce_signup_email_policy_on_auth_users
before insert on auth.users
for each row
execute function public.enforce_signup_email_policy();

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

  return new;
end;
$function$;

drop trigger if exists accept_platform_invite_on_signup on auth.users;
create trigger accept_platform_invite_on_signup
after insert on auth.users
for each row
execute function public.accept_platform_invite_on_signup();

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
  platform_rows integer := 0;
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

  return jsonb_build_object(
    'platform_invite_claimed', platform_claimed,
    'credit_invite_claimed', false
  );
end;
$function$;

grant select on public.platform_invites to authenticated;
grant execute on function public.is_platform_inviter(uuid) to authenticated;
grant execute on function public.is_signup_email_allowed(text) to anon, authenticated;
grant execute on function public.create_platform_invite(text, text) to authenticated;
grant execute on function public.claim_invites_on_signup(text, text) to authenticated;
