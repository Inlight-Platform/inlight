import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const read = (path) => readFileSync(path, 'utf8');
const migration = (name) => read(`supabase/migrations/${name}`).split('/*')[0]
  .replace(/^\s*(BEGIN|COMMIT);\s*$/gm, '');
const sources = ['posts', 'events'];
// Reconstruct only the event constraint from the later department-removal
// migration; its project changes are not needed by these local tests.
const eventAudience = `ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_visibility_check;
ALTER TABLE public.events ADD CONSTRAINT events_visibility_check
CHECK (visibility IN ('public', 'network', 'specific', 'group', 'private', 'unlisted'));`;
const baseline = [
  '20260911123000_add_group_targeted_events.sql',
  '20260917120000_harden_group_only_post_reads.sql',
  '20261006220000_inv96_anonymous_feed_attribution.sql',
].map(migration).join('\n') + '\n' + eventAudience;
const useFix = process.argv.includes('--fix');
const fix = useFix ? migration('20261013160000_public_feed_invoker_views.sql')
  : process.argv.includes('--naive') ? sources.map((name) => `ALTER VIEW public.${name}_public_browse SET (security_invoker=true);`).join('\n') : '';
const snapshot = sources.map((name) => `CREATE TEMP TABLE expected_${name}_feed AS SELECT to_jsonb(c) AS fields FROM public.${name}_public_browse c;
CREATE TEMP TABLE expected_${name}_feed_columns AS SELECT attname, atttypid, atttypmod, attnum FROM pg_attribute WHERE attrelid = 'public.${name}_public_browse'::regclass AND attnum > 0 AND NOT attisdropped;`).join('\n');
const hostedChecks = useFix ? read('supabase/tests/public_feed_hosted_readonly.sql')
  .replace(/^\s*(BEGIN READ ONLY|ROLLBACK);\s*$/gm, '') : '';
// Only a disposable local database is used; every change rolls back.
const sql = `BEGIN;\n${baseline}\n${read('supabase/tests/public_feed_fixtures.sql')}\n${snapshot}\n${fix}\n${read('supabase/tests/public_feed_assertions.sql')}\n${hostedChecks}\n${useFix ? read('supabase/tests/public_feed_projection.sql') : ''}\nROLLBACK;`;
const result = spawnSync('psql', ['postgresql://postgres:postgres@127.0.0.1:54322/postgres', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' });
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
process.exit(result.status ?? 1);
