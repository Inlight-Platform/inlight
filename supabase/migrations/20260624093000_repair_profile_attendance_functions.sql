ALTER TABLE public.saved_shows
  ADD COLUMN IF NOT EXISTS attended boolean NOT NULL DEFAULT false;

ALTER TABLE public.saved_shows
  ADD COLUMN IF NOT EXISTS attended_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS saved_shows_attended_idx
  ON public.saved_shows(user_id)
  WHERE attended = true;

CREATE OR REPLACE FUNCTION public.mark_event_attended(_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _email text;
  _name text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = _event_id) THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  SELECT
    COALESCE(u.email, ''),
    COALESCE(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name', u.email, 'Attendee')
  INTO _email, _name
  FROM auth.users u
  WHERE u.id = _user_id;

  INSERT INTO public.event_rsvps (
    event_id,
    user_id,
    name,
    email,
    role_type,
    status,
    attended,
    attended_at
  )
  VALUES (
    _event_id,
    _user_id,
    _name,
    _email,
    'audience',
    'going',
    true,
    now()
  )
  ON CONFLICT (event_id, user_id) WHERE user_id IS NOT NULL
  DO UPDATE SET
    status = 'going',
    attended = true,
    attended_at = COALESCE(public.event_rsvps.attended_at, now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_event_attended(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_show_attended(_show_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.nyc_shows WHERE id = _show_id) THEN
    RAISE EXCEPTION 'Show not found';
  END IF;

  INSERT INTO public.saved_shows (user_id, show_id, attended, attended_at)
  VALUES (_user_id, _show_id, true, now())
  ON CONFLICT (user_id, show_id)
  DO UPDATE SET
    attended = true,
    attended_at = COALESCE(public.saved_shows.attended_at, now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_show_attended(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_profile_attendance(_user_id uuid)
RETURNS TABLE(
  kind text,
  id uuid,
  title text,
  description text,
  image_url text,
  event_date timestamp with time zone,
  location text,
  source text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH attended_events AS (
    SELECT DISTINCT ON (e.id)
      'event'::text AS kind,
      e.id,
      e.title,
      e.description,
      e.image_url,
      e.event_date,
      e.location,
      CASE WHEN t.id IS NOT NULL THEN 'ticket'::text ELSE 'rsvp'::text END AS source
    FROM public.events e
    LEFT JOIN public.event_rsvps r
      ON r.event_id = e.id
      AND r.user_id = _user_id
      AND r.attended = true
    LEFT JOIN public.tickets t
      ON t.event_id = e.id
      AND t.user_id = _user_id
      AND t.checked_in_at IS NOT NULL
    WHERE r.id IS NOT NULL OR t.id IS NOT NULL
    ORDER BY e.id, CASE WHEN t.id IS NOT NULL THEN 0 ELSE 1 END, e.event_date DESC
  ),
  attended_shows AS (
    SELECT
      'show'::text AS kind,
      s.id,
      s.title,
      s.description,
      s.poster_url AS image_url,
      COALESCE(ss.attended_at, s.run_end::timestamp with time zone, s.run_start::timestamp with time zone, ss.saved_at) AS event_date,
      s.venue AS location,
      'show'::text AS source
    FROM public.saved_shows ss
    JOIN public.nyc_shows s ON s.id = ss.show_id
    WHERE ss.user_id = _user_id
      AND ss.attended = true
  )
  SELECT * FROM attended_events
  UNION ALL
  SELECT * FROM attended_shows
  ORDER BY event_date DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_attendance(uuid) TO anon, authenticated;

SELECT pg_notify('pgrst', 'reload schema');
