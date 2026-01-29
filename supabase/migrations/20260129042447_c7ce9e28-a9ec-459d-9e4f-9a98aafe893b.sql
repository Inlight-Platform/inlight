-- Add external links columns to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS instagram_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS website_url text;

-- Add to the profiles_public view to expose these fields publicly
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public AS
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