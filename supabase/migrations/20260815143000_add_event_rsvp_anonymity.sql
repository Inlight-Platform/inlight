-- Add attendee anonymity controls for public event RSVPs.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS anonymous_event_rsvps boolean NOT NULL DEFAULT false;

ALTER TABLE public.event_rsvps
ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;

DROP FUNCTION IF EXISTS public.get_public_event_rsvps(uuid);
DROP FUNCTION IF EXISTS private.get_public_event_rsvps(uuid);

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
  SELECT * FROM private.get_public_event_rsvps(target_event_id)
$$;

GRANT EXECUTE ON FUNCTION private.get_public_event_rsvps(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_event_rsvps(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
