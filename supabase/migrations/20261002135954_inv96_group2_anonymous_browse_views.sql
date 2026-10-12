BEGIN;

-- INV96 Group 2: public browse rows must not expose submitter UUIDs.
ALTER TABLE public.user_films ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_music_shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nyc_shows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User films are viewable by everyone" ON public.user_films;
DROP POLICY IF EXISTS "Users can view their own films" ON public.user_films;
DROP POLICY IF EXISTS "Admins can view all films" ON public.user_films;
CREATE POLICY "Users can view their own films"
ON public.user_films
FOR SELECT
TO authenticated
USING (auth.uid() = submitted_by);
CREATE POLICY "Admins can view all films"
ON public.user_films
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Music shows are viewable by everyone" ON public.user_music_shows;
DROP POLICY IF EXISTS "Users can view their own music shows" ON public.user_music_shows;
DROP POLICY IF EXISTS "Admins can view all music shows" ON public.user_music_shows;
CREATE POLICY "Users can view their own music shows"
ON public.user_music_shows
FOR SELECT
TO authenticated
USING (auth.uid() = submitted_by);
CREATE POLICY "Admins can view all music shows"
ON public.user_music_shows
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Shows are viewable by everyone" ON public.nyc_shows;
DROP POLICY IF EXISTS "Users can view their own shows" ON public.nyc_shows;
DROP POLICY IF EXISTS "Admins can view all shows" ON public.nyc_shows;
CREATE POLICY "Users can view their own shows"
ON public.nyc_shows
FOR SELECT
TO authenticated
USING (auth.uid() = submitted_by);
CREATE POLICY "Admins can view all shows"
ON public.nyc_shows
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP VIEW IF EXISTS public.user_films_browse;
CREATE VIEW public.user_films_browse
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
  id,
  title,
  description,
  link_url,
  poster_url,
  is_anonymous,
  is_active,
  created_at,
  updated_at,
  coalesce(submitted_by = auth.uid(), false) AS is_owner
FROM public.user_films
WHERE is_active IS TRUE;

DROP VIEW IF EXISTS public.user_music_shows_browse;
CREATE VIEW public.user_music_shows_browse
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
  id,
  title,
  description,
  venue,
  show_date,
  ticket_url,
  is_free,
  poster_url,
  is_anonymous,
  is_active,
  created_at,
  updated_at,
  show_type,
  coalesce(submitted_by = auth.uid(), false) AS is_owner
FROM public.user_music_shows
WHERE is_active IS TRUE;

DROP VIEW IF EXISTS public.nyc_shows_browse;
CREATE VIEW public.nyc_shows_browse
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
  id,
  title,
  venue,
  borough,
  description,
  poster_url,
  show_type,
  category,
  price_tier,
  run_start,
  run_end,
  show_times,
  accessibility_features,
  rush_policy,
  lottery_info,
  official_url,
  is_active,
  created_at,
  updated_at,
  is_anonymous,
  badges,
  coalesce(submitted_by = auth.uid(), false) AS is_owner
FROM public.nyc_shows
WHERE is_active IS TRUE;

REVOKE ALL ON public.user_films_browse FROM PUBLIC;
REVOKE ALL ON public.user_music_shows_browse FROM PUBLIC;
REVOKE ALL ON public.nyc_shows_browse FROM PUBLIC;
REVOKE ALL ON public.user_films_browse FROM anon, authenticated;
REVOKE ALL ON public.user_music_shows_browse FROM anon, authenticated;
REVOKE ALL ON public.nyc_shows_browse FROM anon, authenticated;
GRANT SELECT ON public.user_films_browse TO anon, authenticated;
GRANT SELECT ON public.user_music_shows_browse TO anon, authenticated;
GRANT SELECT ON public.nyc_shows_browse TO anon, authenticated;

COMMIT;

/*
ROLLBACK (manual; place in a new migration before running):

BEGIN;

DROP VIEW IF EXISTS public.user_films_browse;
DROP VIEW IF EXISTS public.user_music_shows_browse;
DROP VIEW IF EXISTS public.nyc_shows_browse;

DROP POLICY IF EXISTS "Users can view their own films" ON public.user_films;
DROP POLICY IF EXISTS "Admins can view all films" ON public.user_films;
CREATE POLICY "User films are viewable by everyone"
ON public.user_films FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can view their own music shows" ON public.user_music_shows;
DROP POLICY IF EXISTS "Admins can view all music shows" ON public.user_music_shows;
CREATE POLICY "Music shows are viewable by everyone"
ON public.user_music_shows FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can view their own shows" ON public.nyc_shows;
DROP POLICY IF EXISTS "Admins can view all shows" ON public.nyc_shows;
CREATE POLICY "Shows are viewable by everyone"
ON public.nyc_shows FOR SELECT USING (true);

COMMIT;
*/
