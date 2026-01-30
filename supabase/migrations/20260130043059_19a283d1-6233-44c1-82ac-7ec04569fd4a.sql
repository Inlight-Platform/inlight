-- Create table for streaming content (movies and TV shows)
CREATE TABLE public.streaming_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'movie', -- 'movie' or 'tv'
  platform TEXT NOT NULL, -- Netflix, HBO Max, Disney+, etc.
  description TEXT,
  poster_url TEXT,
  genre TEXT,
  release_year INTEGER,
  rating NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add poster_url to film_metrics for theatre films
ALTER TABLE public.film_metrics ADD COLUMN IF NOT EXISTS poster_url TEXT;

-- Enable RLS
ALTER TABLE public.streaming_content ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Streaming content is publicly viewable"
ON public.streaming_content
FOR SELECT
USING (true);

-- Admin insert/update/delete
CREATE POLICY "Admins can insert streaming content"
ON public.streaming_content
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update streaming content"
ON public.streaming_content
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete streaming content"
ON public.streaming_content
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_streaming_content_updated_at
BEFORE UPDATE ON public.streaming_content
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();