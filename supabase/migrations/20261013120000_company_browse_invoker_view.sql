BEGIN;
-- Keep source writes from racing the initial public projection backfill.
LOCK TABLE public.companies IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE public.companies_public_catalog AS
SELECT brand_accent_color, brand_primary_color, brand_text_color,
  cover_image_url, description, fun_facts, id, location, logo_url,
  mission, name, tagline, website_url
FROM public.companies WITH NO DATA;
ALTER TABLE public.companies_public_catalog ADD PRIMARY KEY (id);
ALTER TABLE public.companies_public_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.companies_public_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.companies_public_catalog TO anon, authenticated;
CREATE POLICY "Company catalog fields are public"
ON public.companies_public_catalog FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.companies_public_catalog
SELECT brand_accent_color, brand_primary_color, brand_text_color,
  cover_image_url, description, fun_facts, id, location, logo_url,
  mission, name, tagline, website_url FROM public.companies;
INSERT INTO public.catalog_ownership(catalog, row_id, user_id)
SELECT 'companies', id, owner_user_id FROM public.companies WHERE owner_user_id IS NOT NULL;

CREATE FUNCTION private.sync_company_public_projection()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_SCHEMA <> 'public' OR TG_TABLE_NAME <> 'companies' THEN
    RAISE EXCEPTION 'Unexpected company source';
  END IF;
  IF TG_OP = 'TRUNCATE' THEN
    TRUNCATE public.companies_public_catalog;
    DELETE FROM public.catalog_ownership WHERE catalog = 'companies';
    RETURN NULL;
  END IF;
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.id <> NEW.id) THEN
    DELETE FROM public.companies_public_catalog WHERE id = OLD.id;
    DELETE FROM public.catalog_ownership WHERE catalog = 'companies' AND row_id = OLD.id;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  END IF;
  INSERT INTO public.companies_public_catalog
    (brand_accent_color, brand_primary_color, brand_text_color, cover_image_url,
     description, fun_facts, id, location, logo_url, mission, name, tagline, website_url)
  VALUES (NEW.brand_accent_color, NEW.brand_primary_color, NEW.brand_text_color,
    NEW.cover_image_url, NEW.description, NEW.fun_facts, NEW.id, NEW.location,
    NEW.logo_url, NEW.mission, NEW.name, NEW.tagline, NEW.website_url)
  ON CONFLICT (id) DO UPDATE SET
    brand_accent_color = EXCLUDED.brand_accent_color,
    brand_primary_color = EXCLUDED.brand_primary_color,
    brand_text_color = EXCLUDED.brand_text_color,
    cover_image_url = EXCLUDED.cover_image_url,
    description = EXCLUDED.description, fun_facts = EXCLUDED.fun_facts,
    location = EXCLUDED.location, logo_url = EXCLUDED.logo_url,
    mission = EXCLUDED.mission, name = EXCLUDED.name,
    tagline = EXCLUDED.tagline, website_url = EXCLUDED.website_url;
  DELETE FROM public.catalog_ownership WHERE catalog = 'companies' AND row_id = NEW.id;
  IF NEW.owner_user_id IS NOT NULL THEN
    INSERT INTO public.catalog_ownership(catalog, row_id, user_id)
    VALUES ('companies', NEW.id, NEW.owner_user_id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.sync_company_public_projection() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER sync_company_public_catalog
AFTER INSERT OR UPDATE OR DELETE ON public.companies
FOR EACH ROW EXECUTE FUNCTION private.sync_company_public_projection();
CREATE TRIGGER truncate_company_public_catalog AFTER TRUNCATE ON public.companies
FOR EACH STATEMENT EXECUTE FUNCTION private.sync_company_public_projection();

CREATE OR REPLACE VIEW public.companies_browse
WITH (security_barrier = true, security_invoker = true)
AS SELECT catalog.*, public.catalog_row_is_owner('companies', catalog.id) AS is_owner
FROM public.companies_public_catalog catalog;
REVOKE ALL ON public.companies_browse FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.companies_browse TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
