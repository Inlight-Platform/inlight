SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.companies_browse WHERE id IN
    ('dd000000-0000-4000-8000-000000000001', 'dd000000-0000-4000-8000-000000000002')) <> 2 THEN
    RAISE EXCEPTION 'Anonymous company browse failed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.companies_browse WHERE is_owner) THEN
    RAISE EXCEPTION 'Anonymous ownership leaked';
  END IF;
  IF EXISTS (SELECT 1 FROM public.companies WHERE id = 'dd000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Anonymous source row leaked';
  END IF;
  IF (SELECT to_jsonb(c) ? 'owner_user_id' FROM public.companies_browse c
      WHERE id = 'dd000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Owner UUID in browse';
  END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'dc000000-0000-4000-8000-000000000001', true);
DO $$ BEGIN
  IF NOT (SELECT is_owner FROM public.companies_browse WHERE id = 'dd000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Owner flag missing';
  END IF;
  IF (SELECT is_owner FROM public.companies_browse WHERE id = 'dd000000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'Unowned company reports ownership';
  END IF;
END $$;
SELECT set_config('request.jwt.claim.sub', 'dc000000-0000-4000-8000-000000000002', true);
DO $$ DECLARE affected integer; BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.companies_browse WHERE id = 'dd000000-0000-4000-8000-000000000001' AND NOT is_owner)
    OR EXISTS (SELECT 1 FROM public.companies WHERE id = 'dd000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Unrelated-user read boundary failed';
  END IF;
  UPDATE public.companies SET name = 'Unauthorized' WHERE id = 'dd000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Unrelated user updated company'; END IF;
  DELETE FROM public.companies WHERE id = 'dd000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Unrelated user deleted company'; END IF;
END $$;
RESET ROLE;
