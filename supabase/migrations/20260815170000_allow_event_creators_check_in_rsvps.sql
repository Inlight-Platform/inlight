-- Event creators need to manage check-in state for their own event RSVPs.
DROP POLICY IF EXISTS "Event creators can update RSVPs for their events" ON public.event_rsvps;

CREATE POLICY "Event creators can update RSVPs for their events"
ON public.event_rsvps
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = event_rsvps.event_id
      AND e.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = event_rsvps.event_id
      AND e.user_id = auth.uid()
  )
);
