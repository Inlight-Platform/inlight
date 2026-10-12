BEGIN;

-- Anonymous callers have no auth.uid(); expose a stable false instead of SQL null.
CREATE OR REPLACE VIEW public.user_films_browse
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

CREATE OR REPLACE VIEW public.user_music_shows_browse
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

CREATE OR REPLACE VIEW public.nyc_shows_browse
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

COMMIT;

/*
ROLLBACK (manual; restores the prior nullable anonymous state):

BEGIN;
CREATE OR REPLACE VIEW public.user_films_browse AS
SELECT id, title, description, link_url, poster_url, is_anonymous, is_active,
       created_at, updated_at, submitted_by = auth.uid() AS is_owner
FROM public.user_films WHERE is_active IS TRUE;
CREATE OR REPLACE VIEW public.user_music_shows_browse AS
SELECT id, title, description, venue, show_date, ticket_url, is_free, poster_url,
       is_anonymous, is_active, created_at, updated_at, show_type,
       submitted_by = auth.uid() AS is_owner
FROM public.user_music_shows WHERE is_active IS TRUE;
CREATE OR REPLACE VIEW public.nyc_shows_browse AS
SELECT id, title, venue, borough, description, poster_url, show_type, category,
       price_tier, run_start, run_end, show_times, accessibility_features,
       rush_policy, lottery_info, official_url, is_active, created_at, updated_at,
       is_anonymous, badges, submitted_by = auth.uid() AS is_owner
FROM public.nyc_shows WHERE is_active IS TRUE;
COMMIT;
*/
