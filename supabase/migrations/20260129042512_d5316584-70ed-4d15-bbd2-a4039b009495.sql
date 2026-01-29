-- Recreate the view with SECURITY INVOKER to fix security warning
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker=on) AS
SELECT 
  id,
  user_id,
  display_name,
  avatar_url,
  cover_url,
  headline,
  location,
  pronouns,
  role,
  badges,
  bio,
  union_status,
  representation,
  gear_list,
  skills,
  instagram_url,
  website_url,
  created_at,
  updated_at
FROM public.profiles;