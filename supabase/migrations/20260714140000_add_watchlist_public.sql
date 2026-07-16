ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS watchlist_public boolean DEFAULT false;

-- Rebuild profiles_public view to expose watchlist_public
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
  watchlist_public,
  CASE WHEN show_union_status THEN union_status ELSE NULL END AS union_status,
  CASE WHEN show_representation THEN representation ELSE NULL END AS representation,
  CASE WHEN show_gear_list THEN gear_list ELSE NULL END AS gear_list_display,
  show_union_status,
  show_representation,
  show_gear_list
FROM public.profiles
WHERE public.profile_is_visible_to_current_user(user_id);

GRANT SELECT ON public.profiles_public TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_watchlist_public(value boolean)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles SET watchlist_public = value WHERE user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.set_watchlist_public(boolean) TO authenticated;

-- Allow reading another user's saved shows when their watchlist is public
CREATE POLICY "Public watchlists are readable by anyone"
ON public.saved_shows FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = saved_shows.user_id
      AND profiles.watchlist_public = true
  )
);
