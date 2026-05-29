ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS primary_discipline text,
  ADD COLUMN IF NOT EXISTS secondary_disciplines text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS goals text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;