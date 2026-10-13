DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.opportunities_public_catalog
    WHERE id = 'f2000000-0000-4000-8000-000000000001' AND title = 'Owner edited') THEN
    RAISE EXCEPTION 'Owner edit did not synchronize';
  END IF;
END $$;
UPDATE public.opportunities SET status = 'closed' WHERE id = 'f2000000-0000-4000-8000-000000000001';
UPDATE public.opportunities SET is_public = false WHERE id = 'f2000000-0000-4000-8000-000000000003';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.opportunities_public_catalog WHERE id IN
    ('f2000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000003')) THEN
    RAISE EXCEPTION 'Withdrawn jobs remained public';
  END IF;
END $$;
UPDATE public.opportunities SET status = 'open' WHERE id = 'f2000000-0000-4000-8000-000000000001';
UPDATE public.opportunities SET is_public = true WHERE id = 'f2000000-0000-4000-8000-000000000003';
UPDATE public.opportunities SET link_url = '  ' WHERE id = 'f2000000-0000-4000-8000-000000000003';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.opportunities_public_catalog WHERE id = 'f2000000-0000-4000-8000-000000000001')
    OR EXISTS (SELECT 1 FROM public.opportunities_public_catalog WHERE id = 'f2000000-0000-4000-8000-000000000003') THEN
    RAISE EXCEPTION 'Reopen/blank-link synchronization failed';
  END IF;
END $$;
UPDATE public.opportunities SET action_type = 'apply', status = 'open'
WHERE id = 'f2000000-0000-4000-8000-000000000003';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.opportunities_public_catalog
    WHERE id = 'f2000000-0000-4000-8000-000000000003' AND description = '' AND link_url IS NULL
      AND compensation IS NULL AND roles = ARRAY[]::text[] AND requirements = ARRAY[]::text[]) THEN
    RAISE EXCEPTION 'External-to-internal fields were not masked';
  END IF;
END $$;
UPDATE public.opportunities SET action_type = 'external', is_public = true, link_url = 'https://example.test/restored'
WHERE id = 'f2000000-0000-4000-8000-000000000003';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.opportunities_public_catalog
    WHERE id = 'f2000000-0000-4000-8000-000000000003' AND description = 'Protected description 3'
      AND link_url = 'https://example.test/restored' AND roles = ARRAY['Protected role'] AND posted_by IS NULL) THEN
    RAISE EXCEPTION 'Internal-to-external public fields were not restored';
  END IF;
END $$;
ALTER TABLE public.opportunities ADD COLUMN security_test_secret text DEFAULT 'Never public';
UPDATE public.opportunities SET title = title WHERE id = 'f2000000-0000-4000-8000-000000000001';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.opportunities_public_catalog c WHERE to_jsonb(c) ? 'security_test_secret') THEN
    RAISE EXCEPTION 'Future private field leaked';
  END IF;
END $$;
UPDATE public.opportunities SET id = 'f2000000-0000-4000-8000-000000000088'
WHERE id = 'f2000000-0000-4000-8000-000000000003';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.opportunities_public_catalog WHERE id = 'f2000000-0000-4000-8000-000000000003')
    OR NOT EXISTS (SELECT 1 FROM public.opportunities_public_catalog WHERE id = 'f2000000-0000-4000-8000-000000000088') THEN
    RAISE EXCEPTION 'Primary key change synchronization failed';
  END IF;
END $$;
DELETE FROM public.opportunities WHERE id = 'f2000000-0000-4000-8000-000000000088';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.opportunities_public_catalog WHERE id = 'f2000000-0000-4000-8000-000000000088') THEN
    RAISE EXCEPTION 'Deleted projection retained';
  END IF;
END $$;
-- Skip unrelated billing/notification side effects, not the projection trigger.
ALTER TABLE public.opportunities DISABLE TRIGGER enforce_opportunity_credit_on_insert;
ALTER TABLE public.opportunities DISABLE TRIGGER on_new_opportunity_notify_matches;
INSERT INTO public.opportunities(id, title, description, posted_by, action_type, is_public, link_url)
VALUES ('f2000000-0000-4000-8000-000000000089', 'New public external', 'External details',
  'f1000000-0000-4000-8000-000000000001', 'external', true, 'https://example.test/new');
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.opportunities_public_catalog WHERE id = 'f2000000-0000-4000-8000-000000000089'
    AND description = 'External details' AND posted_by IS NULL) THEN
    RAISE EXCEPTION 'New insert projection failed';
  END IF;
END $$;
TRUNCATE public.opportunities CASCADE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.opportunities_public_catalog) THEN
    RAISE EXCEPTION 'Truncate cleanup failed';
  END IF;
END $$;
