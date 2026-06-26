GRANT SELECT ON public.user_music_shows TO anon;
GRANT SELECT, INSERT ON public.user_music_shows TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_music_shows FROM anon;

DROP POLICY IF EXISTS "Music shows are viewable by everyone" ON public.user_music_shows;
DROP POLICY IF EXISTS "Users can submit music shows" ON public.user_music_shows;

CREATE POLICY "Music shows are viewable by everyone"
ON public.user_music_shows
FOR SELECT
USING (true);

CREATE POLICY "Users can submit music shows"
ON public.user_music_shows
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND submitted_by = auth.uid());

NOTIFY pgrst, 'reload schema';
