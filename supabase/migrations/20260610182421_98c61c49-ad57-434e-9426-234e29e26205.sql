ALTER TABLE public.user_music_shows
  ADD COLUMN IF NOT EXISTS show_type text NOT NULL DEFAULT 'concert';

ALTER TABLE public.user_music_shows
  DROP CONSTRAINT IF EXISTS user_music_shows_show_type_check;

ALTER TABLE public.user_music_shows
  ADD CONSTRAINT user_music_shows_show_type_check
  CHECK (show_type IN ('concert', 'cabaret'));

GRANT SELECT ON public.user_films TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_films TO authenticated;
GRANT ALL ON public.user_films TO service_role;

GRANT SELECT ON public.user_music_shows TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_music_shows TO authenticated;
GRANT ALL ON public.user_music_shows TO service_role;

DROP POLICY IF EXISTS "Users can submit films" ON public.user_films;
DROP POLICY IF EXISTS "Users can update their own films" ON public.user_films;
DROP POLICY IF EXISTS "Admins can insert any film" ON public.user_films;
DROP POLICY IF EXISTS "Admins can update any film" ON public.user_films;

CREATE POLICY "Users can submit films"
ON public.user_films
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND submitted_by = auth.uid());

CREATE POLICY "Users can update their own films"
ON public.user_films
FOR UPDATE
TO authenticated
USING (auth.uid() = submitted_by)
WITH CHECK (auth.uid() = submitted_by);

CREATE POLICY "Admins can insert any film"
ON public.user_films
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update any film"
ON public.user_films
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users can submit music shows" ON public.user_music_shows;
DROP POLICY IF EXISTS "Users can update their own music shows" ON public.user_music_shows;
DROP POLICY IF EXISTS "Admins can insert any music show" ON public.user_music_shows;
DROP POLICY IF EXISTS "Admins can update any music show" ON public.user_music_shows;

CREATE POLICY "Users can submit music shows"
ON public.user_music_shows
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND submitted_by = auth.uid());

CREATE POLICY "Users can update their own music shows"
ON public.user_music_shows
FOR UPDATE
TO authenticated
USING (auth.uid() = submitted_by)
WITH CHECK (auth.uid() = submitted_by);

CREATE POLICY "Admins can insert any music show"
ON public.user_music_shows
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update any music show"
ON public.user_music_shows
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

NOTIFY pgrst, 'reload schema';