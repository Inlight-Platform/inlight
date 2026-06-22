-- Hide designated internal test accounts from public discovery while keeping
-- them visible to themselves and to other hidden test accounts.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hidden_from_public boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_hidden_from_public
  ON public.profiles (hidden_from_public, user_id);

UPDATE public.profiles
SET hidden_from_public = true
WHERE lower(email) IN (
  'clelyfernandes@outlook.com',
  'clelyfdes@gmail.com',
  'cleyferndes19@gmail.com',
  'clelyfernandes19@gmail.com',
  'cvf9554@nyu',
  'cvf9554@nyu.edu'
);

CREATE OR REPLACE FUNCTION public.current_user_can_view_hidden_profiles()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles viewer
    WHERE viewer.user_id = auth.uid()
      AND viewer.hidden_from_public IS TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.profile_is_visible_to_current_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT
      p.hidden_from_public IS NOT TRUE
      OR p.user_id = auth.uid()
      OR public.current_user_can_view_hidden_profiles()
    FROM public.profiles p
    WHERE p.user_id = _user_id
  ), false);
$$;

GRANT EXECUTE ON FUNCTION public.current_user_can_view_hidden_profiles() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.profile_is_visible_to_current_user(uuid) TO anon, authenticated;

DROP VIEW IF EXISTS public.profiles_public CASCADE;

CREATE VIEW public.profiles_public
WITH (security_invoker = true)
AS
SELECT
  id,
  user_id,
  display_name,
  stage_name,
  avatar_url,
  cover_url,
  location,
  role,
  badges,
  bio,
  headline,
  skills,
  instagram_url,
  website_url,
  graduation_status,
  graduation_year,
  created_at,
  updated_at,
  activity_score,
  vouch_count,
  favorite_movie,
  favorite_artist,
  favorite_song,
  why_artist,
  CASE WHEN show_union_status THEN union_status ELSE NULL END AS union_status,
  CASE WHEN show_representation THEN representation ELSE NULL END AS representation,
  CASE WHEN show_gear_list THEN gear_list ELSE NULL END AS gear_list_display,
  show_union_status,
  show_representation,
  show_gear_list
FROM public.profiles
WHERE public.profile_is_visible_to_current_user(user_id);

GRANT SELECT ON public.profiles_public TO anon, authenticated;

DROP POLICY IF EXISTS "Authenticated users can view other profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view visible profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view visible profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.profile_is_visible_to_current_user(user_id));

DROP POLICY IF EXISTS "Connections are viewable by everyone" ON public.connections;
DROP POLICY IF EXISTS "Visible connections are viewable by everyone" ON public.connections;
CREATE POLICY "Visible connections are viewable by everyone"
ON public.connections
FOR SELECT
USING (
  public.profile_is_visible_to_current_user(follower_id)
  AND public.profile_is_visible_to_current_user(following_id)
);

CREATE OR REPLACE FUNCTION private.get_mutual_connections(target_user_id uuid)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c1.following_id AS user_id
  FROM connections c1
  INNER JOIN connections c2
    ON c1.follower_id = c2.following_id
    AND c1.following_id = c2.follower_id
  WHERE c1.follower_id = target_user_id
    AND public.profile_is_visible_to_current_user(target_user_id)
    AND public.profile_is_visible_to_current_user(c1.following_id);
$$;

CREATE OR REPLACE FUNCTION private.get_2nd_degree_connections(target_user_id uuid)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH first_degree AS (
    SELECT c1.following_id AS user_id
    FROM connections c1
    INNER JOIN connections c2
      ON c1.follower_id = c2.following_id
      AND c1.following_id = c2.follower_id
    WHERE c1.follower_id = target_user_id
      AND public.profile_is_visible_to_current_user(target_user_id)
      AND public.profile_is_visible_to_current_user(c1.following_id)
  )
  SELECT DISTINCT c1.following_id AS user_id
  FROM first_degree fd
  INNER JOIN connections c1 ON c1.follower_id = fd.user_id
  INNER JOIN connections c2
    ON c1.follower_id = c2.following_id
    AND c1.following_id = c2.follower_id
  WHERE c1.following_id != target_user_id
    AND c1.following_id NOT IN (SELECT user_id FROM first_degree)
    AND public.profile_is_visible_to_current_user(c1.following_id);
$$;

CREATE OR REPLACE FUNCTION private.can_view_post(post_row public.posts)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.profile_is_visible_to_current_user(post_row.user_id)
    AND CASE
      WHEN post_row.visibility = 'public' THEN true
      WHEN post_row.user_id = auth.uid() THEN true
      WHEN post_row.visibility = 'network' THEN EXISTS (
        SELECT 1
        FROM connections c1
        INNER JOIN connections c2
          ON c1.follower_id = c2.following_id
          AND c1.following_id = c2.follower_id
        WHERE c1.follower_id = post_row.user_id
          AND c1.following_id = auth.uid()
      )
      WHEN post_row.visibility = 'specific' THEN EXISTS (
        SELECT 1
        FROM post_recipients
        WHERE post_id = post_row.id
          AND recipient_id = auth.uid()
      )
      ELSE false
    END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_profiles(_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  display_name text,
  stage_name text,
  avatar_url text,
  cover_url text,
  headline text,
  bio text,
  location text,
  pronouns text,
  role text,
  badges text[],
  skills text[],
  instagram_url text,
  website_url text,
  graduation_year integer,
  graduation_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.display_name, p.stage_name, p.avatar_url, p.cover_url,
         p.headline, p.bio, p.location, NULL::text AS pronouns, p.role, p.badges, p.skills,
         p.instagram_url, p.website_url, p.graduation_year, p.graduation_status
  FROM public.profiles p
  WHERE p.user_id = ANY(_user_ids)
    AND public.profile_is_visible_to_current_user(p.user_id);
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
