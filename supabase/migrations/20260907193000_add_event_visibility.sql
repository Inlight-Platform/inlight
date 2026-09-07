-- Add browse visibility for events. Existing events remain public.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_visibility_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_visibility_check
  CHECK (visibility IN ('public', 'unlisted'));

CREATE INDEX IF NOT EXISTS idx_events_visibility
  ON public.events(visibility);

NOTIFY pgrst, 'reload schema';
