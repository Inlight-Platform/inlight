BEGIN;

-- Team identities on branded company pages are management-only. Anonymous and
-- unrelated authenticated callers receive no rows.
CREATE OR REPLACE FUNCTION public.get_company_team_browse(_company_id uuid)
RETURNS TABLE (
  member_key text,
  display_name text,
  stage_name text,
  avatar_url text,
  role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  WITH company_users AS (
    SELECT companies.owner_user_id AS user_id, true AS is_owner, NULL::text AS project_role
    FROM public.companies
    WHERE companies.id = _company_id
      AND companies.owner_user_id IS NOT NULL

    UNION ALL

    SELECT project_members.user_id, false, project_members.role
    FROM public.project_members
    JOIN public.projects ON projects.id = project_members.project_id
    WHERE projects.company_id = _company_id
  ),
  distinct_users AS (
    SELECT
      company_users.user_id,
      bool_or(company_users.is_owner) AS is_owner,
      max(company_users.project_role) AS project_role
    FROM company_users
    GROUP BY company_users.user_id
  ),
  profile_team AS (
    SELECT
      encode(
        extensions.digest(_company_id::text || ':' || profiles.user_id::text, 'sha256'),
        'hex'
      ) AS member_key,
      coalesce(profiles.display_name, profiles.stage_name, 'Team member') AS display_name,
      profiles.stage_name,
      profiles.avatar_url,
      CASE
        WHEN distinct_users.is_owner THEN 'Owner'
        ELSE coalesce(distinct_users.project_role, profiles.role, 'Team')
      END AS role,
      0 AS sort_group
    FROM distinct_users
    JOIN public.profiles ON profiles.user_id = distinct_users.user_id
  ),
  named_invited_staff AS (
    SELECT
      NULL::text AS member_key,
      trim(company_staff_access.staff_name) AS display_name,
      NULL::text AS stage_name,
      NULL::text AS avatar_url,
      'Staff'::text AS role,
      1 AS sort_group
    FROM public.company_staff_access
    WHERE company_staff_access.company_id = _company_id
      AND company_staff_access.revoked_at IS NULL
      AND nullif(trim(coalesce(company_staff_access.staff_name, '')), '') IS NOT NULL
  ),
  managed_team AS (
    SELECT * FROM profile_team
    UNION ALL
    SELECT * FROM named_invited_staff
  )
  SELECT
    managed_team.member_key,
    managed_team.display_name,
    managed_team.stage_name,
    managed_team.avatar_url,
    managed_team.role
  FROM managed_team
  WHERE EXISTS (
    SELECT 1
    FROM public.companies
    WHERE companies.id = _company_id
      AND (
        companies.owner_user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
  )
  ORDER BY managed_team.sort_group, managed_team.display_name;
$$;

REVOKE ALL ON FUNCTION public.get_company_team_browse(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_team_browse(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_company_team_member_browse(
  _company_id uuid,
  _member_key text
)
RETURNS TABLE (
  display_name text,
  stage_name text,
  avatar_url text,
  cover_url text,
  headline text,
  bio text,
  location text,
  role text,
  skills text[],
  instagram_url text,
  website_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  WITH company_users AS (
    SELECT companies.owner_user_id AS user_id, true AS is_owner, NULL::text AS project_role
    FROM public.companies
    WHERE companies.id = _company_id
      AND companies.owner_user_id IS NOT NULL

    UNION ALL

    SELECT project_members.user_id, false, project_members.role
    FROM public.project_members
    JOIN public.projects ON projects.id = project_members.project_id
    WHERE projects.company_id = _company_id
  ),
  distinct_users AS (
    SELECT
      company_users.user_id,
      bool_or(company_users.is_owner) AS is_owner,
      max(company_users.project_role) AS project_role
    FROM company_users
    GROUP BY company_users.user_id
  )
  SELECT
    coalesce(profiles.display_name, profiles.stage_name, 'Team member') AS display_name,
    profiles.stage_name,
    profiles.avatar_url,
    profiles.cover_url,
    profiles.headline,
    profiles.bio,
    profiles.location,
    CASE
      WHEN distinct_users.is_owner THEN 'Owner'
      ELSE coalesce(distinct_users.project_role, profiles.role, 'Team')
    END AS role,
    profiles.skills,
    profiles.instagram_url,
    profiles.website_url
  FROM distinct_users
  JOIN public.profiles ON profiles.user_id = distinct_users.user_id
  WHERE EXISTS (
    SELECT 1
    FROM public.companies
    WHERE companies.id = _company_id
      AND (
        companies.owner_user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
  )
    AND encode(
      extensions.digest(_company_id::text || ':' || profiles.user_id::text, 'sha256'),
      'hex'
    ) = _member_key
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_company_team_member_browse(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_team_member_browse(uuid, text) TO anon, authenticated;

COMMIT;

/*
ROLLBACK (manual; place in a new migration before running):

BEGIN;

-- Restore the definitions from
-- 20261002224500_inv96_group4_hide_team_from_anonymous.sql, which expose the
-- presentation-only Team section to every authenticated caller.

COMMIT;
*/
