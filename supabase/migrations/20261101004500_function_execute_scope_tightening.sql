-- Record the local function execution scope without changing role powers.
revoke execute on function public.update_group_directory_listing(uuid, boolean) from anon, service_role;
revoke execute on function public.request_group_membership(uuid) from service_role;

do $check$
declare
  function_oid regprocedure;
begin
  foreach function_oid in array array[
    'public.update_group_directory_listing(uuid,boolean)'::regprocedure,
    'public.request_group_membership(uuid)'::regprocedure
  ] loop
    if has_function_privilege('anon', function_oid, 'EXECUTE')
       or has_function_privilege('service_role', function_oid, 'EXECUTE')
       or not has_function_privilege('authenticated', function_oid, 'EXECUTE') then
      raise exception 'Unexpected effective execution privileges on %', function_oid;
    end if;
    if exists (
      select 1 from pg_catalog.pg_proc p,
        lateral pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) acl
      where p.oid = function_oid and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
    ) then
      raise exception 'PUBLIC retains execution privilege on %', function_oid;
    end if;
  end loop;
end;
$check$;
