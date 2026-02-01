-- Drop and recreate the profiles_public view to include graduation fields
DROP VIEW IF EXISTS public.profiles_public;

CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = on)
AS SELECT
  id,
  user_id,
  created_at,
  updated_at,
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
  graduation_status,
  graduation_year
FROM public.profiles;