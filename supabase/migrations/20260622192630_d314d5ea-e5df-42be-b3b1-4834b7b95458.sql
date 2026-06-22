
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_pronouns boolean NOT NULL DEFAULT true;

DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public AS
SELECT
  id,
  user_id,
  display_name,
  stage_name,
  avatar_url,
  cover_url,
  location,
  CASE WHEN show_pronouns THEN pronouns ELSE NULL END AS pronouns,
  role,
  badges,
  bio,
  headline,
  skills,
  instagram_url,
  website_url,
  graduation_status,
  graduation_year,
  favorite_artist,
  favorite_movie,
  favorite_song,
  why_artist,
  created_at,
  updated_at,
  activity_score,
  vouch_count,
  message_privacy,
  CASE WHEN show_union_status THEN union_status ELSE NULL END AS union_status,
  CASE WHEN show_representation THEN representation ELSE NULL END AS representation,
  CASE WHEN show_gear_list THEN gear_list ELSE NULL END AS gear_list_display,
  show_union_status,
  show_representation,
  show_gear_list,
  show_pronouns
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
