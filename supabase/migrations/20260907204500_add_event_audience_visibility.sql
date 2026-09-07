-- Mirror post audience visibility for events.
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_visibility_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_visibility_check
  CHECK (visibility IN ('public', 'network', 'specific', 'unlisted'));

CREATE TABLE IF NOT EXISTS public.event_recipients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.event_recipients
  ADD CONSTRAINT unique_event_recipient UNIQUE (event_id, recipient_id);

ALTER TABLE public.event_recipients ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.event_recipients TO authenticated;
GRANT ALL ON public.event_recipients TO service_role;

DROP POLICY IF EXISTS "Event owner can insert recipients" ON public.event_recipients;
CREATE POLICY "Event owner can insert recipients"
ON public.event_recipients FOR INSERT
WITH CHECK (
  auth.uid() IN (SELECT user_id FROM public.events WHERE id = event_id)
);

DROP POLICY IF EXISTS "Event owner can delete recipients" ON public.event_recipients;
CREATE POLICY "Event owner can delete recipients"
ON public.event_recipients FOR DELETE
USING (
  auth.uid() IN (SELECT user_id FROM public.events WHERE id = event_id)
);

DROP POLICY IF EXISTS "Event owner and recipients can view" ON public.event_recipients;
CREATE POLICY "Event owner and recipients can view"
ON public.event_recipients FOR SELECT
USING (
  auth.uid() = recipient_id OR
  auth.uid() IN (SELECT user_id FROM public.events WHERE id = event_id)
);

CREATE OR REPLACE FUNCTION public.can_view_event(event_row public.events)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN event_row.visibility = 'public' THEN true
    WHEN event_row.visibility = 'unlisted' THEN true
    WHEN event_row.user_id = auth.uid() THEN true
    WHEN public.has_role(auth.uid(), 'admin') THEN true
    WHEN event_row.visibility = 'network' THEN EXISTS (
      SELECT 1 FROM connections c1
      INNER JOIN connections c2
        ON c1.follower_id = c2.following_id
        AND c1.following_id = c2.follower_id
      WHERE c1.follower_id = event_row.user_id
        AND c1.following_id = auth.uid()
    )
    WHEN event_row.visibility = 'specific' THEN EXISTS (
      SELECT 1 FROM event_recipients
      WHERE event_id = event_row.id
        AND recipient_id = auth.uid()
    )
    ELSE false
  END
$$;

DROP POLICY IF EXISTS "Events are viewable by everyone" ON public.events;
DROP POLICY IF EXISTS "Events are viewable based on visibility" ON public.events;

CREATE POLICY "Events are viewable based on visibility"
ON public.events FOR SELECT
USING (public.can_view_event(events));

CREATE INDEX IF NOT EXISTS idx_event_recipients_event_id
  ON public.event_recipients(event_id);

CREATE INDEX IF NOT EXISTS idx_event_recipients_recipient_id
  ON public.event_recipients(recipient_id);

NOTIFY pgrst, 'reload schema';
