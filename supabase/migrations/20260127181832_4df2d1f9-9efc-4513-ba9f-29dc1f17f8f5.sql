-- Add cover_url column to profiles table for profile background images
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_url text;

-- Update the profiles_public view to include cover_url
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
    created_at,
    updated_at
  FROM public.profiles;