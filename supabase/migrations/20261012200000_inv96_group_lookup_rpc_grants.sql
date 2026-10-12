-- All caller-scoped Group lookups are signed-in RPCs, not public directory APIs.
REVOKE ALL ON FUNCTION public.get_my_groups() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_faculty_group() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_scoped_admin_groups() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_my_groups() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_faculty_group() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_scoped_admin_groups() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
