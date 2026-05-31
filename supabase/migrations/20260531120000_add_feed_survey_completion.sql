alter table public.profiles
add column if not exists preview_survey_role text,
add column if not exists preview_survey_school text,
add column if not exists preview_survey_goal text,
add column if not exists preview_survey_completed_at timestamptz;
