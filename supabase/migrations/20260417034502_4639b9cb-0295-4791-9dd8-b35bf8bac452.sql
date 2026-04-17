
-- 1. Add columns to tickets
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS ticket_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checked_in_by UUID,
  ADD COLUMN IF NOT EXISTS attendee_name TEXT,
  ADD COLUMN IF NOT EXISTS attendee_email TEXT,
  ADD COLUMN IF NOT EXISTS attendee_role TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'paid';

-- Backfill ticket_code for existing rows
UPDATE public.tickets SET ticket_code = encode(gen_random_bytes(12), 'hex') WHERE ticket_code IS NULL;

-- Make stripe_session_id nullable (free RSVPs don't have one)
ALTER TABLE public.tickets ALTER COLUMN stripe_session_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_ticket_code ON public.tickets(ticket_code);
CREATE INDEX IF NOT EXISTS idx_tickets_event_id ON public.tickets(event_id);

-- 2. event_rsvps.attended
ALTER TABLE public.event_rsvps
  ADD COLUMN IF NOT EXISTS attended BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attended_at TIMESTAMPTZ;

-- 3. RLS: allow event creators and admins to view tickets for their events
DROP POLICY IF EXISTS "Event creators and admins can view event tickets" ON public.tickets;
CREATE POLICY "Event creators and admins can view event tickets"
ON public.tickets FOR SELECT
USING (
  auth.uid() IN (SELECT user_id FROM public.events WHERE id = tickets.event_id)
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Event creators and admins can update tickets for check-in" ON public.tickets;
CREATE POLICY "Event creators and admins can update tickets for check-in"
ON public.tickets FOR UPDATE
USING (
  auth.uid() IN (SELECT user_id FROM public.events WHERE id = tickets.event_id)
  OR public.has_role(auth.uid(), 'admin')
);

-- Allow event creators and admins to update RSVPs (for attended flag) on their events
DROP POLICY IF EXISTS "Event creators and admins can update rsvps for their events" ON public.event_rsvps;
CREATE POLICY "Event creators and admins can update rsvps for their events"
ON public.event_rsvps FOR UPDATE
USING (
  auth.uid() IN (SELECT user_id FROM public.events WHERE id = event_rsvps.event_id)
  OR public.has_role(auth.uid(), 'admin')
);

-- 4. Function: generate unique ticket code
CREATE OR REPLACE FUNCTION public.generate_ticket_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_code TEXT;
  exists_count INT;
BEGIN
  LOOP
    new_code := encode(gen_random_bytes(12), 'hex');
    SELECT COUNT(*) INTO exists_count FROM public.tickets WHERE ticket_code = new_code;
    EXIT WHEN exists_count = 0;
  END LOOP;
  RETURN new_code;
END;
$$;

-- 5. Trigger: auto-set ticket_code on insert if missing
CREATE OR REPLACE FUNCTION public.set_ticket_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ticket_code IS NULL THEN
    NEW.ticket_code := public.generate_ticket_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_ticket_code ON public.tickets;
CREATE TRIGGER trg_set_ticket_code
BEFORE INSERT ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.set_ticket_code();

-- 6. Trigger: when an RSVP is created/updated to 'going', auto-create a free ticket
CREATE OR REPLACE FUNCTION public.create_ticket_for_free_rsvp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  evt RECORD;
  existing_ticket_id UUID;
BEGIN
  IF NEW.status <> 'going' THEN
    RETURN NEW;
  END IF;

  SELECT id, is_paid INTO evt FROM public.events WHERE id = NEW.event_id;
  -- Skip if paid event — Stripe webhook handles those
  IF evt.is_paid THEN
    RETURN NEW;
  END IF;

  -- If user already has a ticket for this event, do nothing
  IF NEW.user_id IS NOT NULL THEN
    SELECT id INTO existing_ticket_id FROM public.tickets
    WHERE event_id = NEW.event_id AND user_id = NEW.user_id LIMIT 1;
    IF existing_ticket_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.tickets (
    event_id, user_id, status, amount_paid,
    attendee_name, attendee_email, attendee_role, source
  ) VALUES (
    NEW.event_id,
    NEW.user_id,
    'confirmed',
    0,
    NEW.name,
    NEW.email,
    NEW.role_type,
    'free_rsvp'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_ticket_for_free_rsvp ON public.event_rsvps;
CREATE TRIGGER trg_create_ticket_for_free_rsvp
AFTER INSERT OR UPDATE OF status ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.create_ticket_for_free_rsvp();

-- Allow free-RSVP tickets without a user (guest RSVPs) — RLS for INSERT
DROP POLICY IF EXISTS "Anyone can have ticket auto-created via RSVP" ON public.tickets;
-- We rely on the SECURITY DEFINER trigger, so no broad insert policy needed.

-- Existing tickets table needed an INSERT policy for users buying via Stripe (server-side uses service role).
-- No additional INSERT policy required from clients.

-- 7. Trigger: when ticket is checked in, mark RSVP as attended
CREATE OR REPLACE FUNCTION public.mark_rsvp_attended()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.checked_in_at IS NOT NULL AND (OLD.checked_in_at IS NULL) THEN
    -- Match RSVP by user_id first, fallback to email
    IF NEW.user_id IS NOT NULL THEN
      UPDATE public.event_rsvps
      SET attended = true, attended_at = NEW.checked_in_at
      WHERE event_id = NEW.event_id AND user_id = NEW.user_id;
    ELSIF NEW.attendee_email IS NOT NULL THEN
      UPDATE public.event_rsvps
      SET attended = true, attended_at = NEW.checked_in_at
      WHERE event_id = NEW.event_id AND email = NEW.attendee_email;
    END IF;

    -- Bump activity score for attended user
    IF NEW.user_id IS NOT NULL THEN
      PERFORM public.bump_activity_score(NEW.user_id, 3);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_rsvp_attended ON public.tickets;
CREATE TRIGGER trg_mark_rsvp_attended
AFTER UPDATE OF checked_in_at ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.mark_rsvp_attended();
