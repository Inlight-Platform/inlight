import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const read = (path) => readFileSync(path, 'utf8');
const migration = (name) => read(`supabase/migrations/${name}`).split('/*')[0]
  .replace(/^\s*(BEGIN|COMMIT);\s*$/gm, '');
const sources = ['show_teammates', 'show_tips', 'studios', 'studio_posts', 'studio_comments'];
const resetBaseline = [
  ['show_teammates', 'Show participants and admins can view teammate rows'],
  ['show_tips', 'Tip authors and admins can view tip rows'],
  ['studios', 'Admins can view studio rows'],
  ['studio_posts', 'Post authors and admins can view studio post rows'],
  ['studio_comments', 'Comment authors and admins can view studio comment rows'],
].map(([table, policy]) => `DROP POLICY IF EXISTS "${policy}" ON public.${table};`).join('\n');
const baseline = [
  '20261002135954_inv96_group2_anonymous_browse_views.sql',
  '20261005180000_inv96_group6_public_attribution_views.sql',
  '20261005183000_inv96_group6_require_auth_for_browse.sql',
].map(migration).join('\n');
const useFix = process.argv.includes('--fix');
const fix = useFix ? migration('20261013140000_attribution_browse_invoker_views.sql')
  : process.argv.includes('--naive') ? sources.map((name) => `ALTER VIEW public.${name}_browse SET (security_invoker=true);`).join('\n') : '';
const snapshot = sources.map((name) => `CREATE TEMP TABLE expected_${name}_rows AS SELECT to_jsonb(c) AS fields FROM public.${name}_browse c;
CREATE TEMP TABLE expected_${name}_columns AS SELECT attname, atttypid, atttypmod, attnum FROM pg_attribute WHERE attrelid = 'public.${name}_browse'::regclass AND attnum > 0 AND NOT attisdropped;`).join('\n');
const hostedChecks = useFix ? read('supabase/tests/attribution_browse_hosted_readonly.sql')
  .replace('REPLACE_WITH_NON_ADMIN_USER_UUID', 'de000000-0000-4000-8000-000000000002')
  .replace(/^\s*(BEGIN READ ONLY|ROLLBACK);\s*$/gm, '') : '';
// This runner is deliberately restricted to a disposable local database.
const sql = `BEGIN;\n${resetBaseline}\n${baseline}\n${read('supabase/tests/attribution_browse_fixtures.sql')}\n${snapshot}\n${fix}\n${read('supabase/tests/attribution_browse_assertions.sql')}\n${hostedChecks}\n${useFix ? read('supabase/tests/attribution_browse_projection.sql') : ''}\nROLLBACK;`;
const result = spawnSync('psql', ['postgresql://postgres:postgres@127.0.0.1:54322/postgres', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' });
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
process.exit(result.status ?? 1);
