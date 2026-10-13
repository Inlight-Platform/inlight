import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// Only the disposable local Supabase instance is used; nothing is committed.
const baseline = readFileSync('supabase/migrations/20261002135954_inv96_group2_anonymous_browse_views.sql', 'utf8')
  .split('/*')[0].replace(/^\s*(BEGIN|COMMIT);\s*$/gm, '');
const fixtures = readFileSync('supabase/tests/catalog_browse_access.sql', 'utf8');
const assertions = readFileSync('supabase/tests/catalog_browse_assertions.sql', 'utf8');
const migration = readFileSync('supabase/migrations/20261013030000_catalog_browse_invoker_views.sql', 'utf8')
  .replace(/^\s*(BEGIN|COMMIT);\s*$/gm, '');
const useFix = process.argv.includes('--fix');
const naiveFix = process.argv.includes('--naive')
  ? ['user_films', 'user_music_shows', 'nyc_shows'].map((name) => `ALTER VIEW public.${name}_browse SET (security_invoker=true);`).join('\n') : '';
const projectionTests = useFix ? readFileSync('supabase/tests/catalog_browse_projection.sql', 'utf8') : '';
const sql = `BEGIN;\n${baseline}\n${fixtures}\n${useFix ? migration : naiveFix}\n${assertions}\n${projectionTests}\nROLLBACK;`;
const result = spawnSync('psql', ['postgresql://postgres:postgres@127.0.0.1:54322/postgres', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' });
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
process.exit(result.status ?? 1);
