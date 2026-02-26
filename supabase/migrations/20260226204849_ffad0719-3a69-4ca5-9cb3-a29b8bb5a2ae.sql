
-- Create saved_films table mirroring saved_shows
CREATE TABLE public.saved_films (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  film_id UUID NOT NULL REFERENCES public.film_metrics(id) ON DELETE CASCADE,
  saved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, film_id)
);

-- Enable RLS
ALTER TABLE public.saved_films ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their saved films"
  ON public.saved_films FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can save films"
  ON public.saved_films FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave films"
  ON public.saved_films FOR DELETE
  USING (auth.uid() = user_id);
