-- Restore ticket attendance columns and trigger function for fresh local database rebuilds.
-- Existing databases already have these pieces; IF NOT EXISTS / CREATE OR REPLACE keeps this safe.

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS attendee_name text,
  ADD COLUMN IF NOT EXISTS attendee_email text,
  ADD COLUMN IF NOT EXISTS attendee_role text,
  ADD COLUMN IF NOT EXISTS checked_in_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS checked_in_by uuid,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS ticket_code text;

ALTER TABLE public.event_rsvps
  ADD COLUMN IF NOT EXISTS attended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attended_at timestamp with time zone;

CREATE OR REPLACE FUNCTION public.mark_rsvp_attended()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.checked_in_at IS NULL OR OLD.checked_in_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.event_rsvps
  SET attended = true,
      attended_at = COALESCE(attended_at, NEW.checked_in_at)
  WHERE event_id = NEW.event_id
    AND user_id = NEW.user_id;

  RETURN NEW;
END;
$$;
