import { spawnSync } from 'node:child_process';

const SANDBOX_BRANCH = 'local-supabase-sandbox';

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    stdio: options.capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
    cwd: process.cwd(),
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(output || `${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }

  return result.stdout?.trim() ?? '';
};

const currentBranch = run('git', ['branch', '--show-current'], { capture: true });

if (currentBranch !== SANDBOX_BRANCH) {
  console.error(`This sync script must be run from ${SANDBOX_BRANCH}. Current branch: ${currentBranch || '(detached)'}`);
  process.exit(1);
}

const trackedChanges = run('git', ['status', '--porcelain', '--untracked-files=no'], { capture: true });

if (trackedChanges) {
  console.error('Commit or stash tracked changes before syncing with main:');
  console.error(trackedChanges);
  process.exit(1);
}

run('git', ['fetch', 'origin', 'main']);
run('git', ['rebase', 'origin/main']);
run('git', ['push', '--force-with-lease', 'origin', SANDBOX_BRANCH]);

console.log(`${SANDBOX_BRANCH} is now rebased on origin/main and pushed.`);
