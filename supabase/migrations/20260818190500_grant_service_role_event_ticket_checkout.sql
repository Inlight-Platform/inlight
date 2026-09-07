-- Trusted Edge Functions need table privileges in addition to RLS bypass.
GRANT SELECT, UPDATE ON public.events TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.tickets TO service_role;
