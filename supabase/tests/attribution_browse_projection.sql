DO $$ DECLARE source_name text; client_role text; privilege text; mismatch boolean; BEGIN
  FOREACH source_name IN ARRAY ARRAY['show_teammates', 'show_tips', 'studios', 'studio_posts', 'studio_comments'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = format('public.%I', source_name || '_browse')::regclass
      AND 'security_invoker=true' = ANY(reloptions)) THEN
      RAISE EXCEPTION 'View not invoker: %', source_name;
    END IF;
    EXECUTE format('SELECT EXISTS (SELECT fields FROM expected_%1$s_rows EXCEPT SELECT to_jsonb(c) FROM public.%1$I_browse c) OR EXISTS (SELECT to_jsonb(c) FROM public.%1$I_browse c EXCEPT SELECT fields FROM expected_%1$s_rows)', source_name)
      INTO mismatch;
    IF mismatch THEN RAISE EXCEPTION 'Browse data changed: %', source_name; END IF;
    EXECUTE format('SELECT EXISTS (SELECT attname, atttypid, atttypmod, attnum FROM expected_%1$s_columns EXCEPT SELECT attname, atttypid, atttypmod, attnum FROM pg_attribute WHERE attrelid = %2$L::regclass AND attnum > 0 AND NOT attisdropped)', source_name, 'public.' || source_name || '_browse')
      INTO mismatch;
    IF mismatch THEN RAISE EXCEPTION 'Column contract changed: %', source_name; END IF;
    FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      FOREACH privilege IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] LOOP
        IF has_table_privilege(client_role, 'public.' || source_name || '_signed_in_catalog', privilege)
          OR has_table_privilege(client_role, 'public.' || source_name || '_browse', privilege) THEN
          RAISE EXCEPTION 'Client browse write grant: % % %', client_role, source_name, privilege;
        END IF;
      END LOOP;
      IF has_function_privilege(client_role, 'private.sync_signed_in_attribution_projection()', 'EXECUTE') THEN
        RAISE EXCEPTION 'Client can call synchronization function';
      END IF;
    END LOOP;
  END LOOP;
END $$;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ DECLARE source_name text; BEGIN
  FOREACH source_name IN ARRAY ARRAY['show_teammates', 'show_tips', 'studios', 'studio_posts', 'studio_comments'] LOOP
    BEGIN
      EXECUTE format('SELECT * FROM public.%I LIMIT 1', source_name || '_signed_in_catalog');
      RAISE EXCEPTION 'Anonymous projection read allowed: %', source_name;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  END LOOP;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ DECLARE source_name text; rows integer; BEGIN
  FOREACH source_name IN ARRAY ARRAY['show_teammates', 'show_tips', 'studios', 'studio_posts', 'studio_comments'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', source_name || '_browse') INTO rows;
    IF rows <> 0 THEN RAISE EXCEPTION 'Missing user identity bypassed RLS: %', source_name; END IF;
  END LOOP;
END $$;
SELECT set_config('request.jwt.claim.sub', 'de000000-0000-4000-8000-000000000002', true);
DO $$ DECLARE source_name text; BEGIN
  FOREACH source_name IN ARRAY ARRAY['show_tips', 'studio_posts', 'studio_comments'] LOOP
    BEGIN
      EXECUTE format('INSERT INTO public.%I (id, %I, user_id, content) VALUES ($1, $2, $3, $4)', source_name,
        CASE source_name WHEN 'show_tips' THEN 'show_id' WHEN 'studio_posts' THEN 'studio_id' ELSE 'post_id' END)
      USING 'df000000-0000-4000-8000-000000000004'::uuid,
        'df000000-0000-4000-8000-000000000001'::uuid,
        'de000000-0000-4000-8000-000000000001'::uuid, 'Forged author';
      RAISE EXCEPTION 'Forged author insert allowed: %', source_name;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  END LOOP;
  BEGIN
    INSERT INTO public.show_teammates(show_id, user_id) VALUES ('df000000-0000-4000-8000-000000000001', auth.uid());
    RAISE EXCEPTION 'Non-submitter teammate insert allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.studios(name) VALUES ('Unauthorized studio');
    RAISE EXCEPTION 'Non-admin studio insert allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub', 'de000000-0000-4000-8000-000000000001', true);
INSERT INTO public.show_teammates(id, show_id, user_id, role_description) VALUES
 ('df000000-0000-4000-8000-000000000002', 'df000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000002', 'New teammate');
INSERT INTO public.show_tips(id, show_id, user_id, content) VALUES
 ('df000000-0000-4000-8000-000000000002', 'df000000-0000-4000-8000-000000000001', auth.uid(), 'New tip');
INSERT INTO public.studio_posts(id, studio_id, user_id, content) VALUES
 ('df000000-0000-4000-8000-000000000002', 'df000000-0000-4000-8000-000000000001', auth.uid(), 'New post');
INSERT INTO public.studio_comments(id, post_id, user_id, content) VALUES
 ('df000000-0000-4000-8000-000000000002', 'df000000-0000-4000-8000-000000000002', auth.uid(), 'New comment');
UPDATE public.show_tips SET content = 'Owner tip edit' WHERE id = 'df000000-0000-4000-8000-000000000001';
UPDATE public.studio_posts SET content = 'Owner post edit' WHERE id = 'df000000-0000-4000-8000-000000000001';
DO $$ BEGIN
  BEGIN
    UPDATE public.studio_posts SET user_id = 'de000000-0000-4000-8000-000000000002' WHERE id = 'df000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'Author identity rewrite allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub', 'de000000-0000-4000-8000-000000000002', true);
DO $$ DECLARE source_name text; rows integer; BEGIN
  FOREACH source_name IN ARRAY ARRAY['show_teammates', 'show_tips', 'studio_posts', 'studio_comments'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id = $1', source_name || '_browse') INTO rows
      USING 'df000000-0000-4000-8000-000000000002'::uuid;
    IF rows <> 1 THEN RAISE EXCEPTION 'Inserted row missing: %', source_name; END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM public.show_tips_browse WHERE id = 'df000000-0000-4000-8000-000000000001' AND content = 'Owner tip edit')
    OR NOT EXISTS (SELECT 1 FROM public.studio_posts_browse WHERE id = 'df000000-0000-4000-8000-000000000001' AND content = 'Owner post edit') THEN
    RAISE EXCEPTION 'Owner edits did not synchronize';
  END IF;
END $$;
DELETE FROM public.show_teammates WHERE id = 'df000000-0000-4000-8000-000000000002';
SELECT set_config('request.jwt.claim.sub', 'de000000-0000-4000-8000-000000000001', true);
DELETE FROM public.studio_comments WHERE id = 'df000000-0000-4000-8000-000000000002';
DELETE FROM public.show_tips WHERE id = 'df000000-0000-4000-8000-000000000002';
DELETE FROM public.studio_posts WHERE id = 'df000000-0000-4000-8000-000000000002';
RESET ROLE;
DO $$ DECLARE source_name text; rows integer; BEGIN
  FOREACH source_name IN ARRAY ARRAY['show_teammates', 'show_tips', 'studio_posts', 'studio_comments'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id = $1', source_name || '_signed_in_catalog') INTO rows
      USING 'df000000-0000-4000-8000-000000000002'::uuid;
    IF rows <> 0 THEN RAISE EXCEPTION 'Deleted row retained: %', source_name; END IF;
  END LOOP;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'de000000-0000-4000-8000-000000000003', true);
DO $$ DECLARE source_name text; rows integer; BEGIN
  FOREACH source_name IN ARRAY ARRAY['show_teammates', 'show_tips', 'studios', 'studio_posts', 'studio_comments'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id = $1', source_name) INTO rows
      USING 'df000000-0000-4000-8000-000000000001'::uuid;
    IF rows <> 1 THEN RAISE EXCEPTION 'Admin source read failed: %', source_name; END IF;
  END LOOP;
END $$;
INSERT INTO public.studios(id, name) VALUES ('df000000-0000-4000-8000-000000000002', 'New studio');
RESET ROLE;
UPDATE public.studios SET name = 'Renamed studio' WHERE id = 'df000000-0000-4000-8000-000000000002';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.studios_signed_in_catalog WHERE id = 'df000000-0000-4000-8000-000000000002' AND name = 'Renamed studio') THEN
    RAISE EXCEPTION 'Studio insert/update did not synchronize';
  END IF;
END $$;
-- Added private source columns must not change projection or view contracts.
DO $$ DECLARE source_name text; leaked boolean; BEGIN
  FOREACH source_name IN ARRAY ARRAY['show_teammates', 'show_tips', 'studios', 'studio_posts', 'studio_comments'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN attribution_test_secret text', source_name);
    EXECUTE format('UPDATE public.%I SET attribution_test_secret = $1 WHERE id = $2', source_name)
      USING 'Private sentinel', 'df000000-0000-4000-8000-000000000001'::uuid;
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I c WHERE to_jsonb(c) ? $1)', source_name || '_browse')
      INTO leaked USING 'attribution_test_secret';
    IF leaked THEN RAISE EXCEPTION 'Private source column leaked: %', source_name; END IF;
  END LOOP;
END $$;
UPDATE public.studio_comments SET id = 'df000000-0000-4000-8000-000000000003' WHERE id = 'df000000-0000-4000-8000-000000000001';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.studio_comments_signed_in_catalog WHERE id = 'df000000-0000-4000-8000-000000000001')
    OR NOT EXISTS (SELECT 1 FROM public.studio_comments_signed_in_catalog WHERE id = 'df000000-0000-4000-8000-000000000003') THEN
    RAISE EXCEPTION 'Primary key change did not synchronize';
  END IF;
END $$;
DELETE FROM public.studios WHERE id IN ('df000000-0000-4000-8000-000000000001', 'df000000-0000-4000-8000-000000000002');
DELETE FROM public.nyc_shows WHERE id = 'df000000-0000-4000-8000-000000000001';
DO $$ DECLARE source_name text; rows integer; BEGIN
  FOREACH source_name IN ARRAY ARRAY['show_teammates', 'show_tips', 'studios', 'studio_posts', 'studio_comments'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id IN ($1, $2, $3)', source_name || '_signed_in_catalog') INTO rows
      USING 'df000000-0000-4000-8000-000000000001'::uuid, 'df000000-0000-4000-8000-000000000002'::uuid, 'df000000-0000-4000-8000-000000000003'::uuid;
    IF rows <> 0 THEN RAISE EXCEPTION 'Cascaded delete retained projection: %', source_name; END IF;
  END LOOP;
END $$;
-- All truncation is local and rolled back, including cascaded source tables.
DO $$ DECLARE source_name text; rows integer; BEGIN
  FOREACH source_name IN ARRAY ARRAY['show_teammates', 'show_tips', 'studios', 'studio_posts', 'studio_comments'] LOOP
    EXECUTE format('TRUNCATE public.%I CASCADE', source_name);
    EXECUTE format('SELECT count(*) FROM public.%I', source_name || '_signed_in_catalog') INTO rows;
    IF rows <> 0 THEN RAISE EXCEPTION 'Truncate did not synchronize: %', source_name; END IF;
  END LOOP;
END $$;
