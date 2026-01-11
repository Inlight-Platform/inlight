-- Add additional profile fields
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS location text,
ADD COLUMN IF NOT EXISTS pronouns text,
ADD COLUMN IF NOT EXISTS role text,
ADD COLUMN IF NOT EXISTS badges text[] DEFAULT '{}'::text[];