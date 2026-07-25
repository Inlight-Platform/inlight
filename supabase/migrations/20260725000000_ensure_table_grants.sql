-- Ensure all roles have the correct table-level grants.
-- These are idempotent re-statements of grants from earlier migrations
-- (20260622185245, 20260622185936, 20260623220324, 20260622061209)
-- that may not yet be applied to the remote database.

-- profiles: needed by the security_invoker=true profiles_public view
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- profiles_public view
GRANT SELECT ON public.profiles_public TO anon, authenticated;
GRANT ALL ON public.profiles_public TO service_role;

-- nyc_shows: needed for FK constraint check when inserting into saved_shows
GRANT SELECT ON public.nyc_shows TO anon, authenticated;
GRANT ALL ON public.nyc_shows TO service_role;

-- saved_shows
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_shows TO authenticated;
GRANT ALL ON public.saved_shows TO service_role;

-- saved_films (same pattern)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_films TO authenticated;
GRANT ALL ON public.saved_films TO service_role;
