BEGIN;
LOCK TABLE public.projects IN SHARE ROW EXCLUSIVE MODE;

-- Metadata and attribution have different visitor permissions.
CREATE TABLE public.projects_browse_catalog AS
SELECT category, created_at, description, end_date, header_image_url, id, link_title, link_url, main_image_url, slug, start_date, status, title, visibility FROM public.projects WITH NO DATA;
ALTER TABLE public.projects_browse_catalog ADD PRIMARY KEY (id);
ALTER TABLE public.projects_browse_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.projects_browse_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.projects_browse_catalog TO anon, authenticated;
CREATE POLICY "Existing project browse audience"
ON public.projects_browse_catalog FOR SELECT TO anon, authenticated
USING (public.can_browse_project(id));

CREATE TABLE public.projects_browse_attribution AS
SELECT id, creator_id, author_identity, author_group_id FROM public.projects WITH NO DATA;
ALTER TABLE public.projects_browse_attribution ADD PRIMARY KEY (id);
ALTER TABLE public.projects_browse_attribution ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.projects_browse_attribution FROM PUBLIC, anon, authenticated;
-- Invoker joins need SELECT, but RLS exposes no attribution rows to anon.
GRANT SELECT ON public.projects_browse_attribution TO anon, authenticated;
CREATE POLICY "Signed-in accessible project attribution"
ON public.projects_browse_attribution FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL AND public.can_browse_project(id));

INSERT INTO public.projects_browse_catalog
SELECT category, created_at, description, end_date, header_image_url, id, link_title, link_url, main_image_url, slug, start_date, status, title, visibility FROM public.projects;
INSERT INTO public.projects_browse_attribution
SELECT id, creator_id, author_identity, author_group_id FROM public.projects;

CREATE FUNCTION private.sync_projects_browse_catalog()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_SCHEMA <> 'public' OR TG_TABLE_NAME <> 'projects' THEN
    RAISE EXCEPTION 'Unexpected project browse source';
  END IF;
  IF TG_OP = 'TRUNCATE' THEN
    TRUNCATE public.projects_browse_catalog, public.projects_browse_attribution;
    RETURN NULL;
  END IF;
  IF TG_OP IN ('DELETE', 'UPDATE') THEN
    DELETE FROM public.projects_browse_catalog WHERE id = OLD.id;
    DELETE FROM public.projects_browse_attribution WHERE id = OLD.id;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  END IF;
  INSERT INTO public.projects_browse_catalog (category, created_at, description, end_date, header_image_url, id, link_title, link_url, main_image_url, slug, start_date, status, title, visibility)
  VALUES (NEW.category, NEW.created_at, NEW.description, NEW.end_date, NEW.header_image_url, NEW.id, NEW.link_title, NEW.link_url, NEW.main_image_url, NEW.slug, NEW.start_date, NEW.status, NEW.title, NEW.visibility);
  INSERT INTO public.projects_browse_attribution (id, creator_id, author_identity, author_group_id)
  VALUES (NEW.id, NEW.creator_id, NEW.author_identity, NEW.author_group_id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.sync_projects_browse_catalog() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER sync_projects_browse_catalog
AFTER INSERT OR UPDATE OR DELETE ON public.projects
FOR EACH ROW EXECUTE FUNCTION private.sync_projects_browse_catalog();
CREATE TRIGGER truncate_projects_browse_catalog
AFTER TRUNCATE ON public.projects
FOR EACH STATEMENT EXECUTE FUNCTION private.sync_projects_browse_catalog();

CREATE OR REPLACE VIEW public.projects_browse
WITH (security_invoker = true, security_barrier = true)
AS SELECT
  p.category, p.created_at,
  CASE WHEN auth.uid() IS NULL THEN NULL ELSE a.creator_id END AS creator_id,
  p.description, p.end_date, p.header_image_url, p.id, p.link_title, p.link_url,
  p.main_image_url, p.slug, p.start_date, p.status, p.title, p.visibility,
  CASE WHEN auth.uid() IS NULL THEN NULL ELSE a.author_identity END AS author_identity,
  CASE WHEN auth.uid() IS NULL THEN NULL ELSE a.author_group_id END AS author_group_id
FROM public.projects_browse_catalog p
LEFT JOIN public.projects_browse_attribution a ON a.id = p.id;
REVOKE ALL ON public.projects_browse FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.projects_browse TO anon, authenticated;
CREATE INDEX ON public.projects_browse_catalog(created_at DESC);
CREATE INDEX ON public.projects_browse_catalog(slug);
NOTIFY pgrst, 'reload schema';
COMMIT;
