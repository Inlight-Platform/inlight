BEGIN;
LOCK TABLE public.projects, public.project_roles IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE public.project_roles_public_catalog AS
SELECT id, role_name, project_id, project_title, project_deadline, created_at
FROM public.project_roles_public_browse WITH NO DATA;
ALTER TABLE public.project_roles_public_catalog ADD PRIMARY KEY (id);
ALTER TABLE public.project_roles_public_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_roles_public_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.project_roles_public_catalog TO anon, authenticated;
-- Only sanitized, eligible rows are stored here; clients cannot populate it.
CREATE POLICY "Public unfilled role teasers are readable"
ON public.project_roles_public_catalog FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.project_roles_public_catalog
SELECT id, role_name, project_id, project_title, project_deadline, created_at
FROM public.project_roles_public_browse;

CREATE FUNCTION private.sync_project_role_public_catalog()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_SCHEMA <> 'public' OR TG_TABLE_NAME NOT IN ('projects', 'project_roles') THEN
    RAISE EXCEPTION 'Unexpected project-role projection source';
  END IF;
  IF TG_OP = 'TRUNCATE' THEN
    TRUNCATE public.project_roles_public_catalog;
    RETURN NULL;
  END IF;
  IF TG_TABLE_NAME = 'projects' THEN
    DELETE FROM public.project_roles_public_catalog WHERE project_id = OLD.id;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    IF COALESCE(NEW.is_public, false) THEN
      INSERT INTO public.project_roles_public_catalog
      SELECT r.id, r.role_name, NEW.id, NEW.title, NEW.end_date, r.created_at
      FROM public.project_roles r WHERE r.project_id = NEW.id AND r.assigned_user_id IS NULL;
    END IF;
  ELSE
    -- Serialize child changes with parent metadata/privacy updates. NO KEY UPDATE
    -- remains compatible with the foreign key's KEY SHARE lock.
    IF TG_OP = 'UPDATE' THEN
      PERFORM p.id FROM public.projects p
      WHERE p.id IN (OLD.project_id, NEW.project_id)
      ORDER BY p.id FOR NO KEY UPDATE;
    ELSIF TG_OP = 'INSERT' THEN
      PERFORM p.id FROM public.projects p WHERE p.id = NEW.project_id FOR NO KEY UPDATE;
    ELSE
      PERFORM p.id FROM public.projects p WHERE p.id = OLD.project_id FOR NO KEY UPDATE;
    END IF;
    IF TG_OP IN ('DELETE', 'UPDATE') THEN
      DELETE FROM public.project_roles_public_catalog WHERE id = OLD.id;
      IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    END IF;
    INSERT INTO public.project_roles_public_catalog
    SELECT NEW.id, NEW.role_name, p.id, p.title, p.end_date, NEW.created_at
    FROM public.projects p
    WHERE p.id = NEW.project_id AND COALESCE(p.is_public, false)
      AND NEW.assigned_user_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.sync_project_role_public_catalog() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER sync_project_role_public_catalog
AFTER INSERT OR UPDATE OR DELETE ON public.project_roles
FOR EACH ROW EXECUTE FUNCTION private.sync_project_role_public_catalog();
CREATE TRIGGER sync_project_public_role_metadata
AFTER UPDATE OF id, title, end_date, is_public OR DELETE ON public.projects
FOR EACH ROW EXECUTE FUNCTION private.sync_project_role_public_catalog();
CREATE TRIGGER truncate_project_role_public_catalog
AFTER TRUNCATE ON public.project_roles
FOR EACH STATEMENT EXECUTE FUNCTION private.sync_project_role_public_catalog();
CREATE TRIGGER truncate_project_public_roles
AFTER TRUNCATE ON public.projects
FOR EACH STATEMENT EXECUTE FUNCTION private.sync_project_role_public_catalog();

CREATE OR REPLACE VIEW public.project_roles_public_browse
WITH (security_invoker = true, security_barrier = true)
AS SELECT id, role_name, project_id, project_title, project_deadline, created_at
FROM public.project_roles_public_catalog;
REVOKE ALL ON public.project_roles_public_browse FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.project_roles_public_browse TO anon, authenticated;
CREATE INDEX ON public.project_roles_public_catalog(project_id);
CREATE INDEX ON public.project_roles_public_catalog(created_at DESC);
NOTIFY pgrst, 'reload schema';
COMMIT;
