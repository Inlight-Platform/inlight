create or replace function public.admin_create_group(
  _name text, _slug text, _description text default null,
  _initial_admin_email text default null
)
returns jsonb language plpgsql security definer set search_path = public
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
  if normalized_name = '' then raise exception 'Group name is required'; end if;
  if normalized_slug = '' then raise exception 'Group slug is required'; end if;
  if normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Group slug can only use lowercase letters, numbers, and hyphens';
  end if;
  if normalized_email = '' then raise exception 'Initial admin email is required'; end if;
  if normalized_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' then
    raise exception 'Initial admin email is invalid';
  end if;

  select id into target_user_id from auth.users
  where lower(email) = normalized_email and email_confirmed_at is not null
  limit 1;

  insert into public.groups (name, slug, description, faculty_owner_id)
  values (normalized_name, normalized_slug, normalized_description, target_user_id)
  returning * into new_group;

  insert into public.group_admins (group_id, user_id, email, status, role, invited_by)
  values (new_group.id, target_user_id, normalized_email,
          case when target_user_id is null then 'pending' else 'active' end,
          'admin', auth.uid())
  on conflict do nothing;

  return jsonb_build_object('id', new_group.id, 'slug', new_group.slug,
    'name', new_group.name, 'description', new_group.description,
    'created_at', new_group.created_at, 'updated_at', new_group.updated_at);
end;
$function$;

create or replace function public.add_group_admin_by_email(_group_id uuid, _email text)
returns public.group_admins language plpgsql security definer set search_path = public
as $function$
declare
  normalized_email text := lower(trim(_email));
  target_user_id uuid;
  admin_row public.group_admins%rowtype;
begin
  if auth.uid() is null or not public.is_group_faculty(auth.uid(), _group_id) then
    raise exception 'Not authorized to manage group admins';
  end if;
  if normalized_email is null or normalized_email = '' or normalized_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address';
  end if;

  select id into target_user_id from auth.users
  where lower(email) = normalized_email and email_confirmed_at is not null
  order by created_at desc limit 1;

  select * into admin_row from public.group_admins
  where group_id = _group_id and lower(email) = normalized_email limit 1;
  if admin_row.id is not null then
    if admin_row.status = 'active' then return admin_row; end if;
    update public.group_admins
       set user_id = coalesce(target_user_id, user_id), email = normalized_email,
           status = case when target_user_id is null then 'pending' else 'active' end,
           updated_at = now()
     where id = admin_row.id returning * into admin_row;
    return admin_row;
  end if;

  if target_user_id is not null then
    select * into admin_row from public.group_admins
    where group_id = _group_id and user_id = target_user_id limit 1;
    if admin_row.id is not null then
      if admin_row.status = 'active' then return admin_row; end if;
      update public.group_admins set email = normalized_email, status = 'active', updated_at = now()
      where id = admin_row.id returning * into admin_row;
      return admin_row;
    end if;
  end if;

  insert into public.group_admins (group_id, user_id, email, status, role, invited_by)
  values (_group_id, target_user_id, normalized_email,
          case when target_user_id is null then 'pending' else 'active' end, 'admin', auth.uid())
  returning * into admin_row;
  return admin_row;
end;
$function$;

notify pgrst, 'reload schema';
