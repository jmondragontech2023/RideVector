#!/usr/bin/env node
/**
 * Structured environment-isolation assertions for Milestone 0.
 *
 * - Parses wrangler.jsonc per named env (does NOT allowlist the whole file).
 * - Asserts development/staging cannot resolve production Worker names, hosts,
 *   Supabase refs/URLs, or ENVIRONMENT=production.
 * - Scans non-production example/config files for production contamination.
 * - Supports --fixture <dir> for negative tests.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

const { values: args } = parseArgs({
  options: {
    fixture: { type: 'string' },
    'expect-fail': { type: 'boolean', default: false },
  },
  strict: true,
});

const root = args.fixture ? resolve(repoRoot, args.fixture) : repoRoot;

const PRODUCTION_WORKER = 'ridevector-api-production';
const PRODUCTION_SUPABASE = 'ridevector-production';
const PRODUCTION_HOST_MARKERS = [
  'ridevector-api-production.',
  'workers.dev/ridevector-api-production',
];

/** Known-safe docs/scripts that may name production identifiers. */
const DOC_ALLOWLIST = new Set([
  'scripts/check-env-isolation.mjs',
  'scripts/check-client-bundle-secrets.mjs',
  'scripts/check-wrangler-types.mjs',
  '.github/workflows/deploy-production.yml',
  '.env.production.example',
  'apps/web/.env.production.example',
  'apps/api/.env.production.example',
]);

const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.wrangler',
  '.mf',
  'coverage',
  '.cursor',
  'fixtures',
]);

const violations = [];

function fail(message) {
  violations.push(message);
}

function stripJsonc(text) {
  // Remove // line comments and /* */ blocks outside strings (good enough for wrangler.jsonc).
  let out = '';
  let i = 0;
  let inString = false;
  let quote = '';
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (inString) {
      out += c;
      if (c === '\\' && i + 1 < text.length) {
        out += text[i + 1];
        i += 2;
        continue;
      }
      if (c === quote) inString = false;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      quote = c;
      out += c;
      i += 1;
      continue;
    }
    if (c === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i + 1 < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    out += c;
    i += 1;
  }
  // Trailing commas
  return out.replace(/,\s*([}\]])/g, '$1');
}

function loadWrangler(path) {
  const raw = readFileSync(path, 'utf8');
  return JSON.parse(stripJsonc(raw));
}

function assertNonProductionEnv(envName, envConfig, topLevel) {
  const name = envConfig.name ?? topLevel.name;
  const vars = { ...(topLevel.vars ?? {}), ...(envConfig.vars ?? {}) };
  const routes = envConfig.routes ?? topLevel.routes ?? [];
  const workersDev = envConfig.workers_dev ?? topLevel.workers_dev;
  const supabaseRef =
    vars.SUPABASE_PROJECT_REF ?? vars.SUPABASE_URL ?? vars.SUPABASE_PROJECT_URL ?? '';

  if (name === PRODUCTION_WORKER || String(name).includes('production')) {
    fail(
      `wrangler env.${envName}: Worker name "${name}" must not resolve production for non-production env`,
    );
  }
  if (vars.ENVIRONMENT === 'production') {
    fail(`wrangler env.${envName}: ENVIRONMENT must not be "production"`);
  }
  const blob = JSON.stringify({ name, vars, routes, workersDev, supabaseRef });
  for (const marker of [
    PRODUCTION_WORKER,
    PRODUCTION_SUPABASE,
    ...PRODUCTION_HOST_MARKERS,
    'supabase.co/ridevector-production',
  ]) {
    if (blob.includes(marker)) {
      fail(`wrangler env.${envName}: resolves production marker "${marker}"`);
    }
  }
  // Host / route checks: any route pattern or custom domain containing production Worker
  for (const route of routes) {
    const pattern = typeof route === 'string' ? route : (route.pattern ?? route.hostname ?? '');
    if (String(pattern).includes('production') || String(pattern).includes(PRODUCTION_WORKER)) {
      fail(`wrangler env.${envName}: route "${pattern}" looks like production`);
    }
  }
}

function checkWranglerConfig() {
  const path = join(root, 'apps/api/wrangler.jsonc');
  if (!existsSync(path)) {
    fail('apps/api/wrangler.jsonc missing');
    return;
  }
  const config = loadWrangler(path);
  if (config.name !== 'ridevector-api') {
    fail(`wrangler base name must be ridevector-api, got "${config.name}"`);
  }
  if (config.vars?.ENVIRONMENT === 'production') {
    fail('wrangler top-level vars.ENVIRONMENT must not be production (local default)');
  }
  const envs = config.env ?? {};
  for (const required of ['development', 'staging', 'production']) {
    if (!envs[required]) fail(`wrangler missing env.${required}`);
  }
  if (envs.development) {
    if (envs.development.name !== 'ridevector-api-development') {
      fail(
        `wrangler env.development.name must be ridevector-api-development, got "${envs.development.name}"`,
      );
    }
    assertNonProductionEnv('development', envs.development, config);
  }
  if (envs.staging) {
    if (envs.staging.name !== 'ridevector-api-staging') {
      fail(`wrangler env.staging.name must be ridevector-api-staging, got "${envs.staging.name}"`);
    }
    assertNonProductionEnv('staging', envs.staging, config);
  }
  if (envs.production) {
    if (envs.production.name !== PRODUCTION_WORKER) {
      fail(
        `wrangler env.production.name must be ${PRODUCTION_WORKER}, got "${envs.production.name}"`,
      );
    }
    if (envs.production.vars?.ENVIRONMENT !== 'production') {
      fail('wrangler env.production.vars.ENVIRONMENT must be "production"');
    }
  }
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    let st;
    try {
      st = statSync(path);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

function shouldScanFile(rel) {
  if (DOC_ALLOWLIST.has(rel)) return false;
  if (rel.endsWith('.md')) return false;
  if (rel.startsWith('scripts/fixtures/')) return false;
  // Example env files for production are allowlisted above; scan other env examples.
  if (rel.includes('.env') && !rel.includes('production')) return true;
  if (rel.includes('.dev.vars') && !rel.includes('production')) return true;
  if (rel === 'package.json' || rel.endsWith('/package.json')) return true;
  if (rel.startsWith('.github/workflows/') && !rel.includes('production')) return true;
  if (
    rel.startsWith('apps/') &&
    (rel.endsWith('.ts') ||
      rel.endsWith('.tsx') ||
      rel.endsWith('.js') ||
      rel.endsWith('.mjs') ||
      rel.endsWith('.json') ||
      rel.endsWith('.jsonc'))
  ) {
    // wrangler.jsonc is asserted structurally — still scan other app JSON.
    if (rel === 'apps/api/wrangler.jsonc') return false;
    return true;
  }
  return false;
}

function scanFilesForMarkers() {
  const markers = [
    PRODUCTION_WORKER,
    PRODUCTION_SUPABASE,
    'SUPABASE_SERVICE_ROLE',
    'SERVICE_ROLE_KEY',
  ];
  for (const file of walk(root)) {
    const rel = relative(root, file);
    if (!shouldScanFile(rel)) continue;
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const marker of markers) {
      if (text.includes(marker)) {
        fail(`${rel} contains forbidden production/secret marker: ${marker}`);
      }
    }
  }
}

function checkPackageDeployScripts() {
  const pkgPath = join(root, 'apps/api/package.json');
  if (!existsSync(pkgPath)) return;
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const scripts = pkg.scripts ?? {};
  if (scripts.dev && /--env\s+development/.test(scripts.dev)) {
    fail('apps/api package.json "dev" must use base local Wrangler config (no --env development)');
  }
  if (scripts.deploy && !/--env/.test(scripts.deploy)) {
    fail('apps/api must not expose an unnamed remote deploy script');
  }
  for (const key of Object.keys(scripts)) {
    if (key === 'deploy' || key.startsWith('deploy:')) {
      const cmd = scripts[key];
      if (!/--env\s+(development|staging|production)/.test(cmd)) {
        fail(`apps/api script "${key}" must pass explicit --env development|staging|production`);
      }
    }
  }
  if (
    !scripts['deploy:development'] ||
    !scripts['deploy:staging'] ||
    !scripts['deploy:production']
  ) {
    fail('apps/api must define deploy:development, deploy:staging, and deploy:production');
  }
}

function checkExampleEnvIsolation() {
  const pairs = [
    ['apps/web/.env.development.example', 'development'],
    ['apps/web/.env.staging.example', 'staging'],
    ['apps/api/.env.development.example', 'development'],
    ['apps/api/.env.staging.example', 'staging'],
    ['apps/api/.dev.vars.example', 'local'],
    ['.env.example', 'local'],
  ];
  for (const [rel, kind] of pairs) {
    const path = join(root, rel);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, 'utf8');
    if (text.includes(PRODUCTION_WORKER) || text.includes(PRODUCTION_SUPABASE)) {
      fail(`${rel} (${kind}) must not reference production resources`);
    }
    if (/SERVICE_ROLE|service_role|DATABASE_URL\s*=\s*postgres/i.test(text)) {
      fail(
        `${rel} must not contain service-role or database credential placeholders with real shapes`,
      );
    }
  }
}

checkWranglerConfig();
checkPackageDeployScripts();
checkExampleEnvIsolation();
scanFilesForMarkers();

const expectFail = Boolean(args['expect-fail']);
if (violations.length > 0) {
  console.error(
    'Environment isolation check failed:\n' + violations.map((v) => ` - ${v}`).join('\n'),
  );
  process.exit(expectFail ? 0 : 1);
}

if (expectFail) {
  console.error('Environment isolation check unexpectedly passed (expected failures).');
  process.exit(1);
}

console.log('Environment isolation check passed.');
