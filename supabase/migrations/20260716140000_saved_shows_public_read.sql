-- Replace the owner-only SELECT policy with one that also allows reading
-- public watchlists (profiles.watchlist_public = true).
DROP POLICY IF EXISTS "Users can view their saved shows" ON public.saved_shows;
DROP POLICY IF EXISTS "Public watchlists are readable by anyone" ON public.saved_shows;

CREATE POLICY "Users can view saved shows"
ON public.saved_shows FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = saved_shows.user_id
      AND profiles.watchlist_public = true
  )
);
