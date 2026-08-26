#!/usr/bin/env node
/**
 * Fails if non-production config resolves production identifiers.
 * Scans committed example/config files that could be used as non-prod defaults.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const productionMarkers = [
  'ridevector-api-production',
  'ridevector-production',
  'SUPABASE_URL_PRODUCTION',
];

const skipDirNames = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.wrangler',
  '.mf',
  'coverage',
  '.cursor',
]);

/** Relative paths that may document production names. */
const allowlist = new Set([
  'scripts/check-env-isolation.mjs',
  'apps/api/wrangler.jsonc',
  '.github/workflows/deploy-production.yml',
  '.env.production.example',
  'apps/web/.env.production.example',
  'apps/api/.env.production.example',
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (skipDirNames.has(name)) continue;
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

function shouldScan(rel) {
  if (allowlist.has(rel)) return false;
  if (rel.endsWith('.md')) return false;
  if (rel.startsWith('.github/workflows/') && !rel.includes('production')) return true;
  if (rel.includes('.env') && !rel.includes('production')) return true;
  if (
    rel.startsWith('apps/') &&
    (rel.endsWith('.ts') || rel.endsWith('.tsx') || rel.endsWith('.js'))
  ) {
    return true;
  }
  if (rel === 'package.json' || rel.endsWith('/package.json')) return true;
  return false;
}

const files = walk(root);
const violations = [];

for (const file of files) {
  const rel = relative(root, file);
  if (!shouldScan(rel)) continue;

  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  for (const marker of productionMarkers) {
    if (text.includes(marker)) {
      violations.push(`${rel} contains production marker: ${marker}`);
    }
  }
}

if (violations.length > 0) {
  console.error(
    'Environment isolation check failed:\n' + violations.map((v) => ` - ${v}`).join('\n'),
  );
  process.exit(1);
}

console.log('Environment isolation check passed.');
