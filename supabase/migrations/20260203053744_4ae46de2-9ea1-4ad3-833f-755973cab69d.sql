-- Update profiles_public view to include stage_name
DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public 
WITH (security_invoker = true)
AS
SELECT 
  id,
  user_id,
  display_name,
  stage_name,
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
  instagram_url,
  website_url,
  graduation_status,
  graduation_year,
  favorite_movie,
  favorite_artist,
  favorite_song,
  why_artist,
  created_at,
  updated_at
FROM public.profiles;