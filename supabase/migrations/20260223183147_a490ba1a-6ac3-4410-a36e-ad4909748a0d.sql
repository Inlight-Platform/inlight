
ALTER TABLE public.events ADD COLUMN custom_question TEXT DEFAULT NULL;

-- Also allow unauthenticated users to RSVP (public events)
DROP POLICY IF EXISTS "Authenticated users can RSVP" ON public.event_rsvps;
CREATE POLICY "Anyone can RSVP" ON public.event_rsvps FOR INSERT WITH CHECK (true);

-- Add custom_answer column to event_rsvps
ALTER TABLE public.event_rsvps ADD COLUMN custom_answer TEXT DEFAULT NULL;
