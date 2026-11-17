-- Serialize removals per surviving group. The checks below rely on fresh
-- statement snapshots at READ COMMITTED; stronger isolation is rejected.
create or replace function public.guard_group_admin_demotion()
returns trigger language plpgsql security definer set search_path = public, auth
as $function$
declare
  target_user uuid := old.user_id;
  matching_users integer;
begin
  if old.status <> 'active' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status
       or new.group_id is distinct from old.group_id
       or new.user_id is distinct from old.user_id
       or lower(new.email) is distinct from lower(old.email) then
      raise exception 'Remove active admin powers using remove_group_admin; active admin identity or status cannot be reassigned';
    end if;
    return new;
  end if;

  perform 1 from public.groups where id = old.group_id for update;
  -- A cascade from deleting the group has no surviving group to protect.
  if not found then return old; end if;
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Admin removal requires READ COMMITTED transaction isolation';
  end if;

  if target_user is null then
    select count(*), (array_agg(id))[1] into matching_users, target_user
    from auth.users where lower(email) = lower(old.email) and email_confirmed_at is not null;
    if matching_users <> 1 then
      raise exception 'Cannot safely identify this active admin; resolve the assignment before removal';
    end if;
  elsif exists (select 1 from auth.users where lower(email) = lower(old.email) and id <> target_user) then
    raise exception 'Admin user and email identify different accounts; resolve the assignment before removal';
  end if;

  if not exists (
    select 1 from public.group_admins ga
    join auth.users u on (u.id = ga.user_id or lower(u.email) = lower(ga.email))
    where ga.group_id = old.group_id and ga.id <> old.id and ga.status = 'active'
      and u.email_confirmed_at is not null and u.id <> target_user
  ) then
    raise exception 'Another confirmed active admin is required before removing this admin or deleting their account';
  end if;

  return old;
end;
$function$;

create trigger guard_group_admin_demotion
before delete or update of status, group_id, user_id, email on public.group_admins
for each row execute function public.guard_group_admin_demotion();

create or replace function public.remove_group_admin(_admin_id uuid)
returns void language plpgsql security definer set search_path = public
as $function$
declare
  admin_row public.group_admins%rowtype;
  target_user uuid;
begin
  select * into admin_row from public.group_admins where id = _admin_id;
  if admin_row.id is null then raise exception 'Group admin not found'; end if;
  if auth.uid() is null or not public.is_group_faculty(auth.uid(), admin_row.group_id) then
    raise exception 'Not authorized to manage group admins';
  end if;
  delete from public.group_admins where id = admin_row.id returning * into admin_row;
  if not found then raise exception 'Group admin not found'; end if;
  if admin_row.status = 'active' then
    target_user := admin_row.user_id;
    if target_user is null then
      select id into strict target_user from auth.users
      where lower(email) = lower(admin_row.email) and email_confirmed_at is not null;
    end if;
    insert into public.group_members (group_id, user_id, status)
    values (admin_row.group_id, target_user, 'active')
    on conflict (group_id, user_id) do update
      set status = 'active', joined_at = case
        when public.group_members.status is distinct from 'active' then now()
        else public.group_members.joined_at end;
    update public.groups set faculty_owner_id = null
    where id = admin_row.group_id and faculty_owner_id = target_user;
  end if;
end;
$function$;

notify pgrst, 'reload schema';
