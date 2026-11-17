-- Proposed new forward migration. Confirm this version is unused before copying.
-- Source-only artifact: NOT APPLIED OR SQL-EXECUTED.
BEGIN;
SET LOCAL statement_timeout = '15s';

DO $preflight$
DECLARE
  helper_oid regprocedure;
  relation_name text;
BEGIN
  IF pg_catalog.to_regprocedure('public.group_page_visible_to_caller(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'New page decision already exists; inspect instead of replacing';
  END IF;
  IF NOT pg_catalog.has_schema_privilege(current_user, 'public', 'USAGE')
     OR NOT pg_catalog.has_schema_privilege(current_user, 'auth', 'USAGE') THEN
    RAISE EXCEPTION 'Page decision owner lacks required schema usage';
  END IF;
  FOREACH relation_name IN ARRAY ARRAY['public.groups', 'public.group_members'] LOOP
    IF NOT pg_catalog.has_table_privilege(current_user, relation_name, 'SELECT')
       OR pg_catalog.row_security_active(relation_name::regclass) THEN
      RAISE EXCEPTION 'Page decision owner needs SELECT and RLS bypass on %', relation_name;
    END IF;
  END LOOP;
  FOREACH helper_oid IN ARRAY ARRAY[
    'public.group_visible_to_caller(uuid)'::regprocedure,
    'public.group_has_confirmed_active_admin(uuid)'::regprocedure
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_proc p
      WHERE p.oid = helper_oid AND p.prosecdef
        AND p.proowner = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user)
    ) OR NOT pg_catalog.has_function_privilege(current_user, helper_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'Page decision requires same-owner definer helper %', helper_oid;
    END IF;
  END LOOP;
  IF NOT pg_catalog.has_function_privilege(current_user, 'auth.uid()', 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege(current_user, 'public.has_role(uuid,public.app_role)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Page decision owner lacks caller/role helper execution';
  END IF;
END;
$preflight$;

-- New function inherits migration owner. No existing helper, policy or row changes.
-- SECURITY DEFINER is needed because raw confirmed-readiness execution is withheld
-- from client roles. Same-owner helper checks and owner RLS bypass avoid recursion.
CREATE FUNCTION public.group_page_visible_to_caller(_group_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  caller uuid := auth.uid();
BEGIN
  IF _group_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.groups g WHERE g.id = _group_id) THEN
    RETURN false;
  END IF;
  IF public.group_visible_to_caller(_group_id) IS DISTINCT FROM true THEN
    RETURN false;
  END IF;
  -- Anonymous/nonplatform callers keep the decision of the existing read helper.
  IF caller IS NULL OR public.has_role(caller, 'admin'::public.app_role) IS DISTINCT FROM true THEN
    RETURN true;
  END IF;
  -- A platform admin who is an ordinary active member keeps member access.
  IF EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = _group_id AND gm.user_id = caller AND gm.status = 'active'
  ) THEN
    RETURN true;
  END IF;
  RETURN public.group_has_confirmed_active_admin(_group_id) IS TRUE;
END;
$function$;

REVOKE ALL ON FUNCTION public.group_page_visible_to_caller(uuid)
  FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.group_page_visible_to_caller(uuid) TO anon, authenticated;

DO $postflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.oid = 'public.group_page_visible_to_caller(uuid)'::regprocedure
      AND p.proowner = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user)
      AND p.prosecdef AND p.provolatile = 's'
      AND p.proconfig = ARRAY['search_path=pg_catalog']::text[]
  ) THEN
    RAISE EXCEPTION 'Unexpected new page decision owner/security attributes';
  END IF;
  IF NOT pg_catalog.has_function_privilege('anon', 'public.group_page_visible_to_caller(uuid)', 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('authenticated', 'public.group_page_visible_to_caller(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Expected page decision client execution missing';
  END IF;
  IF pg_catalog.has_function_privilege('anon', 'public.group_has_confirmed_active_admin(uuid)', 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', 'public.group_has_confirmed_active_admin(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Raw readiness client isolation changed';
  END IF;
END;
$postflight$;
NOTIFY pgrst, 'reload schema';
COMMIT;
