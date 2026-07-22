-- SECURITY DEFINER function so callers bypass saved_shows RLS.
-- Internally enforces: own shows always readable; others only when watchlist_public = true.
CREATE OR REPLACE FUNCTION public.get_profile_watchlist(p_user_id uuid)
RETURNS TABLE (
  id          uuid,
  saved_at    timestamptz,
  show_id     uuid,
  title       text,
  venue       text,
  borough     text,
  show_type   text,
  poster_url  text,
  run_start   date,
  run_end     date,
  official_url text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ss.id,
    ss.saved_at,
    n.id,
    n.title,
    n.venue,
    n.borough,
    n.show_type,
    n.poster_url,
    n.run_start,
    n.run_end,
    n.official_url
  FROM saved_shows ss
  JOIN nyc_shows n ON n.id = ss.show_id
  WHERE ss.user_id = p_user_id
    AND (
      auth.uid() = p_user_id
      OR (
        SELECT watchlist_public FROM profiles WHERE user_id = p_user_id
      )
    )
  ORDER BY ss.saved_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_watchlist(uuid) TO authenticated, anon;
