-- Run the entire script as database administrator in the target SQL Editor.
-- No placeholders or data mutations are required.
BEGIN READ ONLY;
DO $$
DECLARE source_name text; safe_columns text; target text; relation_name text;
  mismatch boolean; counts jsonb := '{}'::jsonb; rows bigint; actual_columns text[];
BEGIN
  FOR source_name, safe_columns IN SELECT * FROM (VALUES
    ('posts', 'id, content, image_url, image_urls, image_position_x, image_position_y, image_zoom, image_positions, link_url, link_title, visibility, created_at, updated_at'),
    ('events', 'id, slug, title, description, event_date, event_type, image_url, image_urls, image_position_x, image_position_y, image_zoom, image_positions, link_url, link_title, location, is_paid, price, currency, stripe_price_id, payment_link_url, custom_question, visibility, created_at, updated_at')
  ) AS catalogs(name, cols)
  LOOP
    target := source_name || '_public_catalog';
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = format('public.%I', source_name || '_public_browse')::regclass
      AND 'security_invoker=true' = ANY(reloptions) AND 'security_barrier=true' = ANY(reloptions)) THEN
      RAISE EXCEPTION 'View options incorrect: %', source_name;
    END IF;
    FOREACH relation_name IN ARRAY ARRAY[target, source_name || '_public_browse'] LOOP
      SELECT array_agg(attname::text ORDER BY attnum) INTO actual_columns FROM pg_attribute
      WHERE attrelid = format('public.%I', relation_name)::regclass AND attnum > 0 AND NOT attisdropped;
      IF actual_columns IS DISTINCT FROM string_to_array(safe_columns, ', ') THEN
        RAISE EXCEPTION 'Public columns incorrect: %', relation_name;
      END IF;
    END LOOP;
    EXECUTE format('SELECT EXISTS (SELECT to_jsonb(s) FROM (SELECT %2$s FROM public.%1$I WHERE visibility = %4$L) s EXCEPT SELECT to_jsonb(c) FROM public.%3$I c) OR EXISTS (SELECT to_jsonb(c) FROM public.%3$I c EXCEPT SELECT to_jsonb(s) FROM (SELECT %2$s FROM public.%1$I WHERE visibility = %4$L) s)',
      source_name, safe_columns, target, 'public') INTO mismatch;
    IF mismatch THEN RAISE EXCEPTION 'Source/projection fields mismatch: %', source_name; END IF;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE visibility = %L', source_name, 'public') INTO rows;
    counts := counts || jsonb_build_object(source_name, rows);
  END LOOP;
  PERFORM set_config('public_feed_test.counts', counts::text, true);
END $$;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ DECLARE source_name text; relation_name text; rows bigint; privilege text; BEGIN
  FOREACH source_name IN ARRAY ARRAY['posts', 'events'] LOOP
    BEGIN
      EXECUTE format('SELECT * FROM public.%I LIMIT 1', source_name);
      RAISE EXCEPTION 'Anonymous source read allowed: %', source_name;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    FOREACH relation_name IN ARRAY ARRAY[source_name || '_public_catalog', source_name || '_public_browse'] LOOP
      EXECUTE format('SELECT count(*) FROM public.%I', relation_name) INTO rows;
      IF rows <> (current_setting('public_feed_test.counts')::jsonb ->> source_name)::bigint THEN
        RAISE EXCEPTION 'Anonymous public count mismatch: %', relation_name;
      END IF;
      FOREACH privilege IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] LOOP
        IF has_table_privilege('anon', 'public.' || relation_name, privilege)
          OR has_table_privilege('authenticated', 'public.' || relation_name, privilege) THEN
          RAISE EXCEPTION 'Client public write grant: % %', relation_name, privilege;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
RESET ROLE;
SELECT 'Public feed checks passed' AS result,
  current_setting('public_feed_test.counts')::jsonb AS public_counts;
ROLLBACK;
