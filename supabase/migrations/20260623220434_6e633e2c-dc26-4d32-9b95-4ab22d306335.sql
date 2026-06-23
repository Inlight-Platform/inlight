REVOKE EXECUTE ON FUNCTION public.mark_show_attended(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_show_attended(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_show_attended(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_profile_attendance(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_profile_attendance(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_profile_attendance(uuid) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');