-- Replace this placeholder with a real non-admin user UUID from the target
-- environment. No fixtures, writes, deletes, or truncates are performed here.
BEGIN READ ONLY;
SELECT set_config('attribution_test.user_id', 'REPLACE_WITH_NON_ADMIN_USER_UUID', true);
DO $$
DECLARE source_name text; safe_columns text; source_rows bigint; browse_rows bigint;
  counts jsonb := '{}'::jsonb; mismatch boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = current_setting('attribution_test.user_id')::uuid)
    OR public.has_role(current_setting('attribution_test.user_id')::uuid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Choose a real non-admin user in this environment';
  END IF;
  FOR source_name, safe_columns IN SELECT * FROM (VALUES
    ('show_teammates', 'id, show_id, user_id, role_description, created_at'),
    ('show_tips', 'id, show_id, user_id, tip_type, content, helpful_count, created_at, updated_at'),
    ('studios', 'id, name, description, icon, created_at, badge_tag'),
    ('studio_posts', 'id, studio_id, user_id, content, image_url, created_at, updated_at'),
    ('studio_comments', 'id, post_id, user_id, content, created_at')
  ) AS catalogs(name, cols)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = format('public.%I', source_name || '_browse')::regclass
      AND 'security_invoker=true' = ANY(reloptions) AND 'security_barrier=true' = ANY(reloptions)) THEN
      RAISE EXCEPTION 'View options incorrect: %', source_name;
    END IF;
    EXECUTE format('SELECT count(*) FROM public.%I', source_name) INTO source_rows;
    EXECUTE format('SELECT count(*) FROM public.%I', source_name || '_signed_in_catalog') INTO browse_rows;
    IF source_rows <> browse_rows THEN RAISE EXCEPTION 'Projection count mismatch: %', source_name; END IF;
    EXECUTE format('SELECT EXISTS (SELECT to_jsonb(s) FROM (SELECT %2$s FROM public.%1$I) s EXCEPT SELECT to_jsonb(c) FROM public.%3$I c) OR EXISTS (SELECT to_jsonb(c) FROM public.%3$I c EXCEPT SELECT to_jsonb(s) FROM (SELECT %2$s FROM public.%1$I) s)',
      source_name, safe_columns, source_name || '_browse') INTO mismatch;
    IF mismatch THEN RAISE EXCEPTION 'Source/browse field mismatch: %', source_name; END IF;
    counts := counts || jsonb_build_object(source_name, source_rows);
  END LOOP;
  PERFORM set_config('attribution_test.counts', counts::text, true);
END $$;

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ DECLARE source_name text; suffix text; BEGIN
  FOREACH source_name IN ARRAY ARRAY['show_teammates', 'show_tips', 'studios', 'studio_posts', 'studio_comments'] LOOP
    FOREACH suffix IN ARRAY ARRAY['_browse', '_signed_in_catalog'] LOOP
      BEGIN
        EXECUTE format('SELECT * FROM public.%I LIMIT 1', source_name || suffix);
        RAISE EXCEPTION 'Anonymous read allowed: %', source_name || suffix;
      EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    END LOOP;
  END LOOP;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('attribution_test.user_id'), true);
DO $$ DECLARE source_name text; rows bigint; privilege text; suffix text; BEGIN
  FOREACH source_name IN ARRAY ARRAY['show_teammates', 'show_tips', 'studios', 'studio_posts', 'studio_comments'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', source_name || '_browse') INTO rows;
    IF rows <> (current_setting('attribution_test.counts')::jsonb ->> source_name)::bigint THEN
      RAISE EXCEPTION 'Signed-in browse count mismatch: %', source_name;
    END IF;
    FOREACH suffix IN ARRAY ARRAY['_browse', '_signed_in_catalog'] LOOP
      FOREACH privilege IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] LOOP
        IF has_table_privilege(current_user, 'public.' || source_name || suffix, privilege) THEN
          RAISE EXCEPTION 'Client write grant: % %', source_name || suffix, privilege;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
RESET ROLE;
ROLLBACK;
-- Success means no errors and all blocks completed. An error is a failed check;
-- run ROLLBACK before rerunning if the SQL editor retains the failed transaction.
