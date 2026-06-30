create or replace function public.create_company_project_with_staff_token(
  _token text,
  _title text,
  _description text default null,
  _category text default 'other',
  _status text default 'active',
  _main_image_url text default null,
  _start_date date default null,
  _end_date date default null,
  _link_title text default null,
  _link_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  access_company_id uuid;
  project_creator_id uuid;
  new_project_id uuid;
begin
  if coalesce(length(trim(_title)), 0) = 0 then
    raise exception 'Project title is required';
  end if;

  access_company_id := public.assert_company_staff_token(_token);

  select coalesce(c.owner_user_id, csa.created_by)
    into project_creator_id
  from public.company_staff_access csa
  join public.companies c on c.id = csa.company_id
  where csa.company_id = access_company_id
    and csa.token_hash = public.company_staff_token_hash(_token)
    and csa.revoked_at is null
    and (csa.expires_at is null or csa.expires_at > now())
  limit 1;

  if project_creator_id is null then
    raise exception 'Company project creator is unavailable';
  end if;

  insert into public.projects (
    title,
    description,
    category,
    creator_id,
    company_id,
    status,
    is_public,
    main_image_url,
    start_date,
    end_date,
    link_title,
    link_url
  )
  values (
    trim(_title),
    nullif(trim(coalesce(_description, '')), ''),
    coalesce(nullif(trim(coalesce(_category, '')), ''), 'other'),
    project_creator_id,
    access_company_id,
    case when _status = 'archived' then 'archived' else 'active' end,
    true,
    nullif(trim(coalesce(_main_image_url, '')), ''),
    _start_date,
    _end_date,
    nullif(trim(coalesce(_link_title, '')), ''),
    nullif(trim(coalesce(_link_url, '')), '')
  )
  returning id into new_project_id;

  insert into public.project_members (project_id, user_id, role)
  values (new_project_id, project_creator_id, 'Company admin')
  on conflict (project_id, user_id) do nothing;

  return new_project_id;
end;
$$;

grant execute on function public.create_company_project_with_staff_token(text, text, text, text, text, text, date, date, text, text) to anon, authenticated;
