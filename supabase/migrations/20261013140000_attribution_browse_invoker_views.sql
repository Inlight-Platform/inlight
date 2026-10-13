BEGIN;
-- Backfill and trigger installation must see the same source state.
LOCK TABLE public.show_teammates, public.show_tips, public.studios,
  public.studio_posts, public.studio_comments IN SHARE ROW EXCLUSIVE MODE;

CREATE FUNCTION private.sync_signed_in_attribution_projection()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE target text := TG_TABLE_NAME || '_signed_in_catalog'; assignments text;
BEGIN
  IF TG_TABLE_SCHEMA <> 'public' OR TG_TABLE_NAME NOT IN
    ('show_teammates', 'show_tips', 'studios', 'studio_posts', 'studio_comments') THEN
    RAISE EXCEPTION 'Unexpected attribution source';
  END IF;
  IF TG_OP = 'TRUNCATE' THEN
    EXECUTE format('TRUNCATE public.%I', target);
    RETURN NULL;
  END IF;
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.id <> NEW.id) THEN
    EXECUTE format('DELETE FROM public.%I WHERE id = $1', target) USING OLD.id;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  END IF;
  SELECT string_agg(format('%I = EXCLUDED.%I', attname, attname), ', ' ORDER BY attnum)
  INTO assignments FROM pg_catalog.pg_attribute
  WHERE attrelid = format('public.%I', target)::regclass
    AND attnum > 0 AND NOT attisdropped AND attname <> 'id';
  -- The destination record type excludes any future private source columns.
  EXECUTE format(
    'INSERT INTO public.%1$I SELECT (jsonb_populate_record(NULL::public.%1$I, $1)).* ON CONFLICT (id) DO UPDATE SET %2$s',
    target, assignments
  ) USING to_jsonb(NEW);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.sync_signed_in_attribution_projection() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE source_name text; safe_columns text; target text;
BEGIN
  FOR source_name, safe_columns IN SELECT * FROM (VALUES
    ('show_teammates', 'id, show_id, user_id, role_description, created_at'),
    ('show_tips', 'id, show_id, user_id, tip_type, content, helpful_count, created_at, updated_at'),
    ('studios', 'id, name, description, icon, created_at, badge_tag'),
    ('studio_posts', 'id, studio_id, user_id, content, image_url, created_at, updated_at'),
    ('studio_comments', 'id, post_id, user_id, content, created_at')
  ) AS catalogs(name, cols)
  LOOP
    target := source_name || '_signed_in_catalog';
    EXECUTE format('CREATE TABLE public.%I AS SELECT %s FROM public.%I WITH NO DATA', target, safe_columns, source_name);
    EXECUTE format('ALTER TABLE public.%I ADD PRIMARY KEY (id)', target);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', target);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', target);
    EXECUTE format('CREATE POLICY "Signed-in users can browse attribution" ON public.%I FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL)', target);
    EXECUTE format('INSERT INTO public.%I SELECT %s FROM public.%I', target, safe_columns, source_name);
    EXECUTE format('CREATE TRIGGER sync_signed_in_catalog AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.sync_signed_in_attribution_projection()', source_name);
    EXECUTE format('CREATE TRIGGER truncate_signed_in_catalog AFTER TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION private.sync_signed_in_attribution_projection()', source_name);
    EXECUTE format('CREATE OR REPLACE VIEW public.%I WITH (security_barrier=true, security_invoker=true) AS SELECT %s FROM public.%I', source_name || '_browse', safe_columns, target);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', source_name || '_browse');
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', source_name || '_browse');
  END LOOP;
END;
$$;
CREATE INDEX ON public.show_teammates_signed_in_catalog(show_id);
CREATE INDEX ON public.show_tips_signed_in_catalog(show_id, created_at DESC);
CREATE INDEX ON public.studios_signed_in_catalog(name);
CREATE INDEX ON public.studio_posts_signed_in_catalog(studio_id, created_at DESC);
CREATE INDEX ON public.studio_comments_signed_in_catalog(post_id, created_at);
NOTIFY pgrst, 'reload schema';
COMMIT;
