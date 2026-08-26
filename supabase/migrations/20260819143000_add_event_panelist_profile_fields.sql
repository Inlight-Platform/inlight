-- Extend public event panelists with enough profile-shaped data for a
-- standalone public Hot Seat page.

ALTER TABLE public.event_panelists
  ADD COLUMN IF NOT EXISTS headline text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS skills text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS badges text[] NOT NULL DEFAULT '{}';

NOTIFY pgrst, 'reload schema';
