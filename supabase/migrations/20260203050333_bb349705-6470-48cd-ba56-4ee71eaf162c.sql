-- Add questionnaire columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS favorite_movie TEXT,
ADD COLUMN IF NOT EXISTS favorite_artist TEXT,
ADD COLUMN IF NOT EXISTS favorite_song TEXT,
ADD COLUMN IF NOT EXISTS why_artist TEXT;

-- Update the profiles_public view to include the new questionnaire fields
DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public AS
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