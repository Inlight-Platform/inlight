ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS has_completed_tour boolean NOT NULL DEFAULT false;