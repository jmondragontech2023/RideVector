#!/usr/bin/env node
/**
 * Runs negative env-isolation fixtures; each must fail the isolation check.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const fixturesRoot = join(root, 'scripts/fixtures');
const checker = join(root, 'scripts/check-env-isolation.mjs');

const fixtures = readdirSync(fixturesRoot).filter((name) => {
  const st = statSync(join(fixturesRoot, name));
  return st.isDirectory() && name.startsWith('env-isolation-');
});

if (fixtures.length === 0) {
  console.error('No env-isolation fixtures found under scripts/fixtures/');
  process.exit(1);
}

let failed = false;
for (const name of fixtures) {
  const result = spawnSync(
    process.execPath,
    [checker, '--fixture', join('scripts/fixtures', name), '--expect-fail'],
    { cwd: root, encoding: 'utf8' },
  );
  if (result.status !== 0) {
    failed = true;
    console.error(`Fixture ${name} did not fail as expected:`);
    console.error(result.stdout || '');
    console.error(result.stderr || '');
  } else {
    console.log(`Fixture ${name}: correctly failed isolation check.`);
  }
}

if (failed) process.exit(1);
console.log(`All ${fixtures.length} negative env-isolation fixtures passed.`);
