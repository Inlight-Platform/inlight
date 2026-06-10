GRANT SELECT ON public.user_films TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_films TO authenticated;
GRANT ALL ON public.user_films TO service_role;

GRANT SELECT ON public.user_music_shows TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_music_shows TO authenticated;
GRANT ALL ON public.user_music_shows TO service_role;