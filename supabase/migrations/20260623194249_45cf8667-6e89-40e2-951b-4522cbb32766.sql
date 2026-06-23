ALTER TABLE public.saved_shows ADD COLUMN IF NOT EXISTS attended boolean NOT NULL DEFAULT false;
ALTER TABLE public.saved_shows ADD COLUMN IF NOT EXISTS attended_at timestamp with time zone;
CREATE INDEX IF NOT EXISTS saved_shows_attended_idx ON public.saved_shows(user_id) WHERE attended = true;