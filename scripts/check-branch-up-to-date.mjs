import { spawnSync } from 'node:child_process';

const BASE_REF = process.env.BASE_REF || 'origin/main';
const HEAD_REF = process.env.HEAD_REF || 'HEAD';
const shouldFetch = process.argv.includes('--fetch');

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  });

  if (result.error) throw result.error;

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(output || `${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }

  return result.stdout?.trim() ?? '';
};

try {
  if (shouldFetch) {
    run('git', ['fetch', 'origin', 'main:refs/remotes/origin/main']);
  }

  const baseSha = run('git', ['rev-parse', BASE_REF], { capture: true });
  const headSha = run('git', ['rev-parse', HEAD_REF], { capture: true });
  const mergeBase = run('git', ['merge-base', BASE_REF, HEAD_REF], { capture: true });

  if (mergeBase !== baseSha) {
    console.error(`This branch is not up to date with ${BASE_REF}.`);
    console.error(`Expected ${BASE_REF} (${baseSha}) to be an ancestor of ${HEAD_REF} (${headSha}).`);
    console.error('Merge or rebase the latest main branch, then push again before creating a sandbox preview.');
    process.exit(1);
  }

  console.log(`${HEAD_REF} is up to date with ${BASE_REF}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
