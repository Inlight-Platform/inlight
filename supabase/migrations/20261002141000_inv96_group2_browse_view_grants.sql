BEGIN;

-- Normalize grants for local databases where the Group 2 views were already created.
REVOKE ALL ON public.user_films_browse FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.user_music_shows_browse FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.nyc_shows_browse FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.user_films_browse TO anon, authenticated;
GRANT SELECT ON public.user_music_shows_browse TO anon, authenticated;
GRANT SELECT ON public.nyc_shows_browse TO anon, authenticated;

COMMIT;

/*
ROLLBACK (manual; only needed if the Group 2 views are retained):

BEGIN;
REVOKE ALL ON public.user_films_browse FROM anon, authenticated;
REVOKE ALL ON public.user_music_shows_browse FROM anon, authenticated;
REVOKE ALL ON public.nyc_shows_browse FROM anon, authenticated;
COMMIT;
*/
