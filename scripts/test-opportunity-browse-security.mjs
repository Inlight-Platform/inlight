import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const read = (path) => readFileSync(path, 'utf8');
const migration = (name) => read(`supabase/migrations/${name}`).split('/*')[0]
  .replace(/^\s*(BEGIN|COMMIT);\s*$/gm, '');
const sourceBaseline = migration('20261006190000_inv96_group7_authenticated_catalog_and_external_jobs.sql');
const baseline = `DO $$ DECLARE p record; BEGIN
FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='opportunities' LOOP
EXECUTE format('DROP POLICY %I ON public.opportunities', p.policyname);
END LOOP; END $$;\n` + sourceBaseline.slice(sourceBaseline.indexOf('DROP POLICY IF EXISTS "Admins can manage all opportunities"')) + [
  '20261006190500_inv96_group7_narrow_table_grants.sql',
  '20261006214500_inv96_group9_public_job_teasers.sql',
].map(migration).join('\n');
const fixed = process.argv.includes('--fix');
const fix = fixed ? migration('20261013210000_opportunity_browse_invoker.sql')
  : process.argv.includes('--naive') ? 'ALTER VIEW public.opportunities_public_browse SET (security_invoker=true);' : '';
const snapshot = `CREATE TEMP TABLE expected_opportunities AS SELECT to_jsonb(c) AS fields FROM public.opportunities_public_browse c;
CREATE TEMP TABLE expected_opportunity_columns AS SELECT attname, atttypid, atttypmod, attnum FROM pg_attribute
WHERE attrelid = 'public.opportunities_public_browse'::regclass AND attnum > 0 AND NOT attisdropped;`;
const hosted = fixed ? read('supabase/tests/opportunity_browse_hosted_readonly.sql')
  .replace(/^\s*(BEGIN READ ONLY|ROLLBACK);\s*$/gm, '') : '';
// Never targets hosted databases. All fixtures and migration changes roll back.
const sql = `BEGIN;\n${baseline}\n${read('supabase/tests/opportunity_browse_fixtures.sql')}\n${snapshot}\n${fix}\n${read('supabase/tests/opportunity_browse_assertions.sql')}\n${hosted}\n${fixed ? read('supabase/tests/opportunity_browse_projection.sql') : ''}\nROLLBACK;`;
const result = spawnSync('psql', ['postgresql://postgres:postgres@127.0.0.1:54322/postgres', '-v', 'ON_ERROR_STOP=1'],
  { input: sql, encoding: 'utf8' });
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
process.exit(result.status ?? 1);
