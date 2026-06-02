ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS preview_survey_role TEXT,
ADD COLUMN IF NOT EXISTS preview_survey_school TEXT,
ADD COLUMN IF NOT EXISTS preview_survey_goal TEXT,
ADD COLUMN IF NOT EXISTS preview_survey_completed_at TIMESTAMPTZ;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;