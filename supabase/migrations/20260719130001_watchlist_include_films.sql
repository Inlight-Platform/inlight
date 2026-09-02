-- Extend get_profile_watchlist to include saved films alongside saved shows.
-- Films use their release date as both run_start and run_end so Active/History
-- tab logic in the frontend works consistently (past date → History tab).
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
    n.id          AS show_id,
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
      OR (SELECT watchlist_public FROM profiles WHERE user_id = p_user_id)
    )

  UNION ALL

  SELECT
    sf.id,
    sf.saved_at,
    fm.id             AS show_id,
    fm.title,
    fm.studio         AS venue,
    NULL::text        AS borough,
    'film'            AS show_type,
    fm.poster_url,
    fm.date           AS run_start,
    fm.date           AS run_end,
    fm.ticket_url     AS official_url
  FROM saved_films sf
  JOIN film_metrics fm ON fm.id = sf.film_id
  WHERE sf.user_id = p_user_id
    AND (
      auth.uid() = p_user_id
      OR (SELECT watchlist_public FROM profiles WHERE user_id = p_user_id)
    )

  ORDER BY saved_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_watchlist(uuid) TO authenticated, anon;
