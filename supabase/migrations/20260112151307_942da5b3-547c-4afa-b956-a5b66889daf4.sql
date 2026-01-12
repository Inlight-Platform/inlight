-- Fix: Security Definer View warning
-- Change the view to use SECURITY INVOKER so it respects the querying user's permissions

DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public 
WITH (security_invoker = true) AS
SELECT 
  id,
  user_id,
  display_name,
  avatar_url,
  headline,
  location,
  pronouns,
  role,
  badges,
  bio,
  union_status,
  representation,
  gear_list,
  created_at,
  updated_at
FROM public.profiles;

-- Grant access to the view for authenticated and anonymous users
GRANT SELECT ON public.profiles_public TO anon, authenticated;