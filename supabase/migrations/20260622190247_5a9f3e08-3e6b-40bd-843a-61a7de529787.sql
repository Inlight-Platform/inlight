GRANT SELECT (email_notifications), UPDATE (email_notifications) ON public.profiles TO authenticated;
GRANT SELECT (email_notifications) ON public.profiles TO anon;
GRANT ALL (email_notifications) ON public.profiles TO service_role;