create table if not exists public.company_staff_access (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  created_by uuid,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_staff_access_email_check check (position('@' in email) > 1)
);

alter table public.company_photos
  alter column uploaded_by drop not null;

create index if not exists idx_company_staff_access_company_id
  on public.company_staff_access(company_id);

create unique index if not exists idx_company_staff_access_active_email
  on public.company_staff_access(company_id, lower(email))
  where revoked_at is null;

alter table public.company_staff_access enable row level security;

grant select, insert, update on public.company_staff_access to authenticated;
grant all on public.company_staff_access to service_role;

drop policy if exists "Admins and owners can view company staff access" on public.company_staff_access;
create policy "Admins and owners can view company staff access"
  on public.company_staff_access for select
  to authenticated
  using (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or exists (
      select 1
      from public.companies c
      where c.id = company_staff_access.company_id
        and c.owner_user_id = auth.uid()
    )
  );

drop policy if exists "Admins and owners can manage company staff access" on public.company_staff_access;
create policy "Admins and owners can manage company staff access"
  on public.company_staff_access for update
  to authenticated
  using (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or exists (
      select 1
      from public.companies c
      where c.id = company_staff_access.company_id
        and c.owner_user_id = auth.uid()
    )
  )
  with check (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or exists (
      select 1
      from public.companies c
      where c.id = company_staff_access.company_id
        and c.owner_user_id = auth.uid()
    )
  );

create trigger trg_company_staff_access_updated_at
  before update on public.company_staff_access
  for each row execute function public.update_updated_at_column();

drop policy if exists "Admins can insert companies" on public.companies;
create policy "Admins can insert companies"
  on public.companies for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Admins can update companies" on public.companies;
create policy "Admins can update companies"
  on public.companies for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Admins can manage company photos" on public.company_photos;
create policy "Admins can manage company photos"
  on public.company_photos for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create or replace function public.company_staff_token_hash(_token text)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select encode(digest(_token, 'sha256'), 'hex')
$$;

create or replace function public.assert_company_staff_token(_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  access_company_id uuid;
begin
  if coalesce(length(trim(_token)), 0) < 32 then
    raise exception 'Invalid access token';
  end if;

  select csa.company_id
    into access_company_id
  from public.company_staff_access csa
  where csa.token_hash = public.company_staff_token_hash(_token)
    and csa.revoked_at is null
    and (csa.expires_at is null or csa.expires_at > now());

  if access_company_id is null then
    raise exception 'Invalid or expired access token';
  end if;

  update public.company_staff_access
     set last_used_at = now()
   where token_hash = public.company_staff_token_hash(_token);

  return access_company_id;
end;
$$;

create or replace function public.validate_company_staff_access(_token text)
returns table(company_id uuid, email text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
    select csa.company_id, csa.email
    from public.company_staff_access csa
    where csa.company_id = public.assert_company_staff_token(_token)
      and csa.token_hash = public.company_staff_token_hash(_token)
    limit 1;
end;
$$;

drop function if exists public.add_company_staff_access(uuid, text, timestamptz);

create or replace function public.add_company_staff_access(
  _company_id uuid,
  _email text,
  _expires_at timestamptz default null
)
returns table(access_id uuid, access_company_id uuid, access_email text, token text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  clean_email text := lower(trim(_email));
  raw_token text := encode(gen_random_bytes(32), 'hex');
  new_access_id uuid;
begin
  if not (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or exists (select 1 from public.companies c where c.id = _company_id and c.owner_user_id = auth.uid())
  ) then
    raise exception 'Admin or company owner only';
  end if;

  if clean_email is null or position('@' in clean_email) <= 1 then
    raise exception 'Valid staff email is required';
  end if;

  insert into public.company_staff_access (company_id, email, token_hash, created_by, expires_at)
  values (_company_id, clean_email, public.company_staff_token_hash(raw_token), auth.uid(), _expires_at)
  on conflict (company_id, lower(email)) where revoked_at is null
  do update
     set token_hash = excluded.token_hash,
         expires_at = excluded.expires_at,
         created_by = excluded.created_by,
         updated_at = now(),
         last_used_at = null
  returning company_staff_access.id into new_access_id;

  return query select new_access_id, _company_id, clean_email, raw_token;
end;
$$;

create or replace function public.admin_create_company_page(
  _name text,
  _description text default null,
  _website_url text default null,
  _staff_emails text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_company_id uuid;
  staff_email text;
  invite_row record;
  invites jsonb := '[]'::jsonb;
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Admin only';
  end if;

  if coalesce(length(trim(_name)), 0) = 0 then
    raise exception 'Company name is required';
  end if;

  insert into public.companies (name, description, website_url, owner_user_id)
  values (trim(_name), nullif(trim(coalesce(_description, '')), ''), nullif(trim(coalesce(_website_url, '')), ''), auth.uid())
  returning id into new_company_id;

  foreach staff_email in array coalesce(_staff_emails, '{}')
  loop
    if nullif(trim(staff_email), '') is not null then
      select * into invite_row
      from public.add_company_staff_access(new_company_id, staff_email, null)
      limit 1;

      invites := invites || jsonb_build_array(
        jsonb_build_object(
          'id', invite_row.access_id,
          'company_id', invite_row.access_company_id,
          'email', invite_row.access_email,
          'token', invite_row.token
        )
      );
    end if;
  end loop;

  return jsonb_build_object('company_id', new_company_id, 'invites', invites);
end;
$$;

create or replace function public.update_company_with_staff_token(
  _token text,
  _name text,
  _description text default null,
  _location text default null,
  _website_url text default null,
  _tagline text default null,
  _mission text default null,
  _brand_primary_color text default null,
  _brand_accent_color text default null,
  _brand_text_color text default null,
  _logo_url text default null,
  _cover_image_url text default null,
  _fun_facts jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  access_company_id uuid;
begin
  access_company_id := public.assert_company_staff_token(_token);

  update public.companies
     set name = trim(_name),
         description = nullif(trim(coalesce(_description, '')), ''),
         location = nullif(trim(coalesce(_location, '')), ''),
         website_url = nullif(trim(coalesce(_website_url, '')), ''),
         tagline = nullif(trim(coalesce(_tagline, '')), ''),
         mission = nullif(trim(coalesce(_mission, '')), ''),
         brand_primary_color = nullif(trim(coalesce(_brand_primary_color, '')), ''),
         brand_accent_color = nullif(trim(coalesce(_brand_accent_color, '')), ''),
         brand_text_color = nullif(trim(coalesce(_brand_text_color, '')), ''),
         logo_url = nullif(trim(coalesce(_logo_url, '')), ''),
         cover_image_url = nullif(trim(coalesce(_cover_image_url, '')), ''),
         fun_facts = coalesce(_fun_facts, '[]'::jsonb)
   where id = access_company_id;

  return access_company_id;
end;
$$;

create or replace function public.add_company_photo_with_staff_token(
  _token text,
  _image_url text,
  _caption text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  access_company_id uuid;
  new_photo_id uuid;
begin
  access_company_id := public.assert_company_staff_token(_token);

  insert into public.company_photos (company_id, image_url, caption)
  values (access_company_id, _image_url, nullif(trim(coalesce(_caption, '')), ''))
  returning id into new_photo_id;

  return new_photo_id;
end;
$$;

create or replace function public.delete_company_photo_with_staff_token(
  _token text,
  _photo_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  access_company_id uuid;
begin
  access_company_id := public.assert_company_staff_token(_token);

  delete from public.company_photos
   where id = _photo_id
     and company_id = access_company_id;
end;
$$;

grant execute on function public.validate_company_staff_access(text) to anon, authenticated;
grant execute on function public.update_company_with_staff_token(text, text, text, text, text, text, text, text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.add_company_photo_with_staff_token(text, text, text) to anon, authenticated;
grant execute on function public.delete_company_photo_with_staff_token(text, uuid) to anon, authenticated;
grant execute on function public.add_company_staff_access(uuid, text, timestamptz) to authenticated;
grant execute on function public.admin_create_company_page(text, text, text, text[]) to authenticated;

notify pgrst, 'reload schema';
