-- Apply transactionally: source writes must not race projection backfill.
BEGIN;
LOCK TABLE public.user_films, public.user_music_shows, public.nyc_shows IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE public.catalog_ownership (
  catalog text NOT NULL,
  row_id uuid NOT NULL,
  user_id uuid NOT NULL,
  PRIMARY KEY (catalog, row_id)
);
ALTER TABLE public.catalog_ownership ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.catalog_ownership FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.catalog_ownership TO anon, authenticated;
CREATE POLICY "Users can read only their own catalog ownership"
ON public.catalog_ownership FOR SELECT TO anon, authenticated
USING (user_id = (SELECT auth.uid()));
CREATE INDEX catalog_ownership_user_idx ON public.catalog_ownership(user_id);

CREATE OR REPLACE FUNCTION public.catalog_row_is_owner(_catalog text, _id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.catalog_ownership
    WHERE catalog = _catalog AND row_id = _id AND user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.catalog_row_is_owner(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalog_row_is_owner(text, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.sync_catalog_public_projection()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE target text := TG_TABLE_NAME || '_public_catalog'; assignments text;
BEGIN
  IF TG_TABLE_SCHEMA <> 'public' OR TG_TABLE_NAME NOT IN ('user_films', 'user_music_shows', 'nyc_shows') THEN
    RAISE EXCEPTION 'Unexpected catalog source';
  END IF;
  IF TG_OP = 'TRUNCATE' THEN
    EXECUTE format('TRUNCATE public.%I', target);
    DELETE FROM public.catalog_ownership WHERE catalog = TG_TABLE_NAME;
    RETURN NULL;
  END IF;
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.id <> NEW.id) THEN
    EXECUTE format('DELETE FROM public.%I WHERE id = $1', target) USING OLD.id;
    DELETE FROM public.catalog_ownership WHERE catalog = TG_TABLE_NAME AND row_id = OLD.id;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  END IF;
  SELECT string_agg(format('%I = EXCLUDED.%I', attname, attname), ', ' ORDER BY attnum)
  INTO assignments FROM pg_catalog.pg_attribute
  WHERE attrelid = format('public.%I', target)::regclass
    AND attnum > 0 AND NOT attisdropped AND attname <> 'id';
  -- The record type admits only explicitly projected columns, including when
  -- private source columns are added later.
  EXECUTE format(
    'INSERT INTO public.%1$I SELECT (jsonb_populate_record(NULL::public.%1$I, $1)).* ON CONFLICT (id) DO UPDATE SET %2$s',
    target, assignments
  ) USING to_jsonb(NEW);
  DELETE FROM public.catalog_ownership WHERE catalog = TG_TABLE_NAME AND row_id = NEW.id;
  IF NEW.submitted_by IS NOT NULL THEN
    INSERT INTO public.catalog_ownership(catalog, row_id, user_id)
    VALUES (TG_TABLE_NAME, NEW.id, NEW.submitted_by);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.sync_catalog_public_projection() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE source_name text; safe_columns text; target text;
BEGIN
  FOR source_name, safe_columns IN SELECT * FROM (VALUES
    ('user_films', 'id, title, description, link_url, poster_url, is_anonymous, is_active, created_at, updated_at'),
    ('user_music_shows', 'id, title, description, venue, show_date, ticket_url, is_free, poster_url, is_anonymous, is_active, created_at, updated_at, show_type'),
    ('nyc_shows', 'id, title, venue, borough, description, poster_url, show_type, category, price_tier, run_start, run_end, show_times, accessibility_features, rush_policy, lottery_info, official_url, is_active, created_at, updated_at, is_anonymous, badges')
  ) AS catalogs(name, cols)
  LOOP
    target := source_name || '_public_catalog';
    EXECUTE format('CREATE TABLE public.%I AS SELECT %s FROM public.%I WITH NO DATA', target, safe_columns, source_name);
    EXECUTE format('ALTER TABLE public.%I ADD PRIMARY KEY (id)', target);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', target);
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', target);
    EXECUTE format('CREATE POLICY "Active catalog entries are public" ON public.%I FOR SELECT TO anon, authenticated USING (is_active IS TRUE)', target);
    EXECUTE format('INSERT INTO public.%I SELECT %s FROM public.%I', target, safe_columns, source_name);
    EXECUTE format('INSERT INTO public.catalog_ownership SELECT %L, id, submitted_by FROM public.%I WHERE submitted_by IS NOT NULL', source_name, source_name);
    EXECUTE format('CREATE TRIGGER sync_public_catalog AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.sync_catalog_public_projection()', source_name);
    EXECUTE format('CREATE TRIGGER truncate_public_catalog AFTER TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION private.sync_catalog_public_projection()', source_name);
    EXECUTE format(
      'CREATE OR REPLACE VIEW public.%1$I WITH (security_barrier=true, security_invoker=true) AS SELECT catalog.*, public.catalog_row_is_owner(%2$L, catalog.id) AS is_owner FROM public.%3$I catalog WHERE catalog.is_active IS TRUE',
      source_name || '_browse', source_name, target
    );
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', source_name || '_browse');
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', source_name || '_browse');
  END LOOP;
END;
$$;
NOTIFY pgrst, 'reload schema';
COMMIT;
