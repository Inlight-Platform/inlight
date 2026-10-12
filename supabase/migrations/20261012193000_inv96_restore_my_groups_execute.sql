-- Home and Group audience controls use this caller-scoped, no-argument RPC.
REVOKE ALL ON FUNCTION public.get_my_groups() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_groups() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
