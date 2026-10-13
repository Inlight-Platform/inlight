DO $$ BEGIN
  IF EXISTS (SELECT fields FROM expected_opportunities EXCEPT SELECT to_jsonb(c) FROM public.opportunities_public_browse c)
    OR EXISTS (SELECT to_jsonb(c) FROM public.opportunities_public_browse c EXCEPT SELECT fields FROM expected_opportunities) THEN
    RAISE EXCEPTION 'Browse compatibility failed';
  END IF;
  IF EXISTS (SELECT * FROM expected_opportunity_columns EXCEPT SELECT attname, atttypid, atttypmod, attnum
    FROM pg_attribute WHERE attrelid = 'public.opportunities_public_browse'::regclass AND attnum > 0 AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Column/type contract changed';
  END IF;
END $$;
-- Exercise RLS directly without the separate billing/authorization trigger.
ALTER TABLE public.opportunities DISABLE TRIGGER enforce_opportunity_credit_on_insert;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.opportunities_public_browse WHERE id::text LIKE 'f2000000-%') <> 3 THEN
    RAISE EXCEPTION 'Public teaser eligibility failed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.opportunities_public_browse WHERE posted_by IS NOT NULL
    OR (action_type <> 'external' AND (description <> '' OR compensation IS NOT NULL
      OR roles <> ARRAY[]::text[] OR requirements <> ARRAY[]::text[] OR link_url IS NOT NULL OR link_title IS NOT NULL))) THEN
    RAISE EXCEPTION 'Protected teaser fields leaked';
  END IF;
  IF EXISTS (SELECT 1 FROM public.opportunities WHERE id = 'f2000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Anonymous internal source access allowed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.opportunities_public_browse
    WHERE id = 'f2000000-0000-4000-8000-000000000003' AND description = 'Protected description 3'
      AND link_url = 'https://example.test/public') THEN
    RAISE EXCEPTION 'External public detail compatibility failed';
  END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000002', true);
DO $$ DECLARE affected integer; BEGIN
  UPDATE public.opportunities SET title = 'Unauthorized' WHERE id = 'f2000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Non-owner edit allowed'; END IF;
  DELETE FROM public.opportunities WHERE id = 'f2000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Non-owner delete allowed'; END IF;
  BEGIN
    INSERT INTO public.opportunities(id, title, description, posted_by)
    VALUES ('f2000000-0000-4000-8000-000000000099', 'Spoof', 'Spoof',
      'f1000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'Spoofed owner insert allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000001', true);
DO $$ DECLARE affected integer; BEGIN
  BEGIN
    UPDATE public.opportunities SET posted_by = 'f1000000-0000-4000-8000-000000000002'
    WHERE id = 'f2000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'Owner reassignment allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.opportunities SET title = 'Owner edited' WHERE id = 'f2000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Owner edit denied'; END IF;
END $$;
RESET ROLE;
