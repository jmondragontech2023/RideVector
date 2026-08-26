#!/usr/bin/env node
/**
 * Ensures apps/api/worker-configuration.d.ts matches `wrangler types` output.
 * Prefer `wrangler types --check` when the pinned Wrangler supports it; otherwise
 * regenerate to a temp file and diff.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const apiRoot = fileURLToPath(new URL('../apps/api', import.meta.url));
const committed = join(apiRoot, 'worker-configuration.d.ts');

if (!existsSync(committed)) {
  console.error(
    'Missing apps/api/worker-configuration.d.ts — run: pnpm --filter @ridevector/api run types',
  );
  process.exit(1);
}

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
    process.exit(result.status ?? 1);
  }
  console.log('Wrangler binding types check passed (--check).');
  process.exit(0);
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
    process.exit(gen.status ?? 1);
  }
  const a = readFileSync(committed, 'utf8');
  const b = readFileSync(tmpFile, 'utf8');
  if (a !== b) {
    console.error(
      'apps/api/worker-configuration.d.ts is out of date vs `wrangler types`.\nRun: pnpm --filter @ridevector/api run types',
    );
    process.exit(1);
  }
  console.log('Wrangler binding types check passed (diff).');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
