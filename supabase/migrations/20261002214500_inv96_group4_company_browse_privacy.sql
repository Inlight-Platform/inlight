BEGIN;

-- INV96 Group 4: keep company pages public without exposing owner/uploader UUIDs.
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Companies are viewable by everyone" ON public.companies;
DROP POLICY IF EXISTS "Company owners can view their company" ON public.companies;
DROP POLICY IF EXISTS "Admins can view all companies" ON public.companies;

CREATE POLICY "Company owners can view their company"
ON public.companies
FOR SELECT
TO authenticated
USING (auth.uid() = owner_user_id);

CREATE POLICY "Admins can view all companies"
ON public.companies
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Anyone can view company photos" ON public.company_photos;
DROP POLICY IF EXISTS "Company owners can view company photos" ON public.company_photos;

CREATE POLICY "Company owners can view company photos"
ON public.company_photos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.companies
    WHERE companies.id = company_photos.company_id
      AND companies.owner_user_id = auth.uid()
  )
);

DROP VIEW IF EXISTS public.companies_browse;
CREATE VIEW public.companies_browse
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
  brand_accent_color,
  brand_primary_color,
  brand_text_color,
  cover_image_url,
  description,
  fun_facts,
  id,
  location,
  logo_url,
  mission,
  name,
  tagline,
  website_url,
  coalesce(owner_user_id = auth.uid(), false) AS is_owner
FROM public.companies;

REVOKE ALL ON public.companies_browse FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.companies_browse TO anon, authenticated;

DROP FUNCTION IF EXISTS public.get_company_management_context(uuid, text);
CREATE FUNCTION public.get_company_management_context(
  _company_id uuid,
  _staff_token text DEFAULT NULL
)
RETURNS TABLE (owner_user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  is_authorized boolean := false;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.companies
    WHERE companies.id = _company_id
      AND (
        companies.owner_user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
  )
  INTO is_authorized;

  IF NOT is_authorized AND nullif(trim(coalesce(_staff_token, '')), '') IS NOT NULL THEN
    BEGIN
      is_authorized := public.assert_company_staff_token(_staff_token) = _company_id;
    EXCEPTION WHEN OTHERS THEN
      is_authorized := false;
    END;
  END IF;

  IF NOT is_authorized THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT companies.owner_user_id
  FROM public.companies
  WHERE companies.id = _company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_company_management_context(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_management_context(uuid, text) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.get_company_photos_browse(uuid);
CREATE FUNCTION public.get_company_photos_browse(_company_id uuid)
RETURNS TABLE (
  id uuid,
  image_url text,
  caption text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    company_photos.id,
    company_photos.image_url,
    company_photos.caption
  FROM public.company_photos
  WHERE company_photos.company_id = _company_id
  ORDER BY company_photos.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_company_photos_browse(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_photos_browse(uuid) TO anon, authenticated;

COMMIT;

/*
ROLLBACK (manual; place in a new migration before running):

BEGIN;

DROP VIEW IF EXISTS public.companies_browse;
DROP FUNCTION IF EXISTS public.get_company_management_context(uuid, text);
DROP FUNCTION IF EXISTS public.get_company_photos_browse(uuid);

DROP POLICY IF EXISTS "Company owners can view their company" ON public.companies;
DROP POLICY IF EXISTS "Admins can view all companies" ON public.companies;
CREATE POLICY "Companies are viewable by everyone"
ON public.companies
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Company owners can view company photos" ON public.company_photos;
CREATE POLICY "Anyone can view company photos"
ON public.company_photos
FOR SELECT
USING (true);

COMMIT;
*/
