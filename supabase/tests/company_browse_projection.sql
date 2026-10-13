DO $$ DECLARE client_role text; target text; privilege text; BEGIN
  IF EXISTS (SELECT fields FROM expected_company_fields EXCEPT SELECT to_jsonb(c) - 'is_owner' FROM public.companies_browse c)
    OR EXISTS (SELECT to_jsonb(c) - 'is_owner' FROM public.companies_browse c EXCEPT SELECT fields FROM expected_company_fields) THEN
    RAISE EXCEPTION 'Public company fields changed';
  END IF;
  IF EXISTS (SELECT attname, atttypid, atttypmod, attnum FROM expected_company_columns EXCEPT
    SELECT attname, atttypid, atttypmod, attnum FROM pg_attribute WHERE attrelid = 'public.companies_browse'::regclass AND attnum > 0 AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Company view column contract changed';
  END IF;
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOREACH target IN ARRAY ARRAY['public.companies_public_catalog', 'public.catalog_ownership', 'public.companies_browse'] LOOP
      FOREACH privilege IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] LOOP
        IF has_table_privilege(client_role, target, privilege) THEN
          RAISE EXCEPTION 'Client write grant: % % %', client_role, target, privilege;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = 'public.companies_browse'::regclass
    AND 'security_invoker=true' = ANY(reloptions)) THEN
    RAISE EXCEPTION 'Company view is not invoker';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.companies_public_catalog'::regclass
    AND attnum > 0 AND NOT attisdropped AND attname IN ('owner_user_id', 'created_at', 'updated_at')) THEN
    RAISE EXCEPTION 'Private source columns projected';
  END IF;
  IF has_function_privilege('anon', 'private.sync_company_public_projection()', 'EXECUTE')
    OR has_function_privilege('authenticated', 'private.sync_company_public_projection()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Client can execute sync function';
  END IF;
END $$;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.catalog_ownership WHERE catalog = 'companies') THEN
    RAISE EXCEPTION 'Anonymous ownership records leaked';
  END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'dc000000-0000-4000-8000-000000000002', true);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.catalog_ownership WHERE catalog = 'companies'
    AND row_id = 'dd000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Other owner record leaked';
  END IF;
  BEGIN
    UPDATE public.companies_public_catalog SET name = 'Forged' WHERE id = 'dd000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'Client projection update allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.catalog_ownership VALUES ('companies', 'dd000000-0000-4000-8000-000000000002', auth.uid());
    RAISE EXCEPTION 'Client ownership insert allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    DELETE FROM public.companies_public_catalog;
    RAISE EXCEPTION 'Client projection delete allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub', 'dc000000-0000-4000-8000-000000000001', true);
UPDATE public.companies SET name = 'Owner edit', description = 'Updated public text', fun_facts = '["Public fact"]'::jsonb
WHERE id = 'dd000000-0000-4000-8000-000000000001';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.companies_browse WHERE id = 'dd000000-0000-4000-8000-000000000001'
    AND name = 'Owner edit' AND description = 'Updated public text' AND fun_facts = '["Public fact"]'::jsonb AND is_owner) THEN
    RAISE EXCEPTION 'Owner edit did not synchronize';
  END IF;
END $$;
RESET ROLE;
-- A future private source field must not appear even after synchronization.
ALTER TABLE public.companies ADD COLUMN company_security_test_secret text;
UPDATE public.companies SET company_security_test_secret = 'Private sentinel',
  owner_user_id = 'dc000000-0000-4000-8000-000000000002'
WHERE id = 'dd000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'dc000000-0000-4000-8000-000000000001', true);
DO $$ BEGIN
  IF (SELECT is_owner FROM public.companies_browse WHERE id = 'dd000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Old owner retained ownership';
  END IF;
END $$;
SELECT set_config('request.jwt.claim.sub', 'dc000000-0000-4000-8000-000000000002', true);
DO $$ BEGIN
  IF NOT (SELECT is_owner FROM public.companies_browse WHERE id = 'dd000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'New owner missing ownership';
  END IF;
  IF EXISTS (SELECT 1 FROM public.companies_browse c WHERE to_jsonb(c) ? 'company_security_test_secret')
    OR EXISTS (SELECT 1 FROM public.companies_public_catalog c WHERE to_jsonb(c) ? 'company_security_test_secret') THEN
    RAISE EXCEPTION 'Future private column leaked';
  END IF;
END $$;
RESET ROLE;
UPDATE public.companies SET owner_user_id = NULL WHERE id = 'dd000000-0000-4000-8000-000000000001';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.catalog_ownership WHERE catalog = 'companies' AND row_id = 'dd000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Removed owner remained mapped';
  END IF;
END $$;
INSERT INTO public.companies(id, name, owner_user_id) VALUES
 ('dd000000-0000-4000-8000-000000000003', 'New company', 'dc000000-0000-4000-8000-000000000001');
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.companies_public_catalog WHERE id = 'dd000000-0000-4000-8000-000000000003')
    OR NOT EXISTS (SELECT 1 FROM public.catalog_ownership WHERE catalog = 'companies' AND row_id = 'dd000000-0000-4000-8000-000000000003') THEN
    RAISE EXCEPTION 'Insert did not synchronize';
  END IF;
END $$;
DELETE FROM public.companies WHERE id = 'dd000000-0000-4000-8000-000000000003';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.companies_public_catalog WHERE id = 'dd000000-0000-4000-8000-000000000003')
    OR EXISTS (SELECT 1 FROM public.catalog_ownership WHERE catalog = 'companies' AND row_id = 'dd000000-0000-4000-8000-000000000003') THEN
    RAISE EXCEPTION 'Delete did not synchronize';
  END IF;
END $$;
-- CASCADE is confined to the rollback-only local database transaction.
INSERT INTO public.catalog_ownership VALUES ('company-test-other-catalog', 'dd000000-0000-4000-8000-000000000004', 'dc000000-0000-4000-8000-000000000001');
TRUNCATE public.companies CASCADE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.companies_public_catalog)
    OR EXISTS (SELECT 1 FROM public.catalog_ownership WHERE catalog = 'companies') THEN
    RAISE EXCEPTION 'Truncate did not synchronize';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.catalog_ownership WHERE catalog = 'company-test-other-catalog') THEN
    RAISE EXCEPTION 'Company truncate removed another catalog ownership';
  END IF;
END $$;
