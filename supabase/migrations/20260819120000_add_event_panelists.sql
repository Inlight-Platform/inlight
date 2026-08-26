-- Add admin-managed panelists for public event/Hot Seat workflows.
-- Panelists can link to an existing Inlight user, or stand alone when the
-- panelist does not have an account yet.

CREATE TABLE IF NOT EXISTS public.event_panelists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  title text,
  bio text,
  headshot_url text,
  website_url text,
  reel_url text,
  public_slug text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_panelists_display_name_present CHECK (NULLIF(BTRIM(display_name), '') IS NOT NULL),
  CONSTRAINT event_panelists_public_slug_present CHECK (NULLIF(BTRIM(public_slug), '') IS NOT NULL),
  CONSTRAINT event_panelists_event_slug_unique UNIQUE (event_id, public_slug)
);

CREATE INDEX IF NOT EXISTS idx_event_panelists_event_id_sort
  ON public.event_panelists(event_id, sort_order, display_name);

CREATE INDEX IF NOT EXISTS idx_event_panelists_active
  ON public.event_panelists(event_id, is_active)
  WHERE is_active IS TRUE;

ALTER TABLE public.event_panelists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active event panelists are publicly readable" ON public.event_panelists;
CREATE POLICY "Active event panelists are publicly readable"
ON public.event_panelists
FOR SELECT
TO anon, authenticated
USING (is_active IS TRUE);

DROP POLICY IF EXISTS "Admins can manage event panelists" ON public.event_panelists;
CREATE POLICY "Admins can manage event panelists"
ON public.event_panelists
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT ON public.event_panelists TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.event_panelists TO authenticated;

NOTIFY pgrst, 'reload schema';
