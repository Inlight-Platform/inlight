do $$
declare
  email_attnum smallint;
  update_trigger_count integer;
begin
  select attnum into email_attnum from pg_catalog.pg_attribute
  where attrelid = 'auth.users'::regclass and attname = 'email_confirmed_at' and not attisdropped;
  if email_attnum is null or to_regprocedure('public.handle_user_email_confirmed()') is null then
    raise exception 'Confirmation integration requires review: confirmation column or handler missing';
  end if;

  select count(*) into update_trigger_count
  from pg_catalog.pg_trigger t
  where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal
    and (t.tgtype & 16) <> 0;

  if update_trigger_count = 0 then
    -- Do not overwrite an unrelated trigger that already uses our name.
    if exists (select 1 from pg_catalog.pg_trigger t
               where t.tgrelid = 'auth.users'::regclass
                 and t.tgname = 'on_auth_user_email_confirmed') then
      raise exception 'Confirmation integration requires review: confirmation trigger name already in use';
    end if;
    create trigger on_auth_user_email_confirmed
      after update of email_confirmed_at on auth.users
      for each row
      when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
      execute function public.handle_user_email_confirmed();
  elsif update_trigger_count = 1 and exists (
    select 1 from pg_catalog.pg_trigger t
    where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal
      and t.tgname = 'on_auth_user_email_confirmed' and t.tgtype = 17
      and t.tgfoid = to_regprocedure('public.handle_user_email_confirmed()')
      and t.tgenabled = 'O' and t.tgnargs = 0 and t.tgqual is null
      and t.tgconstraint = 0 and t.tgattr::text = email_attnum::text
  ) then
    -- The reviewed handler itself guards the confirmation transition.
    null;
  else
    raise exception 'Confirmation integration requires review: unexpected auth.users UPDATE trigger binding';
  end if;
end;
$$;
