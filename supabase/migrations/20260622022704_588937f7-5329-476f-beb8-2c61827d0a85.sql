
-- Allow anon to read projects linked to a company (read-only)
CREATE POLICY "Anyone can view company-linked projects"
  ON public.projects FOR SELECT
  TO anon
  USING (company_id IS NOT NULL);

-- Allow anon to view profiles_public rows (view already has security_invoker; relax base policy via a definer wrapper instead)
-- We avoid loosening profiles RLS; instead expose a definer function.

-- Allow anon to view project_members and project_roles for company-linked projects
CREATE POLICY "Anyone can view members of company-linked projects"
  ON public.project_members FOR SELECT
  TO anon
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_members.project_id AND p.company_id IS NOT NULL
  ));

CREATE POLICY "Anyone can view roles of company-linked projects"
  ON public.project_roles FOR SELECT
  TO anon
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_roles.project_id AND p.company_id IS NOT NULL
  ));

-- SECURITY DEFINER function to return public-safe profile data for a set of user_ids
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
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.display_name, p.stage_name, p.avatar_url, p.cover_url,
         p.headline, p.bio, p.location, p.pronouns, p.role, p.badges, p.skills,
         p.instagram_url, p.website_url, p.graduation_year, p.graduation_status
  FROM public.profiles p
  WHERE p.user_id = ANY(_user_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO anon, authenticated;

-- Optional helper: list staff (owner + members of any company-linked project) for a company
CREATE OR REPLACE FUNCTION public.get_company_staff_ids(_company_id uuid)
RETURNS TABLE (user_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT u FROM (
    SELECT owner_user_id AS u FROM public.companies WHERE id = _company_id AND owner_user_id IS NOT NULL
    UNION
    SELECT pm.user_id AS u
    FROM public.project_members pm
    JOIN public.projects pr ON pr.id = pm.project_id
    WHERE pr.company_id = _company_id
  ) s WHERE u IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_staff_ids(uuid) TO anon, authenticated;
