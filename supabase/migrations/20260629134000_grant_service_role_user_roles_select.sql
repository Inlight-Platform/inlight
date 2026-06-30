grant select on table public.user_roles to service_role;

notify pgrst, 'reload schema';
