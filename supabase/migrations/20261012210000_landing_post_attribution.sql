-- A bounded landing preview permits attribution without reopening raw posts
-- or identifying the person behind a Group-authored update.
CREATE OR REPLACE FUNCTION public.get_landing_public_posts()
RETURNS TABLE (
  id uuid,
  content text,
  created_at timestamptz,
  creator_name text,
  creator_avatar text,
  creator_headline text,
  creator_role text,
  graduation_year integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT recent.id, recent.content, recent.created_at,
         recent.display_name, recent.avatar_url, recent.headline,
         recent.role, recent.graduation_year
  FROM (
    SELECT DISTINCT ON (p.user_id)
      p.id, p.content, p.created_at, profile.display_name,
      profile.avatar_url, profile.headline, profile.role,
      profile.graduation_year
    FROM public.posts p
    JOIN public.profiles profile ON profile.user_id = p.user_id
    WHERE p.visibility = 'public'
      AND p.author_identity = 'personal'
      AND profile.hidden_from_public IS NOT TRUE
      AND NULLIF(btrim(profile.display_name), '') IS NOT NULL
      AND NULLIF(btrim(p.content), '') IS NOT NULL
      AND p.content NOT LIKE '🎯%'
    ORDER BY p.user_id, p.created_at DESC, p.id DESC
  ) recent
  ORDER BY recent.created_at DESC, recent.id DESC
  LIMIT 4;
$$;

REVOKE ALL ON FUNCTION public.get_landing_public_posts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_landing_public_posts() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
