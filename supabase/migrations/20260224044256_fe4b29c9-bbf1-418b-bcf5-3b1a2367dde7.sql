-- Prevent duplicate RSVPs from the same authenticated user
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_event_rsvp ON public.event_rsvps (event_id, user_id) WHERE user_id IS NOT NULL;