#!/usr/bin/env node
/**
 * Ensures apps/api/worker-configuration.d.ts matches `wrangler types` output.
 * Prefer `wrangler types --check` when the pinned Wrangler supports it; otherwise
 * regenerate to a temp file and diff.
 *
 * Optional secrets live in gitignored `.dev.vars`. Wrangler otherwise folds those
 * keys into the Env hash, so local checks would disagree with clean CI checkouts.
 * Hide `.dev.vars` for the duration of this check (and restore afterward).
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const apiRoot = fileURLToPath(new URL('../apps/api', import.meta.url));
const committed = join(apiRoot, 'worker-configuration.d.ts');
const devVarsPath = join(apiRoot, '.dev.vars');
const hiddenDevVarsPath = join(apiRoot, '.dev.vars.__rv_types_check__');

if (!existsSync(committed)) {
  console.error(
    'Missing apps/api/worker-configuration.d.ts — run: pnpm --filter @ridevector/api run types',
  );
  process.exit(1);
}

function withHiddenDevVars(run) {
  const hadDevVars = existsSync(devVarsPath);
  if (hadDevVars) {
    if (existsSync(hiddenDevVarsPath)) {
      console.error(`Refusing to hide .dev.vars: leftover ${hiddenDevVarsPath} already exists.`);
      process.exit(1);
    }
    renameSync(devVarsPath, hiddenDevVarsPath);
  }
  try {
    return run();
  } finally {
    if (hadDevVars && existsSync(hiddenDevVarsPath)) {
      renameSync(hiddenDevVarsPath, devVarsPath);
    }
  }
}

const exitCode = withHiddenDevVars(() => {
  const help = spawnSync('pnpm', ['exec', 'wrangler', 'types', '--help'], {
    cwd: apiRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  const helpText = `${help.stdout ?? ''}${help.stderr ?? ''}`;
  const supportsCheck = /--check\b/.test(helpText);

  if (supportsCheck) {
    const result = spawnSync('pnpm', ['exec', 'wrangler', 'types', '--check'], {
      cwd: apiRoot,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    if (result.status !== 0) {
      console.error(result.stdout || '');
      console.error(result.stderr || '');
      console.error(
        'Generated Wrangler binding types are out of date. Run: pnpm --filter @ridevector/api run types',
      );
      return result.status ?? 1;
    }
    console.log('Wrangler binding types check passed (--check).');
    return 0;
  }

  const dir = mkdtempSync(join(tmpdir(), 'rv-wrangler-types-'));
  const tmpFile = join(dir, 'worker-configuration.d.ts');
  try {
    const gen = spawnSync('pnpm', ['exec', 'wrangler', 'types', tmpFile], {
      cwd: apiRoot,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    if (gen.status !== 0) {
      console.error(gen.stdout || '');
      console.error(gen.stderr || '');
      console.error('Failed to generate Wrangler types for comparison.');
      return gen.status ?? 1;
    }
    const a = readFileSync(committed, 'utf8');
    const b = readFileSync(tmpFile, 'utf8');
    if (a !== b) {
      console.error(
        'apps/api/worker-configuration.d.ts is out of date vs `wrangler types`.\nRun: pnpm --filter @ridevector/api run types',
      );
      return 1;
    }
    console.log('Wrangler binding types check passed (diff).');
    return 0;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

process.exit(exitCode);
