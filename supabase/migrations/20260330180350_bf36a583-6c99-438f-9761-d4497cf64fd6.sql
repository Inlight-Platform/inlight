
ALTER TABLE public.showcase_profiles 
ADD COLUMN first_name text,
ADD COLUMN last_name text;

-- Add a unique constraint on user_id + program_slug if not already present
-- (needed for upsert to work correctly)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'showcase_profiles_user_id_program_slug_key'
  ) THEN
    ALTER TABLE public.showcase_profiles ADD CONSTRAINT showcase_profiles_user_id_program_slug_key UNIQUE (user_id, program_slug);
  END IF;
END $$;
