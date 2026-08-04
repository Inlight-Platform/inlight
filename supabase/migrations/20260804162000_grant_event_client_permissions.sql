-- Fresh local database rebuilds need explicit table privileges in addition to RLS policies.
-- Production already has the intended behavior, but this keeps sandbox event creation working.

GRANT SELECT ON public.events TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.events TO authenticated;

GRANT SELECT ON public.event_rsvps TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.event_rsvps TO anon, authenticated;
