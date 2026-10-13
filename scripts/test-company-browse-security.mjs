import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const read = (path) => readFileSync(path, 'utf8');
const migration = (name) => read(`supabase/migrations/${name}`).split('/*')[0]
  .replace(/^\s*(BEGIN|COMMIT);\s*$/gm, '');
const useFix = process.argv.includes('--fix');
// Reconstruct the relevant hosted baseline inside a disposable local transaction.
const baseline = migration('20261002214500_inv96_group4_company_browse_privacy.sql');
const prerequisite = migration('20261013030000_catalog_browse_invoker_views.sql');
const fix = useFix ? migration('20261013120000_company_browse_invoker_view.sql')
  : process.argv.includes('--naive') ? 'ALTER VIEW public.companies_browse SET (security_invoker=true);' : '';
const snapshot = `CREATE TEMP TABLE expected_company_fields AS SELECT to_jsonb(c) - 'is_owner' AS fields FROM public.companies_browse c;
CREATE TEMP TABLE expected_company_columns AS SELECT attname, atttypid, atttypmod, attnum FROM pg_attribute WHERE attrelid = 'public.companies_browse'::regclass AND attnum > 0 AND NOT attisdropped;`;
const sql = `BEGIN;\n${baseline}\n${prerequisite}\n${read('supabase/tests/company_browse_fixtures.sql')}\n${snapshot}\n${fix}\n${read('supabase/tests/company_browse_assertions.sql')}\n${useFix ? read('supabase/tests/company_browse_projection.sql') : ''}\nROLLBACK;`;
const result = spawnSync('psql', ['postgresql://postgres:postgres@127.0.0.1:54322/postgres', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' });
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
process.exit(result.status ?? 1);
