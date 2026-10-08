BEGIN;

-- Attendance must not bypass the event's Groups audience boundary.
DROP POLICY IF EXISTS "Authenticated users can RSVP" ON public.event_rsvps;
CREATE POLICY "Authenticated users can RSVP"
ON public.event_rsvps FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND event_id IS NOT NULL
  AND NULLIF(BTRIM(name), '') IS NOT NULL
  AND NULLIF(BTRIM(email), '') IS NOT NULL
  AND NULLIF(BTRIM(role_type), '') IS NOT NULL
  AND status IN ('going', 'cant_make_it')
  AND EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_rsvps.event_id
      AND public.can_view_event(e)
      AND (e.event_date >= NOW() OR event_rsvps.attended IS TRUE)
  )
);

NOTIFY pgrst, 'reload schema';
COMMIT;
