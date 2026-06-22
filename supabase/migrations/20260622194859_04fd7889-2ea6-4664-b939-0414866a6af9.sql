
DROP VIEW IF EXISTS public.profiles_public CASCADE;

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
  role,
  badges,
  bio,
  headline,
  skills,
  instagram_url,
  website_url,
  graduation_status,
  graduation_year,
  created_at,
  updated_at,
  activity_score,
  vouch_count,
  favorite_movie,
  favorite_artist,
  favorite_song,
  why_artist,
  primary_discipline,
  secondary_disciplines,
  CASE WHEN show_union_status THEN union_status ELSE NULL END AS union_status,
  CASE WHEN show_representation THEN representation ELSE NULL END AS representation,
  CASE WHEN show_gear_list THEN gear_list ELSE NULL END AS gear_list_display,
  show_union_status,
  show_representation,
  show_gear_list
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
