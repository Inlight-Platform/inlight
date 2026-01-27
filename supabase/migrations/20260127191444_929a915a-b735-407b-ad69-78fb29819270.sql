-- Add skills column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN skills text[] DEFAULT '{}'::text[];

-- Recreate the profiles_public view to include skills
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
  created_at,
  updated_at
FROM public.profiles;