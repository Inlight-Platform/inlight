BEGIN;
LOCK TABLE public.posts, public.events IN SHARE ROW EXCLUSIVE MODE;

CREATE FUNCTION private.sync_public_feed_projection()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE target text := TG_TABLE_NAME || '_public_catalog'; assignments text;
BEGIN
  IF TG_TABLE_SCHEMA <> 'public' OR TG_TABLE_NAME NOT IN ('posts', 'events') THEN
    RAISE EXCEPTION 'Unexpected public feed source';
  END IF;
  IF TG_OP = 'TRUNCATE' THEN
    EXECUTE format('TRUNCATE public.%I', target);
    RETURN NULL;
  END IF;
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.id <> NEW.id) THEN
    EXECUTE format('DELETE FROM public.%I WHERE id = $1', target) USING OLD.id;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  END IF;
  -- Non-public content is never stored in the public projection.
  IF NEW.visibility IS DISTINCT FROM 'public' THEN
    EXECUTE format('DELETE FROM public.%I WHERE id = $1', target) USING NEW.id;
    RETURN NEW;
  END IF;
  SELECT string_agg(format('%I = EXCLUDED.%I', attname, attname), ', ' ORDER BY attnum)
  INTO assignments FROM pg_catalog.pg_attribute
  WHERE attrelid = format('public.%I', target)::regclass
    AND attnum > 0 AND NOT attisdropped AND attname <> 'id';
  EXECUTE format(
    'INSERT INTO public.%1$I SELECT (jsonb_populate_record(NULL::public.%1$I, $1)).* ON CONFLICT (id) DO UPDATE SET %2$s',
    target, assignments
  ) USING to_jsonb(NEW);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.sync_public_feed_projection() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE source_name text; safe_columns text; target text;
BEGIN
  FOR source_name, safe_columns IN SELECT * FROM (VALUES
    ('posts', 'id, content, image_url, image_urls, image_position_x, image_position_y, image_zoom, image_positions, link_url, link_title, visibility, created_at, updated_at'),
    ('events', 'id, slug, title, description, event_date, event_type, image_url, image_urls, image_position_x, image_position_y, image_zoom, image_positions, link_url, link_title, location, is_paid, price, currency, stripe_price_id, payment_link_url, custom_question, visibility, created_at, updated_at')
  ) AS catalogs(name, cols)
  LOOP
    target := source_name || '_public_catalog';
    EXECUTE format('CREATE TABLE public.%I AS SELECT %s FROM public.%I WITH NO DATA', target, safe_columns, source_name);
    EXECUTE format('ALTER TABLE public.%I ADD PRIMARY KEY (id)', target);
    EXECUTE format('ALTER TABLE public.%I ADD CHECK (visibility IS NOT NULL AND visibility = %L)', target, 'public');
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', target);
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', target);
    EXECUTE format('CREATE POLICY "Only public feed rows can be browsed" ON public.%I FOR SELECT TO anon, authenticated USING (visibility = %L)', target, 'public');
    EXECUTE format('INSERT INTO public.%I SELECT %s FROM public.%I WHERE visibility = %L', target, safe_columns, source_name, 'public');
    EXECUTE format('CREATE TRIGGER sync_public_feed_catalog AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.sync_public_feed_projection()', source_name);
    EXECUTE format('CREATE TRIGGER truncate_public_feed_catalog AFTER TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION private.sync_public_feed_projection()', source_name);
    EXECUTE format('CREATE OR REPLACE VIEW public.%I WITH (security_barrier=true, security_invoker=true) AS SELECT %s FROM public.%I WHERE visibility = %L', source_name || '_public_browse', safe_columns, target, 'public');
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', source_name || '_public_browse');
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', source_name || '_public_browse');
  END LOOP;
END;
$$;
CREATE INDEX ON public.posts_public_catalog(created_at DESC);
CREATE INDEX ON public.events_public_catalog(created_at DESC);
CREATE INDEX ON public.events_public_catalog(event_date);
CREATE INDEX ON public.events_public_catalog(slug);
NOTIFY pgrst, 'reload schema';
COMMIT;
