-- Recreate the profiles_public view with security_invoker to fix security warning
DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public
WITH (security_invoker=on) AS
SELECT 
  id,
  user_id,
  display_name,
  avatar_url,
  cover_url,
  location,
  pronouns,
  role,
  badges,
  bio,
  union_status,
  representation,
  gear_list,
  headline,
  skills,
  created_at,
  updated_at
FROM public.profiles;