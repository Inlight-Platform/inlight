import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Deliberately independent of Vite, app env files, and DATABASE_URL.
const testFile = fileURLToPath(new URL('../supabase/tests/group_removal_notification.sql', import.meta.url));
const result = spawnSync('psql', [
  'postgresql://postgres@127.0.0.1:54322/postgres',
  '-X', '-w', '-v', 'ON_ERROR_STOP=1', '-f', testFile,
], {
  stdio: 'inherit',
  env: { PATH: process.env.PATH || '/usr/bin:/bin', PGPASSWORD: 'postgres' },
});
if (result.error) {
  console.error('Unable to start local psql:', result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
