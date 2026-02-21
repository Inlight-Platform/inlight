
-- User-submitted films
CREATE TABLE public.user_films (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  link_url TEXT NOT NULL,
  poster_url TEXT,
  submitted_by UUID NOT NULL,
  is_anonymous BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_films ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User films are viewable by everyone" ON public.user_films FOR SELECT USING (true);
CREATE POLICY "Users can submit films" ON public.user_films FOR INSERT WITH CHECK (auth.uid() = submitted_by);
CREATE POLICY "Users can update their own films" ON public.user_films FOR UPDATE USING (auth.uid() = submitted_by);
CREATE POLICY "Users can delete their own films" ON public.user_films FOR DELETE USING (auth.uid() = submitted_by);
CREATE POLICY "Admins can delete any film" ON public.user_films FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- User-submitted music shows
CREATE TABLE public.user_music_shows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  venue TEXT,
  show_date TIMESTAMPTZ,
  ticket_url TEXT,
  is_free BOOLEAN DEFAULT false,
  poster_url TEXT,
  submitted_by UUID NOT NULL,
  is_anonymous BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_music_shows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Music shows are viewable by everyone" ON public.user_music_shows FOR SELECT USING (true);
CREATE POLICY "Users can submit music shows" ON public.user_music_shows FOR INSERT WITH CHECK (auth.uid() = submitted_by);
CREATE POLICY "Users can update their own music shows" ON public.user_music_shows FOR UPDATE USING (auth.uid() = submitted_by);
CREATE POLICY "Users can delete their own music shows" ON public.user_music_shows FOR DELETE USING (auth.uid() = submitted_by);
CREATE POLICY "Admins can delete any music show" ON public.user_music_shows FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
