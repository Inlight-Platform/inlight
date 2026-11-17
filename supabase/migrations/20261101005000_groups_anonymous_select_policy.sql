BEGIN;
SET LOCAL statement_timeout = '15s';
SET LOCAL search_path = public, pg_catalog;

DO $preflight$
DECLARE
  wrapper_oid regprocedure :=
    'public.group_visible_to_caller(uuid)'::regprocedure;
  helper_oid regprocedure;
  relation_name text;
BEGIN
  -- The original permissive policy must be exactly the captured policy.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy p
    WHERE p.polrelid = 'public.groups'::regclass
      AND p.polname = 'Groups visible by directory or membership'
      AND p.polcmd = 'r'
      AND p.polpermissive
      AND p.polroles = ARRAY[0::oid]
      AND btrim(
        pg_catalog.pg_get_expr(p.polqual, p.polrelid),
        E' \t\r\n'
      ) = btrim(
        $expected$CASE
    WHEN (auth.uid() IS NULL) THEN is_listed
    ELSE (is_listed OR is_group_member(auth.uid(), id) OR is_scoped_group_admin(auth.uid(), id) OR has_role(auth.uid(), 'admin'::app_role))
END$expected$,
        E' \t\r\n'
      )
  ) THEN
    RAISE EXCEPTION 'Unexpected existing groups directory policy';
  END IF;

  -- The existing restrictive policy must already use the reviewed wrapper.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy p
    WHERE p.polrelid = 'public.groups'::regclass
      AND p.polname = 'Group discovery readiness'
      AND p.polcmd = 'r'
      AND NOT p.polpermissive
      AND p.polroles = ARRAY[0::oid]
      AND pg_catalog.pg_get_expr(p.polqual, p.polrelid)
          = 'group_visible_to_caller(id)'
  ) THEN
    RAISE EXCEPTION 'Unexpected restrictive groups readiness policy';
  END IF;

  -- Check the wrapper binding and its captured caller-aware implementation.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc p
    WHERE p.oid = wrapper_oid
      AND p.proowner = (
        SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user
      )
      AND p.prosecdef
      AND p.prosrc = $expected$
declare
  caller uuid := auth.uid();
begin
  if public.group_is_discoverable(_group_id) then return true; end if;
  if caller is null then return false; end if;
  return public.is_group_member(caller, _group_id)
    or public.is_scoped_group_admin(caller, _group_id)
    or (exists (select 1 from public.groups g where g.id = _group_id)
        and public.has_role(caller, 'admin'::public.app_role));
end;
$expected$
  ) OR NOT pg_catalog.has_function_privilege('anon', wrapper_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected caller-aware wrapper owner, body, or anon privilege';
  END IF;

  -- Its owner must be able to evaluate the captured dependency chain without
  -- recursively applying RLS to the same groups policy.
  FOREACH relation_name IN ARRAY ARRAY[
    'public.groups', 'public.group_admins', 'public.group_members', 'auth.users'
  ] LOOP
    IF NOT pg_catalog.has_table_privilege(current_user, relation_name, 'SELECT')
       OR pg_catalog.row_security_active(relation_name::regclass) THEN
      RAISE EXCEPTION 'Wrapper owner lacks effective access to %', relation_name;
    END IF;
  END LOOP;

  FOREACH helper_oid IN ARRAY ARRAY[
    'public.group_is_discoverable(uuid)'::regprocedure,
    'public.group_has_confirmed_active_admin(uuid)'::regprocedure,
    'public.is_group_member(uuid,uuid)'::regprocedure,
    'public.is_scoped_group_admin(uuid,uuid)'::regprocedure
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_proc p
      WHERE p.oid = helper_oid
        AND p.proowner = (
          SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user
        )
        AND p.prosecdef
    ) OR NOT pg_catalog.has_function_privilege(current_user, helper_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'Unexpected wrapper dependency: %', helper_oid;
    END IF;
  END LOOP;

  IF NOT pg_catalog.has_function_privilege(current_user, 'auth.uid()', 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege(
       current_user, 'public.has_role(uuid,public.app_role)', 'EXECUTE'
     )
     OR NOT pg_catalog.has_function_privilege(
       current_user, 'private.has_role(uuid,public.app_role)', 'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'Wrapper owner lacks identity or role-helper execution';
  END IF;
END;
$preflight$;

ALTER POLICY "Groups visible by directory or membership"
ON public.groups
USING (public.group_visible_to_caller(id));

DO $postflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy p
    WHERE p.polrelid = 'public.groups'::regclass
      AND p.polname = 'Groups visible by directory or membership'
      AND p.polcmd = 'r'
      AND p.polpermissive
      AND p.polroles = ARRAY[0::oid]
      AND pg_catalog.pg_get_expr(p.polqual, p.polrelid)
          = 'group_visible_to_caller(id)'
  ) THEN
    RAISE EXCEPTION 'Updated permissive groups policy has unexpected shape';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy p
    WHERE p.polrelid = 'public.groups'::regclass
      AND p.polname = 'Group discovery readiness'
      AND p.polcmd = 'r'
      AND NOT p.polpermissive
      AND p.polroles = ARRAY[0::oid]
      AND pg_catalog.pg_get_expr(p.polqual, p.polrelid)
          = 'group_visible_to_caller(id)'
  ) THEN
    RAISE EXCEPTION 'Restrictive groups readiness policy changed unexpectedly';
  END IF;
END;
$postflight$;

COMMIT;
