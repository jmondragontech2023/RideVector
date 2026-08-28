#!/usr/bin/env node
/**
 * Regenerates apps/api/worker-configuration.d.ts without folding gitignored
 * `.dev.vars` secret names into the Env hash (keeps CI and local types aligned).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = fileURLToPath(new URL('../apps/api', import.meta.url));
const devVarsPath = join(apiRoot, '.dev.vars');
const hiddenDevVarsPath = join(apiRoot, '.dev.vars.__rv_types_gen__');

const hadDevVars = existsSync(devVarsPath);
if (hadDevVars) {
  if (existsSync(hiddenDevVarsPath)) {
    console.error(`Refusing to hide .dev.vars: leftover ${hiddenDevVarsPath} already exists.`);
    process.exit(1);
  }
  renameSync(devVarsPath, hiddenDevVarsPath);
}

let status = 1;
try {
  const result = spawnSync('pnpm', ['exec', 'wrangler', 'types'], {
    cwd: apiRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
  status = result.status ?? 1;
} finally {
  if (hadDevVars && existsSync(hiddenDevVarsPath)) {
    renameSync(hiddenDevVarsPath, devVarsPath);
  }
}

process.exit(status);
