
-- Add ticket_url column to film_metrics
ALTER TABLE public.film_metrics ADD COLUMN IF NOT EXISTS ticket_url text DEFAULT NULL;

-- Make weekend_gross and total_gross have defaults so they're not required
ALTER TABLE public.film_metrics ALTER COLUMN weekend_gross SET DEFAULT 0;
ALTER TABLE public.film_metrics ALTER COLUMN total_gross SET DEFAULT 0;
