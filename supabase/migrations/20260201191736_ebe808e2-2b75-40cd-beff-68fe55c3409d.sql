-- Add graduation year and status columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS graduation_status text,
ADD COLUMN IF NOT EXISTS graduation_year integer;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.graduation_status IS 'Either "student" or "alumni"';
COMMENT ON COLUMN public.profiles.graduation_year IS 'Year of graduation (past or expected)';