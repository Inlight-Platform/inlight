import { readFileSync } from 'node:fs';

const LOCKED_SUPABASE_URL = 'https://piofmmawwnermvaysonw.supabase.co';
const LOCKED_SUPABASE_HOST = 'piofmmawwnermvaysonw.supabase.co';
const RETIRED_SUPABASE_HOSTS = [
  'gbiostpdhvfxpppfqskw.supabase.co',
];

const filesToVerify = [
  'src/integrations/supabase/config.ts',
  '.env.example',
];

const failures = [];

for (const file of filesToVerify) {
  const contents = readFileSync(file, 'utf8');

  if (!contents.includes(LOCKED_SUPABASE_URL) && !contents.includes(LOCKED_SUPABASE_HOST)) {
    failures.push(`${file} does not contain the locked Supabase URL (${LOCKED_SUPABASE_URL}).`);
  }

  for (const retiredHost of RETIRED_SUPABASE_HOSTS) {
    if (contents.includes(retiredHost)) {
      failures.push(`${file} still references retired Supabase host ${retiredHost}.`);
    }
  }
}

if (failures.length > 0) {
  console.error('Supabase config verification failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Supabase config verified: ${LOCKED_SUPABASE_URL}`);
