CREATE OR REPLACE FUNCTION public.slugify_title(input_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF(
      regexp_replace(
        regexp_replace(lower(trim(input_text)), '[^a-z0-9]+', '-', 'g'),
        '(^-|-$)',
        '',
        'g'
      ),
      ''
    ),
    'untitled'
  );
$$;

CREATE OR REPLACE FUNCTION public.generate_unique_slug(base_title text, target_table text, current_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug text := public.slugify_title(base_title);
  candidate text := base_slug;
  suffix integer := 2;
  slug_exists boolean;
BEGIN
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE slug = $1 AND id <> $2)', target_table)
    INTO slug_exists
    USING candidate, current_id;

    EXIT WHEN NOT slug_exists;

    candidate := base_slug || '-' || suffix;
    suffix := suffix + 1;
  END LOOP;

  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_public_content_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    NEW.slug := public.generate_unique_slug(NEW.title, TG_TABLE_NAME, NEW.id);
  ELSE
    NEW.slug := public.generate_unique_slug(NEW.slug, TG_TABLE_NAME, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS slug text;

CREATE UNIQUE INDEX IF NOT EXISTS events_slug_key ON public.events (slug) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS projects_slug_key ON public.projects (slug) WHERE slug IS NOT NULL;

DO $$
DECLARE
  row_record record;
BEGIN
  FOR row_record IN SELECT id, title FROM public.events WHERE slug IS NULL LOOP
    UPDATE public.events
    SET slug = public.generate_unique_slug(row_record.title, 'events', row_record.id)
    WHERE id = row_record.id;
  END LOOP;

  FOR row_record IN SELECT id, title FROM public.projects WHERE slug IS NULL LOOP
    UPDATE public.projects
    SET slug = public.generate_unique_slug(row_record.title, 'projects', row_record.id)
    WHERE id = row_record.id;
  END LOOP;
END $$;

ALTER TABLE public.events ALTER COLUMN slug SET NOT NULL;
ALTER TABLE public.projects ALTER COLUMN slug SET NOT NULL;

DROP TRIGGER IF EXISTS assign_events_slug ON public.events;
CREATE TRIGGER assign_events_slug
BEFORE INSERT OR UPDATE OF slug
ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.assign_public_content_slug();

DROP TRIGGER IF EXISTS assign_projects_slug ON public.projects;
CREATE TRIGGER assign_projects_slug
BEFORE INSERT OR UPDATE OF slug
ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.assign_public_content_slug();
