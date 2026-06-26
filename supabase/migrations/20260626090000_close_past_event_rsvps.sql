-- Close ordinary RSVPs once an event's scheduled date has passed.
-- Keep the attended-history path available for users marking past events attended.
DROP POLICY IF EXISTS "Anyone can RSVP" ON public.event_rsvps;

CREATE POLICY "Anyone can RSVP"
ON public.event_rsvps
FOR INSERT
WITH CHECK (
  event_id IS NOT NULL
  AND NULLIF(BTRIM(name), '') IS NOT NULL
  AND NULLIF(BTRIM(email), '') IS NOT NULL
  AND NULLIF(BTRIM(role_type), '') IS NOT NULL
  AND status IN ('going', 'cant_make_it')
  AND (user_id IS NULL OR auth.uid() = user_id)
  AND (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_rsvps.event_id
        AND e.event_date >= NOW()
    )
    OR (
      attended IS TRUE
      AND user_id IS NOT NULL
      AND auth.uid() = user_id
    )
  )
);

DROP POLICY IF EXISTS "Users can update their own RSVP" ON public.event_rsvps;

CREATE POLICY "Users can update their own RSVP"
ON public.event_rsvps
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_rsvps.event_id
        AND e.event_date >= NOW()
    )
    OR attended IS TRUE
  )
);
