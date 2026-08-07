-- Supabase Advisor flags SECURITY DEFINER views because they run with the
-- view owner's privileges instead of the querying role's RLS context.
-- Keep the existing profiles_public definition intact and only force the
-- view to execute as the invoker.
ALTER VIEW public.profiles_public SET (security_invoker = true);

DO $$
DECLARE
  view_options text[];
BEGIN
  SELECT c.reloptions
  INTO view_options
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'profiles_public';

  IF NOT ('security_invoker=true' = ANY (COALESCE(view_options, ARRAY[]::text[]))) THEN
    RAISE EXCEPTION 'public.profiles_public is not configured with security_invoker=true';
  END IF;
END $$;
