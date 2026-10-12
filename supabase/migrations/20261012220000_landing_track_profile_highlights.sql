-- Keep the existing post-only RPC compatible with already deployed clients.
CREATE OR REPLACE FUNCTION public.get_landing_track_cards()
RETURNS TABLE (
  id uuid,
  content text,
  created_at timestamptz,
  creator_name text,
  creator_avatar text,
  creator_headline text,
  creator_role text,
  graduation_year integer,
  is_profile_highlight boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH eligible_profiles AS (
    SELECT profile.* FROM public.profiles profile
    WHERE profile.hidden_from_public IS NOT TRUE
      AND NULLIF(btrim(profile.display_name), '') IS NOT NULL
      AND lower(btrim(profile.display_name)) NOT IN ('inlight', 'inlight social', 'inlight platform')
  ), latest_posts AS (
    SELECT DISTINCT ON (p.user_id)
      p.id, p.user_id, p.content, p.created_at
    FROM public.posts p
    JOIN eligible_profiles profile ON profile.user_id = p.user_id
    WHERE p.visibility = 'public'
      AND p.author_identity = 'personal'
      AND NULLIF(btrim(p.content), '') IS NOT NULL
      AND p.content NOT LIKE '🎯%'
    ORDER BY p.user_id, p.created_at DESC, p.id DESC
  ), selected_posts AS (
    SELECT * FROM latest_posts ORDER BY created_at DESC, id DESC LIMIT 4
  ), highlights AS (
    SELECT profile.* FROM eligible_profiles profile
    WHERE NULLIF(btrim(profile.bio), '') IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM selected_posts p WHERE p.user_id = profile.user_id)
    ORDER BY (NULLIF(btrim(profile.avatar_url), '') IS NOT NULL) DESC,
             profile.activity_score DESC NULLS LAST, profile.user_id
    LIMIT (SELECT 4 - count(*) FROM selected_posts)
  ), cards AS (
    SELECT p.id, p.content, p.created_at, profile.display_name,
           profile.avatar_url, profile.headline, profile.role,
           profile.graduation_year, false AS is_profile_highlight,
           0 AS kind, 0::bigint AS highlight_order
    FROM selected_posts p
    JOIN eligible_profiles profile ON profile.user_id = p.user_id
    UNION ALL
    SELECT profile.id, profile.bio, profile.updated_at, profile.display_name,
           profile.avatar_url, profile.headline, profile.role,
           profile.graduation_year, true, 1,
           row_number() OVER (ORDER BY (NULLIF(btrim(profile.avatar_url), '') IS NOT NULL) DESC,
                             profile.activity_score DESC NULLS LAST, profile.user_id)
    FROM highlights profile
  )
  SELECT cards.id, cards.content, cards.created_at, cards.display_name,
         cards.avatar_url, cards.headline, cards.role, cards.graduation_year,
         cards.is_profile_highlight
  FROM cards
  ORDER BY cards.kind, cards.highlight_order, cards.created_at DESC, cards.id DESC;
$$;

REVOKE ALL ON FUNCTION public.get_landing_track_cards() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_landing_track_cards() TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
