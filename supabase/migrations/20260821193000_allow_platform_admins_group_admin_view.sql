create or replace function public.is_group_faculty(_user uuid, _group uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _email text;
begin
  if _user is null or _group is null then
    return false;
  end if;

  if public.has_role(_user, 'admin'::public.app_role) then
    return true;
  end if;

  select lower(email) into _email
  from auth.users
  where id = _user;

  return exists (
    select 1
    from public.group_admins ga
    where ga.group_id = _group
      and ga.status = 'active'
      and (
        ga.user_id = _user
        or (ga.email is not null and _email is not null and lower(ga.email) = _email)
      )
  )
  or exists (
    select 1
    from public.groups g
    where g.id = _group
      and g.faculty_owner_id = _user
  );
end;
$$;

notify pgrst, 'reload schema';
