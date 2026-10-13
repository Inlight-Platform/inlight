import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const read = (path) => readFileSync(path, 'utf8');
const migration = (name) => read(`supabase/migrations/${name}`).split('/*')[0]
  .replace(/^\s*(BEGIN|COMMIT);\s*$/gm, '');
const helper = migration('20261005165000_inv96_group5_browse_access_helper.sql')
  .replace('DROP FUNCTION IF EXISTS public.can_browse_project(uuid);', '')
  .replace('CREATE FUNCTION public.can_browse_project', 'CREATE OR REPLACE FUNCTION public.can_browse_project');
const groupHelpers = migration('20261012190000_inv96_scoped_group_policy_helpers.sql').split('ALTER POLICY')[0];
const baseline = `ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
ADD COLUMN IF NOT EXISTS author_identity text NOT NULL DEFAULT 'personal',
ADD COLUMN IF NOT EXISTS author_group_id uuid;
${groupHelpers}
${helper}
${migration('20261008220000_inv96_project_feed_projection.sql')}`;
const fixed = process.argv.includes('--fix');
// Exercise coexistence with the just-merged role projection triggers.
const fix = fixed ? [
  '20261006214500_inv96_group9_public_job_teasers.sql',
  '20261013220000_project_role_browse_invoker.sql',
  '20261013230000_projects_browse_invoker.sql',
].map(migration).join('\n')
  : process.argv.includes('--naive') ? 'ALTER VIEW public.projects_browse SET (security_invoker=true);' : '';
// Snapshot the old contract under each real fixture identity.
const snapshot = `CREATE TEMP TABLE expected_project_rows (viewer integer, fields jsonb);
DO $$ DECLARE i integer; BEGIN
FOR i IN 0..9 LOOP
PERFORM set_config('request.jwt.claim.sub', CASE WHEN i=0 THEN '' ELSE
('c1000000-0000-4000-8000-' || lpad(i::text,12,'0')) END, true);
INSERT INTO expected_project_rows SELECT i,to_jsonb(p) FROM public.projects_browse p;
END LOOP; END $$;
CREATE TEMP TABLE expected_project_columns AS SELECT attname, atttypid, atttypmod, attnum FROM pg_attribute
WHERE attrelid='public.projects_browse'::regclass AND attnum>0 AND NOT attisdropped;`;
const hosted = fixed ? read('supabase/tests/projects_browse_hosted_readonly.sql')
  .replace(/^\s*(BEGIN READ ONLY|ROLLBACK);\s*$/gm, '') : '';
// Only the disposable localhost database is supported; every change rolls back.
const sql = `BEGIN;\n${baseline}\n${read('supabase/tests/projects_browse_fixtures.sql')}\n${snapshot}\n${fix}\n${read('supabase/tests/projects_browse_assertions.sql')}\n${hosted}\n${fixed ? read('supabase/tests/projects_browse_projection.sql') : ''}\nROLLBACK;`;
const result = spawnSync('psql', ['postgresql://postgres:postgres@127.0.0.1:54322/postgres', '-v', 'ON_ERROR_STOP=1'],
  { input: sql, encoding: 'utf8' });
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
process.exit(result.status ?? 1);
