-- Add visibility toggle columns for profile details
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS show_union_status BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS show_representation BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS show_gear_list BOOLEAN NOT NULL DEFAULT false;

-- Update the profiles_public view to include the new visibility columns
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public WITH (security_invoker=on) AS
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
  headline,
  skills,
  instagram_url,
  website_url,
  graduation_status,
  graduation_year,
  favorite_artist,
  favorite_movie,
  favorite_song,
  gear_list,
  why_artist,
  created_at,
  updated_at,
  -- Conditionally expose these fields based on visibility settings
  CASE WHEN show_union_status THEN union_status ELSE NULL END AS union_status,
  CASE WHEN show_representation THEN representation ELSE NULL END AS representation,
  CASE WHEN show_gear_list THEN gear_list ELSE NULL END AS gear_list_display,
  show_union_status,
  show_representation,
  show_gear_list
FROM public.profiles;