-- Ticket RLS policies define row access; these grants let clients use them.
GRANT SELECT, INSERT ON public.tickets TO authenticated;
