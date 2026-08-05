import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const npxCacheDir = join(homedir(), '.npm', '_npx');

const findCachedSupabaseCli = () => {
  if (!existsSync(npxCacheDir)) return undefined;

  for (const entry of readdirSync(npxCacheDir)) {
    const packageDir = join(npxCacheDir, entry, 'node_modules');
    if (!existsSync(packageDir)) continue;

    const binaryLinkPath = join(packageDir, '.bin', 'supabase');
    if (existsSync(binaryLinkPath)) return binaryLinkPath;

    for (const packageName of readdirSync(packageDir)) {
      if (!packageName.startsWith('@supabase/cli-')) continue;
      const binaryPath = join(packageDir, packageName, 'bin', 'supabase');
      if (existsSync(binaryPath)) return binaryPath;
    }
  }

  return undefined;
};

const binary = findCachedSupabaseCli();

if (!binary) {
  console.error('Supabase CLI was not found in the local npx cache.');
  console.error('Run `npx supabase --version` once, then retry this command.');
  process.exit(1);
}

const result = spawnSync(binary, process.argv.slice(2), {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: {
    ...process.env,
    DOCKER_HOST: process.env.DOCKER_HOST || `unix://${join(homedir(), '.docker', 'run', 'docker.sock')}`,
    HOME: tmpdir(),
    SUPABASE_TELEMETRY_DISABLED: '1',
  },
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
