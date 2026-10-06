-- Let scoped department admins review attendance for events linked to their
-- department. Check-in writes use narrow RPCs so payment and RSVP details
-- cannot be changed through broader table update grants.

DROP POLICY IF EXISTS "Scoped group admins can view linked event RSVPs" ON public.event_rsvps;
CREATE POLICY "Scoped group admins can view linked event RSVPs"
ON public.event_rsvps
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.event_groups eg
    WHERE eg.event_id = event_rsvps.event_id
      AND public.is_scoped_group_admin(auth.uid(), eg.group_id)
  )
);

DROP POLICY IF EXISTS "Scoped group admins can view linked event tickets" ON public.tickets;
CREATE POLICY "Scoped group admins can view linked event tickets"
ON public.tickets
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.event_groups eg
    WHERE eg.event_id = tickets.event_id
      AND public.is_scoped_group_admin(auth.uid(), eg.group_id)
  )
);

CREATE OR REPLACE FUNCTION public.set_group_event_rsvp_attendance(
  _event_id uuid,
  _rsvp_id uuid,
  _attended boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.event_groups eg
    WHERE eg.event_id = _event_id
      AND public.is_scoped_group_admin(auth.uid(), eg.group_id)
  ) THEN
    RAISE EXCEPTION 'You do not have permission to manage attendance for this event';
  END IF;

  UPDATE public.event_rsvps
  SET
    attended = _attended,
    attended_at = CASE WHEN _attended THEN now() ELSE NULL END
  WHERE id = _rsvp_id
    AND event_id = _event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RSVP not found for this event';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_group_event_ticket_check_in(
  _event_id uuid,
  _ticket_id uuid,
  _attended boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.event_groups eg
    WHERE eg.event_id = _event_id
      AND public.is_scoped_group_admin(auth.uid(), eg.group_id)
  ) THEN
    RAISE EXCEPTION 'You do not have permission to manage attendance for this event';
  END IF;

  UPDATE public.tickets
  SET
    checked_in_at = CASE WHEN _attended THEN now() ELSE NULL END,
    checked_in_by = CASE WHEN _attended THEN auth.uid() ELSE NULL END
  WHERE id = _ticket_id
    AND event_id = _event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found for this event';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_group_event_rsvp_attendance(uuid, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_group_event_ticket_check_in(uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_group_event_rsvp_attendance(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_group_event_ticket_check_in(uuid, uuid, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
