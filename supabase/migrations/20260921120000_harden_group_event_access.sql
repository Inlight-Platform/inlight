-- Keep attendee summaries and RSVP creation inside the same audience boundary
-- as the event itself, including private department events.

CREATE OR REPLACE FUNCTION private.get_public_event_rsvps(target_event_id uuid)
RETURNS TABLE (
  id uuid,
  event_id uuid,
  user_id uuid,
  name text,
  role_type text,
  status text,
  created_at timestamptz,
  is_anonymous boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH masked_rsvps AS (
    SELECT
      r.*,
      COALESCE(r.is_anonymous, false) OR COALESCE(p.anonymous_event_rsvps, false) AS should_mask_attendee
    FROM public.event_rsvps r
    LEFT JOIN public.profiles p
      ON p.user_id = r.user_id
    WHERE r.event_id = target_event_id
      AND EXISTS (
        SELECT 1
        FROM public.events e
        WHERE e.id = target_event_id
          AND public.can_view_event(e)
      )
  )
  SELECT
    r.id,
    r.event_id,
    CASE
      WHEN r.should_mask_attendee AND r.user_id IS DISTINCT FROM auth.uid() THEN NULL
      ELSE r.user_id
    END AS user_id,
    CASE
      WHEN r.should_mask_attendee AND r.user_id IS DISTINCT FROM auth.uid() THEN 'Anonymous attendee'
      ELSE r.name
    END AS name,
    r.role_type,
    r.status,
    r.created_at,
    r.should_mask_attendee AND r.user_id IS DISTINCT FROM auth.uid() AS is_anonymous
  FROM masked_rsvps r
  ORDER BY r.created_at ASC
$$;

REVOKE ALL ON FUNCTION private.get_public_event_rsvps(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_event_rsvps(target_event_id uuid)
RETURNS TABLE (
  id uuid,
  event_id uuid,
  user_id uuid,
  name text,
  role_type text,
  status text,
  created_at timestamptz,
  is_anonymous boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT *
  FROM private.get_public_event_rsvps(target_event_id)
$$;

REVOKE ALL ON FUNCTION public.get_public_event_rsvps(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_event_rsvps(uuid) TO anon, authenticated;

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
      AND t.status IN ('confirmed', 'partially_refunded')
      AND EXISTS (
        SELECT 1
        FROM public.events e
        WHERE e.id = target_event_id
          AND public.can_view_event(e)
      )
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
  ORDER BY t.created_at ASC
$$;

REVOKE ALL ON FUNCTION public.get_public_event_ticket_attendees(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_event_ticket_attendees(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Authenticated users can RSVP" ON public.event_rsvps;
CREATE POLICY "Authenticated users can RSVP"
ON public.event_rsvps
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND event_id IS NOT NULL
  AND NULLIF(BTRIM(name), '') IS NOT NULL
  AND NULLIF(BTRIM(email), '') IS NOT NULL
  AND NULLIF(BTRIM(role_type), '') IS NOT NULL
  AND status IN ('going', 'cant_make_it')
  AND EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = event_rsvps.event_id
      AND public.can_view_event(e)
      AND (e.event_date >= NOW() OR event_rsvps.attended IS TRUE)
  )
);

NOTIFY pgrst, 'reload schema';
