-- Apply the event attendee-list privacy preference to public paid ticket rows.
DROP FUNCTION IF EXISTS public.get_public_event_ticket_attendees(uuid);

CREATE OR REPLACE FUNCTION public.get_public_event_ticket_attendees(target_event_id uuid)
RETURNS TABLE (
  id uuid,
  event_id uuid,
  user_id uuid,
  name text,
  avatar_url text,
  created_at timestamptz,
  is_anonymous boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH masked_tickets AS (
    SELECT
      t.*,
      pp.display_name,
      pp.avatar_url,
      COALESCE(p.anonymous_event_rsvps, false) AS should_mask_attendee
    FROM public.tickets t
    LEFT JOIN public.profiles p
      ON p.user_id = t.user_id
    LEFT JOIN public.profiles_public pp
      ON pp.user_id = t.user_id
    WHERE t.event_id = target_event_id
      AND t.status = 'confirmed'
  )
  SELECT
    t.id,
    t.event_id,
    CASE
      WHEN t.should_mask_attendee AND t.user_id IS DISTINCT FROM auth.uid() THEN NULL
      ELSE t.user_id
    END AS user_id,
    CASE
      WHEN t.should_mask_attendee AND t.user_id IS DISTINCT FROM auth.uid() THEN 'Anonymous attendee'
      ELSE COALESCE(t.display_name, t.attendee_name, 'Inlight Member')
    END AS name,
    CASE
      WHEN t.should_mask_attendee AND t.user_id IS DISTINCT FROM auth.uid() THEN NULL
      ELSE t.avatar_url
    END AS avatar_url,
    t.created_at,
    t.should_mask_attendee AND t.user_id IS DISTINCT FROM auth.uid() AS is_anonymous
  FROM masked_tickets t
  ORDER BY t.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_event_ticket_attendees(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
