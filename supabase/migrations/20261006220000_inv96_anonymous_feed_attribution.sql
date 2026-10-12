BEGIN;

-- Signed-out browse surfaces may expose public content, but never the author or
-- creator identifier. Authenticated callers continue to use the base tables.
CREATE OR REPLACE VIEW public.posts_public_browse
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
  p.id,
  p.content,
  p.image_url,
  p.image_urls,
  p.image_position_x,
  p.image_position_y,
  p.image_zoom,
  p.image_positions,
  p.link_url,
  p.link_title,
  p.visibility,
  p.created_at,
  p.updated_at
FROM public.posts p
WHERE p.visibility = 'public';

CREATE OR REPLACE VIEW public.events_public_browse
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
  e.id,
  e.slug,
  e.title,
  e.description,
  e.event_date,
  e.event_type,
  e.image_url,
  e.image_urls,
  e.image_position_x,
  e.image_position_y,
  e.image_zoom,
  e.image_positions,
  e.link_url,
  e.link_title,
  e.location,
  e.is_paid,
  e.price,
  e.currency,
  e.stripe_price_id,
  e.payment_link_url,
  e.custom_question,
  e.visibility,
  e.created_at,
  e.updated_at
FROM public.events e
WHERE e.visibility = 'public';

REVOKE ALL ON public.posts_public_browse FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.events_public_browse FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.posts_public_browse TO anon, authenticated;
GRANT SELECT ON public.events_public_browse TO anon, authenticated;

REVOKE SELECT ON public.posts FROM anon;
REVOKE SELECT ON public.events FROM anon;

-- Public profile pages can still show one member's public activity. These RPCs
-- accept the profile being viewed but omit the creator identifier from results.
CREATE OR REPLACE FUNCTION public.get_public_profile_posts(_user_id uuid)
RETURNS SETOF public.posts_public_browse
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT browse.*
  FROM public.posts p
  JOIN public.posts_public_browse browse ON browse.id = p.id
  WHERE p.user_id = _user_id
    AND p.visibility = 'public'
  ORDER BY p.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_public_profile_events(_user_id uuid)
RETURNS SETOF public.events_public_browse
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT browse.*
  FROM public.events e
  JOIN public.events_public_browse browse ON browse.id = e.id
  WHERE e.user_id = _user_id
    AND e.visibility = 'public'
  ORDER BY e.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_public_profile_posts(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_public_profile_events(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profile_posts(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profile_events(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

/*
ROLLBACK (manual; place in a new migration before running):

BEGIN;

DROP FUNCTION IF EXISTS public.get_public_profile_events(uuid);
DROP FUNCTION IF EXISTS public.get_public_profile_posts(uuid);
DROP VIEW IF EXISTS public.events_public_browse;
DROP VIEW IF EXISTS public.posts_public_browse;
GRANT SELECT ON public.events TO anon;
GRANT SELECT ON public.posts TO anon;

NOTIFY pgrst, 'reload schema';

COMMIT;
*/
