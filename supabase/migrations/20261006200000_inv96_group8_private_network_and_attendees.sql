BEGIN;

-- INV96 Group 8: public profiles do not imply a public relationship graph,
-- and event attendee identities/counts require an authenticated event viewer.
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Visible connections are viewable by everyone" ON public.connections;
DROP POLICY IF EXISTS "Users can follow others" ON public.connections;
DROP POLICY IF EXISTS "Users can unfollow" ON public.connections;

CREATE POLICY "Authenticated users can view visible connections"
ON public.connections FOR SELECT TO authenticated
USING (
  public.profile_is_visible_to_current_user(follower_id)
  AND public.profile_is_visible_to_current_user(following_id)
);
CREATE POLICY "Users can follow others"
ON public.connections FOR INSERT TO authenticated
WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow"
ON public.connections FOR DELETE TO authenticated
USING (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Events are viewable based on visibility" ON public.events;
DROP POLICY IF EXISTS "Users can create their own events" ON public.events;
DROP POLICY IF EXISTS "Users can update their own events" ON public.events;
DROP POLICY IF EXISTS "Users can delete their own events" ON public.events;
DROP POLICY IF EXISTS "Admins can update any event" ON public.events;
DROP POLICY IF EXISTS "Admins can delete any event" ON public.events;

CREATE POLICY "Events are viewable based on visibility"
ON public.events FOR SELECT TO anon, authenticated
USING (public.can_view_event(events));
CREATE POLICY "Users can create their own events"
ON public.events FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own events"
ON public.events FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own events"
ON public.events FOR DELETE TO authenticated
USING (auth.uid() = user_id);
CREATE POLICY "Admins can update any event"
ON public.events FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete any event"
ON public.events FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users can delete their own RSVP" ON public.event_rsvps;
DROP POLICY IF EXISTS "Authenticated users can RSVP" ON public.event_rsvps;
DROP POLICY IF EXISTS "Admins can view all RSVPs" ON public.event_rsvps;
DROP POLICY IF EXISTS "Event creators and admins can view RSVPs for their events" ON public.event_rsvps;
DROP POLICY IF EXISTS "Event creators can view RSVPs for their events" ON public.event_rsvps;
DROP POLICY IF EXISTS "Users can view their own RSVP" ON public.event_rsvps;
DROP POLICY IF EXISTS "Users can view their own RSVPs" ON public.event_rsvps;
DROP POLICY IF EXISTS "Event creators can update RSVPs for their events" ON public.event_rsvps;
DROP POLICY IF EXISTS "Users can update their own RSVP" ON public.event_rsvps;

CREATE POLICY "RSVP owners event creators and admins can view"
ON public.event_rsvps FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_rsvps.event_id
      AND e.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);
CREATE POLICY "Authenticated users can RSVP"
ON public.event_rsvps FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND event_id IS NOT NULL
  AND NULLIF(BTRIM(name), '') IS NOT NULL
  AND NULLIF(BTRIM(email), '') IS NOT NULL
  AND NULLIF(BTRIM(role_type), '') IS NOT NULL
  AND status IN ('going', 'cant_make_it')
  AND (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_rsvps.event_id
        AND e.event_date >= NOW()
    )
    OR attended IS TRUE
  )
);
CREATE POLICY "Users can update their own RSVP"
ON public.event_rsvps FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_rsvps.event_id
        AND e.event_date >= NOW()
    )
    OR attended IS TRUE
  )
);
CREATE POLICY "Event creators can update RSVPs for their events"
ON public.event_rsvps FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_rsvps.event_id
      AND e.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_rsvps.event_id
      AND e.user_id = auth.uid()
  )
);
CREATE POLICY "Users can delete their own RSVP"
ON public.event_rsvps FOR DELETE TO authenticated
USING (auth.uid() = user_id);

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
    LEFT JOIN public.profiles p ON p.user_id = r.user_id
    WHERE r.event_id = target_event_id
      AND EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = target_event_id
          AND public.can_view_event(e)
      )
  )
  SELECT
    r.id,
    r.event_id,
    CASE WHEN r.should_mask_attendee AND r.user_id IS DISTINCT FROM auth.uid() THEN NULL ELSE r.user_id END,
    CASE WHEN r.should_mask_attendee AND r.user_id IS DISTINCT FROM auth.uid() THEN 'Anonymous attendee' ELSE r.name END,
    r.role_type,
    r.status,
    r.created_at,
    r.should_mask_attendee AND r.user_id IS DISTINCT FROM auth.uid()
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
    LEFT JOIN public.profiles p ON p.user_id = t.user_id
    LEFT JOIN public.profiles_public pp ON pp.user_id = t.user_id
    WHERE t.event_id = target_event_id
      AND t.status IN ('confirmed', 'partially_refunded')
      AND EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = target_event_id
          AND public.can_view_event(e)
      )
  )
  SELECT
    t.id,
    t.event_id,
    CASE WHEN t.should_mask_attendee AND t.user_id IS DISTINCT FROM auth.uid() THEN NULL ELSE t.user_id END,
    CASE WHEN t.should_mask_attendee AND t.user_id IS DISTINCT FROM auth.uid() THEN 'Anonymous attendee' ELSE COALESCE(t.display_name, t.attendee_name, 'Inlight Member') END,
    CASE WHEN t.should_mask_attendee AND t.user_id IS DISTINCT FROM auth.uid() THEN NULL ELSE t.avatar_url END,
    t.created_at,
    t.should_mask_attendee AND t.user_id IS DISTINCT FROM auth.uid()
  FROM masked_tickets t
  ORDER BY t.created_at ASC
$$;

REVOKE ALL ON public.connections FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.event_rsvps FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, DELETE ON public.connections TO authenticated;
GRANT SELECT ON public.events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_rsvps TO authenticated;

REVOKE ALL ON FUNCTION private.get_public_event_rsvps(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_public_event_rsvps(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_public_event_ticket_attendees(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_event_rsvps(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_event_ticket_attendees(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

/*
ROLLBACK (manual; place in a new migration before running):

BEGIN;

DROP POLICY IF EXISTS "Authenticated users can view visible connections" ON public.connections;
DROP POLICY IF EXISTS "Users can follow others" ON public.connections;
DROP POLICY IF EXISTS "Users can unfollow" ON public.connections;
CREATE POLICY "Visible connections are viewable by everyone" ON public.connections FOR SELECT TO PUBLIC USING (public.profile_is_visible_to_current_user(follower_id) AND public.profile_is_visible_to_current_user(following_id));
CREATE POLICY "Users can follow others" ON public.connections FOR INSERT TO PUBLIC WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow" ON public.connections FOR DELETE TO PUBLIC USING (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Events are viewable based on visibility" ON public.events;
DROP POLICY IF EXISTS "Users can create their own events" ON public.events;
DROP POLICY IF EXISTS "Users can update their own events" ON public.events;
DROP POLICY IF EXISTS "Users can delete their own events" ON public.events;
DROP POLICY IF EXISTS "Admins can update any event" ON public.events;
DROP POLICY IF EXISTS "Admins can delete any event" ON public.events;
CREATE POLICY "Events are viewable based on visibility" ON public.events FOR SELECT TO PUBLIC USING (public.can_view_event(events));
CREATE POLICY "Users can create their own events" ON public.events FOR INSERT TO PUBLIC WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own events" ON public.events FOR UPDATE TO PUBLIC USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own events" ON public.events FOR DELETE TO PUBLIC USING (auth.uid() = user_id);
CREATE POLICY "Admins can update any event" ON public.events FOR UPDATE TO PUBLIC USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete any event" ON public.events FOR DELETE TO PUBLIC USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "RSVP owners event creators and admins can view" ON public.event_rsvps;
DROP POLICY IF EXISTS "Authenticated users can RSVP" ON public.event_rsvps;
DROP POLICY IF EXISTS "Users can update their own RSVP" ON public.event_rsvps;
DROP POLICY IF EXISTS "Event creators can update RSVPs for their events" ON public.event_rsvps;
DROP POLICY IF EXISTS "Users can delete their own RSVP" ON public.event_rsvps;
CREATE POLICY "Admins can view all RSVPs" ON public.event_rsvps FOR SELECT TO PUBLIC USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Event creators and admins can view RSVPs for their events" ON public.event_rsvps FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM public.events WHERE id = event_rsvps.event_id) OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Event creators can view RSVPs for their events" ON public.event_rsvps FOR SELECT TO PUBLIC USING (auth.uid() IN (SELECT user_id FROM public.events WHERE id = event_rsvps.event_id));
CREATE POLICY "Users can view their own RSVP" ON public.event_rsvps FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own RSVPs" ON public.event_rsvps FOR SELECT TO PUBLIC USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can RSVP" ON public.event_rsvps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own RSVP" ON public.event_rsvps FOR UPDATE TO PUBLIC USING (auth.uid() = user_id);
CREATE POLICY "Event creators can update RSVPs for their events" ON public.event_rsvps FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_rsvps.event_id AND e.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_rsvps.event_id AND e.user_id = auth.uid()));
CREATE POLICY "Users can delete their own RSVP" ON public.event_rsvps FOR DELETE TO PUBLIC USING (auth.uid() = user_id);

GRANT SELECT ON public.connections TO anon;
GRANT SELECT ON public.events TO anon;
GRANT SELECT ON public.event_rsvps TO anon;
GRANT EXECUTE ON FUNCTION private.get_public_event_rsvps(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_event_rsvps(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_event_ticket_attendees(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
*/
