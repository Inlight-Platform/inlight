DO $$ DECLARE source_name text; client_role text; privilege text; mismatch boolean; BEGIN
  FOREACH source_name IN ARRAY ARRAY['posts', 'events'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = format('public.%I', source_name || '_public_browse')::regclass
      AND 'security_invoker=true' = ANY(reloptions)) THEN
      RAISE EXCEPTION 'Public feed view not invoker: %', source_name;
    END IF;
    EXECUTE format('SELECT EXISTS (SELECT fields FROM expected_%1$s_feed EXCEPT SELECT to_jsonb(c) FROM public.%2$I c) OR EXISTS (SELECT to_jsonb(c) FROM public.%2$I c EXCEPT SELECT fields FROM expected_%1$s_feed)', source_name, source_name || '_public_browse') INTO mismatch;
    IF mismatch THEN RAISE EXCEPTION 'Public data changed: %', source_name; END IF;
    EXECUTE format('SELECT EXISTS (SELECT attname, atttypid, atttypmod, attnum FROM expected_%1$s_feed_columns EXCEPT SELECT attname, atttypid, atttypmod, attnum FROM pg_attribute WHERE attrelid = %2$L::regclass AND attnum > 0 AND NOT attisdropped)', source_name, 'public.' || source_name || '_public_browse') INTO mismatch;
    IF mismatch THEN RAISE EXCEPTION 'Column contract changed: %', source_name; END IF;
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE visibility IS DISTINCT FROM %L OR id::text IN (%L, %L, %L, %L))', source_name || '_public_catalog', 'public',
      'e2000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000003', 'e2000000-0000-4000-8000-000000000004', 'e2000000-0000-4000-8000-000000000005') INTO mismatch;
    IF mismatch THEN RAISE EXCEPTION 'Non-public rows stored in projection: %', source_name; END IF;
    FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      FOREACH privilege IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] LOOP
        IF has_table_privilege(client_role, 'public.' || source_name || '_public_catalog', privilege)
          OR has_table_privilege(client_role, 'public.' || source_name || '_public_browse', privilege) THEN
          RAISE EXCEPTION 'Client projection write grant: % % %', client_role, source_name, privilege;
        END IF;
      END LOOP;
      IF has_function_privilege(client_role, 'private.sync_public_feed_projection()', 'EXECUTE') THEN
        RAISE EXCEPTION 'Client can execute synchronization function';
      END IF;
    END LOOP;
  END LOOP;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000001', true);
UPDATE public.posts SET content = 'Owner post edit', image_url = 'https://example.test/photo.jpg'
WHERE id = 'e2000000-0000-4000-8000-000000000001';
UPDATE public.events SET title = 'Owner event edit', location = 'Edited venue'
WHERE id = 'e2000000-0000-4000-8000-000000000001';
INSERT INTO public.posts(id, user_id, content, visibility) VALUES
 ('e2000000-0000-4000-8000-000000000006', auth.uid(), 'New public post', 'public'),
 ('e2000000-0000-4000-8000-000000000007', auth.uid(), 'New non-public post', 'network');
INSERT INTO public.events(id, user_id, title, event_date, visibility) VALUES
 ('e2000000-0000-4000-8000-000000000006', auth.uid(), 'New public event', '2099-02-01', 'public'),
 ('e2000000-0000-4000-8000-000000000007', auth.uid(), 'New non-public event', '2099-02-01', 'network');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ DECLARE source_name text; rows integer; BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.posts_public_browse WHERE id = 'e2000000-0000-4000-8000-000000000001' AND content = 'Owner post edit' AND image_url = 'https://example.test/photo.jpg')
    OR NOT EXISTS (SELECT 1 FROM public.events_public_browse WHERE id = 'e2000000-0000-4000-8000-000000000001' AND title = 'Owner event edit' AND location = 'Edited venue') THEN
    RAISE EXCEPTION 'Owner edits did not synchronize';
  END IF;
  FOREACH source_name IN ARRAY ARRAY['posts', 'events'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id IN ($1, $2)', source_name || '_public_catalog') INTO rows
      USING 'e2000000-0000-4000-8000-000000000006'::uuid, 'e2000000-0000-4000-8000-000000000007'::uuid;
    IF rows <> 1 THEN RAISE EXCEPTION 'Public/non-public insert boundary failed: %', source_name; END IF;
  END LOOP;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000001', true);
DO $$ DECLARE source_name text; BEGIN
  FOREACH source_name IN ARRAY ARRAY['posts', 'events'] LOOP
    EXECUTE format('UPDATE public.%I SET visibility = $1 WHERE id = $2', source_name)
      USING 'network', 'e2000000-0000-4000-8000-000000000001'::uuid;
    EXECUTE format('UPDATE public.%I SET visibility = $1 WHERE id = $2', source_name)
      USING 'public', 'e2000000-0000-4000-8000-000000000002'::uuid;
  END LOOP;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ DECLARE source_name text; rows integer; BEGIN
  FOREACH source_name IN ARRAY ARRAY['posts', 'events'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id = $1', source_name || '_public_catalog') INTO rows
      USING 'e2000000-0000-4000-8000-000000000001'::uuid;
    IF rows <> 0 THEN RAISE EXCEPTION 'Withdrawn public content retained: %', source_name; END IF;
    EXECUTE format('SELECT count(*) FROM public.%I($1) WHERE id = $2', 'get_public_profile_' || source_name) INTO rows
      USING 'e1000000-0000-4000-8000-000000000001'::uuid, 'e2000000-0000-4000-8000-000000000001'::uuid;
    IF rows <> 0 THEN RAISE EXCEPTION 'Withdrawn profile activity leaked: %', source_name; END IF;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id = $1', source_name || '_public_browse') INTO rows
      USING 'e2000000-0000-4000-8000-000000000002'::uuid;
    IF rows <> 1 THEN RAISE EXCEPTION 'Newly public content missing: %', source_name; END IF;
  END LOOP;
END $$;
RESET ROLE;
-- Test future private columns, non-public transitions, and key changes without
-- changing source policy semantics. All privileged mutations roll back.
DO $$ DECLARE source_name text; leaked boolean; visibility_value text; BEGIN
  FOREACH source_name IN ARRAY ARRAY['posts', 'events'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN public_feed_test_secret text', source_name);
    EXECUTE format('UPDATE public.%I SET public_feed_test_secret = $1 WHERE id = $2', source_name)
      USING 'Private sentinel', 'e2000000-0000-4000-8000-000000000002'::uuid;
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I c WHERE to_jsonb(c) ? $1 OR to_jsonb(c) ? $2)', source_name || '_public_catalog')
      INTO leaked USING 'public_feed_test_secret', 'user_id';
    IF leaked THEN RAISE EXCEPTION 'Private source field leaked: %', source_name; END IF;
    FOREACH visibility_value IN ARRAY ARRAY['group', 'specific', 'network'] LOOP
      EXECUTE format('UPDATE public.%I SET visibility = $1 WHERE id = $2', source_name)
        USING visibility_value, 'e2000000-0000-4000-8000-000000000002'::uuid;
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE id = $1)', source_name || '_public_catalog') INTO leaked
        USING 'e2000000-0000-4000-8000-000000000002'::uuid;
      IF leaked THEN RAISE EXCEPTION 'Visibility transition leaked: % %', source_name, visibility_value; END IF;
      EXECUTE format('UPDATE public.%I SET visibility = $1 WHERE id = $2', source_name)
        USING 'public', 'e2000000-0000-4000-8000-000000000002'::uuid;
    END LOOP;
  END LOOP;
END $$;
UPDATE public.events SET visibility = 'private' WHERE id = 'e2000000-0000-4000-8000-000000000002';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.events_public_catalog WHERE id = 'e2000000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'Private event retained';
  END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000001', true);
DELETE FROM public.posts WHERE id = 'e2000000-0000-4000-8000-000000000006';
DELETE FROM public.events WHERE id = 'e2000000-0000-4000-8000-000000000006';
RESET ROLE;
DO $$ DECLARE source_name text; exists_row boolean; BEGIN
  FOREACH source_name IN ARRAY ARRAY['posts', 'events'] LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE id = $1)', source_name || '_public_catalog') INTO exists_row
      USING 'e2000000-0000-4000-8000-000000000006'::uuid;
    IF exists_row THEN RAISE EXCEPTION 'Deleted row retained: %', source_name; END IF;
    EXECUTE format('UPDATE public.%I SET visibility = $1 WHERE id = $2', source_name)
      USING 'public', 'e2000000-0000-4000-8000-000000000002'::uuid;
    EXECUTE format('UPDATE public.%I SET id = $1 WHERE id = $2', source_name)
      USING 'e2000000-0000-4000-8000-000000000009'::uuid, 'e2000000-0000-4000-8000-000000000002'::uuid;
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE id = $1)', source_name || '_public_catalog') INTO exists_row
      USING 'e2000000-0000-4000-8000-000000000002'::uuid;
    IF exists_row THEN RAISE EXCEPTION 'Old primary key retained: %', source_name; END IF;
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE id = $1)', source_name || '_public_catalog') INTO exists_row
      USING 'e2000000-0000-4000-8000-000000000009'::uuid;
    IF NOT exists_row THEN RAISE EXCEPTION 'New primary key missing: %', source_name; END IF;
    EXECUTE format('TRUNCATE public.%I CASCADE', source_name);
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I)', source_name || '_public_catalog') INTO exists_row;
    IF exists_row THEN RAISE EXCEPTION 'Truncate did not synchronize: %', source_name; END IF;
  END LOOP;
END $$;
