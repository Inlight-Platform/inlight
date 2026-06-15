-- Invite external collaborators to join Inlight and claim a project credit.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.is_platform_inviter(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select _user_id is not null
$function$;

create table if not exists public.project_credit_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  inviter_id uuid not null,
  email text not null,
  role_name text not null,
  token text not null default encode(gen_random_bytes(24), 'hex'),
  status text not null default 'pending',
  accepted_at timestamptz,
  accepted_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists project_credit_invites_token_key
  on public.project_credit_invites (token);

create unique index if not exists project_credit_invites_pending_key
  on public.project_credit_invites (project_id, lower(email), lower(role_name))
  where status = 'pending';

alter table public.project_credit_invites enable row level security;

drop policy if exists "Project collaborators can view credit invites" on public.project_credit_invites;
create policy "Project collaborators can view credit invites"
on public.project_credit_invites
for select
to authenticated
using (
  inviter_id = auth.uid()
  or exists (
    select 1
    from public.projects p
    where p.id = project_credit_invites.project_id
      and p.creator_id = auth.uid()
  )
  or exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_credit_invites.project_id
      and pm.user_id = auth.uid()
  )
);

create or replace function public.create_project_credit_invite(
  _email text,
  _project_id uuid,
  _role_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  normalized_email text := lower(btrim(coalesce(_email, '')));
  normalized_role text := btrim(coalesce(_role_name, ''));
  invite_row public.project_credit_invites%rowtype;
  project_title text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if normalized_email = '' or normalized_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address';
  end if;

  if normalized_role = '' then
    raise exception 'Enter the credit or role this person should claim';
  end if;

  select title
    into project_title
    from public.projects p
   where p.id = _project_id
     and (
       p.creator_id = auth.uid()
       or exists (
         select 1
         from public.project_members pm
         where pm.project_id = p.id
           and pm.user_id = auth.uid()
       )
     );

  if project_title is null then
    raise exception 'Not authorized to invite collaborators for this project';
  end if;

  select *
    into invite_row
    from public.project_credit_invites
   where project_id = _project_id
     and lower(email) = normalized_email
     and lower(role_name) = lower(normalized_role)
     and status = 'pending'
   limit 1;

  if not found then
    insert into public.project_credit_invites (project_id, inviter_id, email, role_name)
    values (_project_id, auth.uid(), normalized_email, normalized_role)
    returning * into invite_row;
  end if;

  return jsonb_build_object(
    'id', invite_row.id,
    'project_id', invite_row.project_id,
    'project_title', project_title,
    'inviter_id', invite_row.inviter_id,
    'email', invite_row.email,
    'role_name', invite_row.role_name,
    'token', invite_row.token,
    'status', invite_row.status,
    'created_at', invite_row.created_at,
    'accepted_at', invite_row.accepted_at
  );
end;
$function$;

create or replace function public.accept_project_credit_invite(_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  invite_row public.project_credit_invites%rowtype;
  project_row public.projects%rowtype;
  user_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  credit_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select *
    into invite_row
    from public.project_credit_invites
   where token = btrim(coalesce(_token, ''))
     and status = 'pending'
   limit 1;

  if not found then
    return jsonb_build_object('claimed', false, 'reason', 'not_found');
  end if;

  if lower(invite_row.email) <> user_email then
    raise exception 'This invite belongs to a different email address';
  end if;

  select *
    into project_row
    from public.projects
   where id = invite_row.project_id;

  insert into public.credits (user_id, project, role, year, verified)
  values (
    auth.uid(),
    project_row.title,
    invite_row.role_name,
    extract(year from coalesce(project_row.start_date::timestamptz, project_row.created_at, now()))::integer,
    true
  )
  returning id into credit_id;

  insert into public.project_members (project_id, user_id, role)
  select invite_row.project_id, auth.uid(), invite_row.role_name
  where not exists (
    select 1
    from public.project_members pm
    where pm.project_id = invite_row.project_id
      and pm.user_id = auth.uid()
  );

  update public.project_credit_invites
     set status = 'accepted',
         accepted_at = now(),
         accepted_by = auth.uid(),
         updated_at = now()
   where id = invite_row.id;

  return jsonb_build_object(
    'claimed', true,
    'credit_id', credit_id,
    'project_id', invite_row.project_id
  );
end;
$function$;

create or replace function public.is_signup_email_allowed(
  _email text,
  _platform_token text default null,
  _credit_token text default null
)
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
        and (
          nullif(btrim(coalesce(_platform_token, '')), '') is null
          or pi.token = btrim(_platform_token)
        )
    )
    or exists (
      select 1
      from public.project_credit_invites pci
      where lower(pci.email) = lower(btrim(coalesce(_email, '')))
        and pci.status = 'pending'
        and (
          nullif(btrim(coalesce(_credit_token, '')), '') is null
          or pci.token = btrim(_credit_token)
        )
    )
$function$;

create or replace function public.enforce_signup_email_policy()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  normalized_email text := lower(coalesce(new.email, ''));
  platform_token text := new.raw_user_meta_data ->> 'platform_invite_token';
  credit_token text := new.raw_user_meta_data ->> 'project_credit_invite_token';
begin
  if normalized_email = '' then
    return new;
  end if;

  if public.is_signup_email_allowed(normalized_email, platform_token, credit_token) then
    return new;
  end if;

  raise exception 'Only university .edu email addresses or invited emails are allowed to sign up.';
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

  if nullif(btrim(_credit_token), '') is not null then
    credit_claim_result := public.accept_project_credit_invite(_credit_token);
  end if;

  return jsonb_build_object(
    'platform_invite_claimed', platform_claimed,
    'credit_invite_claimed', coalesce((credit_claim_result ->> 'claimed')::boolean, false),
    'credit_invite', credit_claim_result
  );
end;
$function$;

grant select on public.project_credit_invites to authenticated;
grant execute on function public.create_project_credit_invite(text, uuid, text) to authenticated;
grant execute on function public.accept_project_credit_invite(text) to authenticated;
grant execute on function public.is_signup_email_allowed(text, text, text) to anon, authenticated;
grant execute on function public.claim_invites_on_signup(text, text) to authenticated;
