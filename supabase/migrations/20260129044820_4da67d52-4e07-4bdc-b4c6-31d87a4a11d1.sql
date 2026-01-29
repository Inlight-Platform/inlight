-- Add badges column to nyc_shows for badge customization
ALTER TABLE public.nyc_shows 
ADD COLUMN IF NOT EXISTS badges text[] DEFAULT '{}'::text[];

-- Add a comment explaining the column
COMMENT ON COLUMN public.nyc_shows.badges IS 'Array of badge labels for the show (e.g., Tony Winner, Closing Soon)';