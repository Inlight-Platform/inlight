alter table public.company_staff_access
  add column if not exists staff_name text;

drop function if exists public.validate_company_staff_access(text);
create or replace function public.validate_company_staff_access(_token text)
returns table(company_id uuid, email text, staff_name text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
    select csa.company_id, csa.email, csa.staff_name
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
  _staff_name text default null,
  _expires_at timestamptz default null
)
returns table(access_id uuid, access_company_id uuid, access_email text, access_staff_name text, token text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  clean_email text := lower(trim(_email));
  clean_name text := nullif(trim(coalesce(_staff_name, '')), '');
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

  insert into public.company_staff_access (company_id, email, staff_name, token_hash, created_by, expires_at)
  values (_company_id, clean_email, clean_name, public.company_staff_token_hash(raw_token), auth.uid(), _expires_at)
  on conflict (company_id, lower(email)) where revoked_at is null
  do update
     set staff_name = excluded.staff_name,
         token_hash = excluded.token_hash,
         expires_at = excluded.expires_at,
         created_by = excluded.created_by,
         updated_at = now(),
         last_used_at = null
  returning company_staff_access.id into new_access_id;

  return query select new_access_id, _company_id, clean_email, clean_name, raw_token;
end;
$$;

drop function if exists public.admin_create_company_page(text, text, text, text[]);
create or replace function public.admin_create_company_page(
  _name text,
  _description text default null,
  _website_url text default null,
  _staff_members jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_company_id uuid;
  staff_member jsonb;
  staff_email text;
  staff_name text;
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

  for staff_member in select * from jsonb_array_elements(coalesce(_staff_members, '[]'::jsonb))
  loop
    staff_email := lower(trim(coalesce(staff_member->>'email', '')));
    staff_name := nullif(trim(coalesce(staff_member->>'name', '')), '');

    if staff_email <> '' then
      select * into invite_row
      from public.add_company_staff_access(new_company_id, staff_email, staff_name, null)
      limit 1;

      invites := invites || jsonb_build_array(
        jsonb_build_object(
          'id', invite_row.access_id,
          'company_id', invite_row.access_company_id,
          'email', invite_row.access_email,
          'staff_name', invite_row.access_staff_name,
          'token', invite_row.token
        )
      );
    end if;
  end loop;

  return jsonb_build_object('company_id', new_company_id, 'invites', invites);
end;
$$;

create or replace function public.get_company_staff_access_public(_company_id uuid)
returns table(staff_name text, email text)
language sql
stable
security definer
set search_path = public
as $$
  select csa.staff_name, csa.email
  from public.company_staff_access csa
  where csa.company_id = _company_id
    and csa.revoked_at is null
  order by csa.created_at asc;
$$;

grant execute on function public.validate_company_staff_access(text) to anon, authenticated;
grant execute on function public.add_company_staff_access(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.admin_create_company_page(text, text, text, jsonb) to authenticated;
grant execute on function public.get_company_staff_access_public(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
