do $$
declare
  baseline text;
  expected record;
  actual record;
  public_exec boolean;
  expected_count integer;
  email_attnum smallint;
begin
  -- A fresh confirmation state has neither claim helper nor confirmation wiring.
  if to_regprocedure('public.handle_user_email_confirmed()') is null
     and to_regprocedure('public.accept_platform_invite_on_signup()') is null
     and to_regprocedure('public.claim_group_member_invites_for_user(uuid)') is null
     and to_regprocedure('public.claim_pending_group_admins_for_user(uuid)') is null
     and not exists (
       select 1 from pg_catalog.pg_trigger t
       where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal
         and (t.tgtype & 16) <> 0
     ) then
    return;
  end if;

  select case
    when md5(p.prosrc) = '0c37fd6c9d61f254824e63507f561a58' and length(p.prosrc) = 573 then 'production'
    when md5(p.prosrc) = '398cfe6c9045d33447d84f3cd73566a1' and length(p.prosrc) = 702 then 'sandbox'
  end into baseline
  from pg_catalog.pg_proc p
  where p.oid = to_regprocedure('public.handle_user_email_confirmed()');
  if baseline is null then
    raise exception 'Confirmation integration requires review: unknown or mixed function state';
  end if;

  for expected in
    select * from (values
      ('public.accept_platform_invite_on_signup()', '0c4339ad025a13743e77ff8e098bc354', 376, '6f40bbf826f44b50610e53e2fd9e4822', 435, 'search_path=public', false),
      ('public.claim_group_member_invites_for_user(uuid)', '943b9e17c412c9cb73e3c7ec3c721b05', 1312, 'cb66d26f3cb416c85a0680faff89d03f', 1352, 'search_path=public, auth', true),
      ('public.claim_pending_group_admins_for_user(uuid)', 'ab0dca8be049bc96382db87af3f69db6', 643, 'cb70528eff557c33c717d21f132eb3c1', 683, 'search_path=public, auth', true),
      ('public.handle_user_email_confirmed()', '0c37fd6c9d61f254824e63507f561a58', 573, '398cfe6c9045d33447d84f3cd73566a1', 702, 'search_path=public', false)
    ) as v(signature, prod_hash, prod_length, sandbox_hash, sandbox_length, config, is_claim)
  loop
    select p.oid, p.prosrc, p.prosecdef, p.proisstrict, p.provolatile,
           p.proparallel, p.proconfig, r.rolname
      into actual
      from pg_catalog.pg_proc p join pg_catalog.pg_roles r on r.oid = p.proowner
     where p.oid = to_regprocedure(expected.signature);
    if not found or actual.rolname <> 'postgres' or not actual.prosecdef
       or actual.proisstrict or actual.provolatile <> 'v' or actual.proparallel <> 'u'
       or actual.proconfig is distinct from array[expected.config]::text[]
       or md5(actual.prosrc) <> (case when baseline = 'production' then expected.prod_hash else expected.sandbox_hash end)
       or length(actual.prosrc) <> (case when baseline = 'production' then expected.prod_length else expected.sandbox_length end) then
      raise exception 'Confirmation integration requires review: function metadata or body differs for %', expected.signature;
    end if;

    if expected.is_claim then
      select exists (
        select 1 from pg_catalog.pg_proc p,
          lateral pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
        where p.oid = actual.oid and a.grantee = 0 and a.privilege_type = 'EXECUTE'
      ) into public_exec;
      if baseline = 'production' then
        if not public_exec or not has_function_privilege('anon', actual.oid, 'EXECUTE')
           or not has_function_privilege('authenticated', actual.oid, 'EXECUTE') then
          raise exception 'Confirmation integration requires review: production claim privileges differ for %', expected.signature;
        end if;
      elsif public_exec or has_function_privilege('anon', actual.oid, 'EXECUTE')
            or has_function_privilege('authenticated', actual.oid, 'EXECUTE')
            or not has_function_privilege('service_role', actual.oid, 'EXECUTE') then
        raise exception 'Confirmation integration requires review: sandbox claim privileges differ for %', expected.signature;
      end if;
    end if;
  end loop;

  select attnum into email_attnum from pg_catalog.pg_attribute
  where attrelid = 'auth.users'::regclass and attname = 'email_confirmed_at' and not attisdropped;
  if email_attnum is null then
    raise exception 'Confirmation integration requires review: confirmation column missing';
  end if;
  expected_count := case when baseline = 'production' then 4 else 5 end;
  if (select count(*) from pg_catalog.pg_trigger t
      where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal) <> expected_count then
    raise exception 'Confirmation integration requires review: auth.users trigger inventory differs';
  end if;
  for expected in
    select * from (values
      ('accept_platform_invite_on_signup', 5, 'public.accept_platform_invite_on_signup()', false),
      ('enforce_signup_email_policy_on_auth_users', 7, 'public.enforce_signup_email_policy()', false),
      ('on_auth_user_created', 5, 'public.handle_new_user()', false),
      ('on_auth_user_email_confirmed', 17, 'public.handle_user_email_confirmed()', true)
    ) as v(trigger_name, trigger_type, signature, is_confirmation)
    union all
    select 'on_auth_user_created_assign_admin', 5, 'public.auto_assign_admin_role()', false
    where baseline = 'sandbox'
  loop
    if not exists (
      select 1 from pg_catalog.pg_trigger t
      where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal
        and t.tgname = expected.trigger_name and t.tgtype = expected.trigger_type
        and t.tgfoid = to_regprocedure(expected.signature) and t.tgenabled = 'O'
        and t.tgnargs = 0 and t.tgqual is null and t.tgconstraint = 0
        and t.tgattr::text = case when expected.is_confirmation then email_attnum::text else '' end
    ) then
      raise exception 'Confirmation integration requires review: trigger differs for %', expected.trigger_name;
    end if;
  end loop;
end;
$$;
