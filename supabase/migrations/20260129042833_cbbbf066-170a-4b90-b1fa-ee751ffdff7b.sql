-- Add poster_url column to broadway_metrics table for cover photos
ALTER TABLE public.broadway_metrics
ADD COLUMN poster_url text;