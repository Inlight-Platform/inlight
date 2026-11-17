-- Preserve the applied guard; correct only how a successor is resolved.
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
    join auth.users u on (
      (ga.user_id is not null and u.id = ga.user_id)
      or (ga.user_id is null and ga.email is not null and lower(u.email) = lower(ga.email))
    )
    where ga.group_id = old.group_id and ga.id <> old.id and ga.status = 'active'
      and u.email_confirmed_at is not null and u.id <> target_user
  ) then
    raise exception 'Another confirmed active admin is required before removing this admin or deleting their account';
  end if;

  return old;
end;
$function$;

