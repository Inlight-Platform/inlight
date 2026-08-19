-- Event hosts can check in paid ticket holders for events they created.
GRANT UPDATE ON public.tickets TO authenticated;

DROP POLICY IF EXISTS "Event hosts can update ticket check-ins" ON public.tickets;

CREATE POLICY "Event hosts can update ticket check-ins"
  ON public.tickets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = tickets.event_id
        AND e.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = tickets.event_id
        AND e.user_id = auth.uid()
    )
  );

-- Public attendee lists should reveal only profile-safe ticket holder details.
CREATE OR REPLACE FUNCTION public.get_public_event_ticket_attendees(target_event_id uuid)
RETURNS TABLE (
  id uuid,
  event_id uuid,
  user_id uuid,
  name text,
  avatar_url text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.event_id,
    t.user_id,
    COALESCE(pp.display_name, t.attendee_name, 'Inlight Member') AS name,
    pp.avatar_url,
    t.created_at
  FROM public.tickets t
  LEFT JOIN public.profiles_public pp ON pp.user_id = t.user_id
  WHERE t.event_id = target_event_id
    AND t.status = 'confirmed'
  ORDER BY t.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_event_ticket_attendees(uuid) TO anon, authenticated;
