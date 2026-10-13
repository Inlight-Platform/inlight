BEGIN;
LOCK TABLE public.opportunities IN SHARE ROW EXCLUSIVE MODE;

-- Copy the existing contract, not the raw table's private fields.
CREATE TABLE public.opportunities_public_catalog AS
SELECT id, title, description, type, status, posted_by, company, location, is_remote, compensation, experience_level, roles, requirements, deadline, start_date, duration, tags, is_featured, action_type, image_url, link_url, link_title, is_public, created_at, updated_at FROM public.opportunities_public_browse WITH NO DATA;
ALTER TABLE public.opportunities_public_catalog ADD PRIMARY KEY (id);
ALTER TABLE public.opportunities_public_catalog ADD CHECK (posted_by IS NULL);
ALTER TABLE public.opportunities_public_catalog ADD CHECK (
  (action_type = 'external' AND COALESCE(is_public, false)
    AND NULLIF(BTRIM(link_url), '') IS NOT NULL)
  OR (COALESCE(action_type, 'apply') <> 'external' AND status = 'open'
    AND description = '' AND compensation IS NULL AND roles = ARRAY[]::text[]
    AND requirements = ARRAY[]::text[] AND link_url IS NULL AND link_title IS NULL)
);
ALTER TABLE public.opportunities_public_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.opportunities_public_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.opportunities_public_catalog TO anon, authenticated;
CREATE POLICY "Only sanitized opportunity teasers are readable"
ON public.opportunities_public_catalog FOR SELECT TO anon, authenticated USING (
  posted_by IS NULL AND (
    (action_type = 'external' AND COALESCE(is_public, false)
      AND NULLIF(BTRIM(link_url), '') IS NOT NULL)
    OR (COALESCE(action_type, 'apply') <> 'external' AND status = 'open'
      AND description = '' AND compensation IS NULL AND roles = ARRAY[]::text[]
      AND requirements = ARRAY[]::text[] AND link_url IS NULL AND link_title IS NULL)
  )
);
INSERT INTO public.opportunities_public_catalog
SELECT id, title, description, type, status, posted_by, company, location, is_remote, compensation, experience_level, roles, requirements, deadline, start_date, duration, tags, is_featured, action_type, image_url, link_url, link_title, is_public, created_at, updated_at FROM public.opportunities_public_browse;

CREATE FUNCTION private.sync_opportunity_public_catalog()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_SCHEMA <> 'public' OR TG_TABLE_NAME <> 'opportunities' THEN
    RAISE EXCEPTION 'Unexpected opportunity projection source';
  END IF;
  IF TG_OP = 'TRUNCATE' THEN
    TRUNCATE public.opportunities_public_catalog;
    RETURN NULL;
  END IF;
  IF TG_OP IN ('DELETE', 'UPDATE') THEN
    DELETE FROM public.opportunities_public_catalog WHERE id = OLD.id;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  END IF;
  IF (
    (NEW.action_type = 'external' AND COALESCE(NEW.is_public, false)
      AND NULLIF(BTRIM(NEW.link_url), '') IS NOT NULL)
    OR (COALESCE(NEW.action_type, 'apply') <> 'external' AND NEW.status = 'open')
  ) IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.opportunities_public_catalog (id, title, description, type, status, posted_by, company, location, is_remote, compensation, experience_level, roles, requirements, deadline, start_date, duration, tags, is_featured, action_type, image_url, link_url, link_title, is_public, created_at, updated_at)
  VALUES (
    NEW.id, NEW.title,
    CASE WHEN NEW.action_type = 'external' THEN NEW.description ELSE ''::text END,
    NEW.type, NEW.status, NULL::uuid, NEW.company, NEW.location, NEW.is_remote,
    CASE WHEN NEW.action_type = 'external' THEN NEW.compensation ELSE NULL::text END,
    NEW.experience_level,
    CASE WHEN NEW.action_type = 'external' THEN NEW.roles ELSE ARRAY[]::text[] END,
    CASE WHEN NEW.action_type = 'external' THEN NEW.requirements ELSE ARRAY[]::text[] END,
    NEW.deadline, NEW.start_date, NEW.duration, NEW.tags, NEW.is_featured, NEW.action_type,
    NEW.image_url,
    CASE WHEN NEW.action_type = 'external' THEN NEW.link_url ELSE NULL::text END,
    CASE WHEN NEW.action_type = 'external' THEN NEW.link_title ELSE NULL::text END,
    NEW.is_public, NEW.created_at, NEW.updated_at
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.sync_opportunity_public_catalog() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER sync_opportunity_public_catalog
AFTER INSERT OR UPDATE OR DELETE ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION private.sync_opportunity_public_catalog();
CREATE TRIGGER truncate_opportunity_public_catalog
AFTER TRUNCATE ON public.opportunities
FOR EACH STATEMENT EXECUTE FUNCTION private.sync_opportunity_public_catalog();

CREATE OR REPLACE VIEW public.opportunities_public_browse
WITH (security_invoker = true, security_barrier = true)
AS SELECT id, title, description, type, status, posted_by, company, location, is_remote, compensation, experience_level, roles, requirements, deadline, start_date, duration, tags, is_featured, action_type, image_url, link_url, link_title, is_public, created_at, updated_at FROM public.opportunities_public_catalog;
REVOKE ALL ON public.opportunities_public_browse FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.opportunities_public_browse TO anon, authenticated;
CREATE INDEX ON public.opportunities_public_catalog(created_at DESC);
NOTIFY pgrst, 'reload schema';
COMMIT;
