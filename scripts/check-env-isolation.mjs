#!/usr/bin/env node
/**
 * Structured environment-isolation assertions for Milestone 0.
 *
 * Emits machine-readable rule IDs on stderr:
 *   RULE_ID=<ID> <human message>
 *
 * - Parses wrangler.jsonc per named env (does NOT allowlist the whole file).
 * - Asserts development/staging cannot resolve production Worker names, hosts,
 *   Supabase refs/URLs, or ENVIRONMENT=production.
 * - Scans non-production example/config files for production contamination.
 * - Supports --fixture <dir> for negative/positive fixture roots.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

/** Stable machine-readable isolation rule IDs. */
export const RULE = Object.freeze({
  NON_PROD_WORKER_POINTS_TO_PRODUCTION: 'NON_PROD_WORKER_POINTS_TO_PRODUCTION',
  NON_PROD_SUPABASE_POINTS_TO_PRODUCTION: 'NON_PROD_SUPABASE_POINTS_TO_PRODUCTION',
  NON_PROD_SUPABASE_POINTS_TO_DEFERRED: 'NON_PROD_SUPABASE_POINTS_TO_DEFERRED',
  CLIENT_CONTAINS_PRIVILEGED_SECRET: 'CLIENT_CONTAINS_PRIVILEGED_SECRET',
  REMOTE_DEPLOY_MISSING_EXPLICIT_ENV: 'REMOTE_DEPLOY_MISSING_EXPLICIT_ENV',
  LOCAL_DEV_USES_REMOTE_ENV: 'LOCAL_DEV_USES_REMOTE_ENV',
  WRANGLER_CONFIG_INVALID: 'WRANGLER_CONFIG_INVALID',
  FIXTURE_EXECUTION_ERROR: 'FIXTURE_EXECUTION_ERROR',
});

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

const { values: args } = parseArgs({
  options: {
    fixture: { type: 'string' },
  },
  strict: true,
});

const root = args.fixture ? resolve(repoRoot, args.fixture) : repoRoot;

const PRODUCTION_WORKER = 'ridevector-api-production';
const PRODUCTION_SUPABASE = 'ridevector-production';
const STAGING_SUPABASE = 'ridevector-staging';
/** Non-secret live development project ref (ADR-016). */
const LIVE_DEVELOPMENT_SUPABASE_REF = 'hsokwavqmqlkbtnftoqw';
const LIVE_DEVELOPMENT_SUPABASE_URL = `https://${LIVE_DEVELOPMENT_SUPABASE_REF}.supabase.co`;
const PRODUCTION_HOST_MARKERS = [
  'ridevector-api-production.',
  'workers.dev/ridevector-api-production',
];

/** Live staging/production Supabase markers forbidden in local/development config (ADR-016). */
const DEFERRED_REMOTE_SUPABASE_MARKERS = [
  STAGING_SUPABASE,
  PRODUCTION_SUPABASE,
  'supabase.co/ridevector-staging',
  'supabase.co/ridevector-production',
];

/** Known-safe docs/scripts that may name production identifiers. */
const DOC_ALLOWLIST = new Set([
  'scripts/check-env-isolation.mjs',
  'scripts/run-env-isolation-fixtures.mjs',
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
  '.temp',
]);

/** @type {{ ruleId: string, message: string }[]} */
const violations = [];

function fail(ruleId, message) {
  violations.push({ ruleId, message });
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
      RULE.NON_PROD_WORKER_POINTS_TO_PRODUCTION,
      `wrangler env.${envName}: Worker name "${name}" must not resolve production for non-production env`,
    );
  }
  if (vars.ENVIRONMENT === 'production') {
    fail(
      RULE.NON_PROD_WORKER_POINTS_TO_PRODUCTION,
      `wrangler env.${envName}: ENVIRONMENT must not be "production"`,
    );
  }
  const blob = JSON.stringify({ name, vars, routes, workersDev, supabaseRef });
  for (const marker of [PRODUCTION_WORKER, ...PRODUCTION_HOST_MARKERS]) {
    if (blob.includes(marker)) {
      fail(
        RULE.NON_PROD_WORKER_POINTS_TO_PRODUCTION,
        `wrangler env.${envName}: resolves production Worker marker "${marker}"`,
      );
    }
  }
  for (const marker of [PRODUCTION_SUPABASE, 'supabase.co/ridevector-production']) {
    if (blob.includes(marker)) {
      fail(
        RULE.NON_PROD_SUPABASE_POINTS_TO_PRODUCTION,
        `wrangler env.${envName}: resolves production Supabase marker "${marker}"`,
      );
    }
  }
  // Host / route checks: any route pattern or custom domain containing production Worker
  for (const route of routes) {
    const pattern = typeof route === 'string' ? route : (route.pattern ?? route.hostname ?? '');
    if (String(pattern).includes('production') || String(pattern).includes(PRODUCTION_WORKER)) {
      fail(
        RULE.NON_PROD_WORKER_POINTS_TO_PRODUCTION,
        `wrangler env.${envName}: route "${pattern}" looks like production`,
      );
    }
  }
}

function checkWranglerConfig() {
  const path = join(root, 'apps/api/wrangler.jsonc');
  if (!existsSync(path)) {
    fail(RULE.WRANGLER_CONFIG_INVALID, 'apps/api/wrangler.jsonc missing');
    return;
  }
  let config;
  try {
    config = loadWrangler(path);
  } catch (err) {
    fail(
      RULE.FIXTURE_EXECUTION_ERROR,
      `apps/api/wrangler.jsonc could not be parsed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return;
  }
  if (config.name !== 'ridevector-api') {
    fail(
      RULE.WRANGLER_CONFIG_INVALID,
      `wrangler base name must be ridevector-api, got "${config.name}"`,
    );
  }
  if (config.vars?.ENVIRONMENT === 'production') {
    fail(
      RULE.NON_PROD_WORKER_POINTS_TO_PRODUCTION,
      'wrangler top-level vars.ENVIRONMENT must not be production (local default)',
    );
  }
  const envs = config.env ?? {};
  for (const required of ['development', 'staging', 'production']) {
    if (!envs[required]) {
      fail(RULE.WRANGLER_CONFIG_INVALID, `wrangler missing env.${required}`);
    }
  }
  if (envs.development) {
    if (envs.development.name !== 'ridevector-api-development') {
      // Wrong name may also be production — classify production names separately.
      if (
        envs.development.name === PRODUCTION_WORKER ||
        String(envs.development.name).includes('production')
      ) {
        fail(
          RULE.NON_PROD_WORKER_POINTS_TO_PRODUCTION,
          `wrangler env.development.name must be ridevector-api-development, got "${envs.development.name}"`,
        );
      } else {
        fail(
          RULE.WRANGLER_CONFIG_INVALID,
          `wrangler env.development.name must be ridevector-api-development, got "${envs.development.name}"`,
        );
      }
    }
    const developmentUrl = envs.development.vars?.SUPABASE_URL;
    if (developmentUrl !== LIVE_DEVELOPMENT_SUPABASE_URL) {
      // Wrong URL may be production/deferred Supabase — classify those first.
      const urlText = String(developmentUrl ?? '');
      if (
        urlText.includes(PRODUCTION_SUPABASE) ||
        urlText.includes('supabase.co/ridevector-production')
      ) {
        fail(
          RULE.NON_PROD_SUPABASE_POINTS_TO_PRODUCTION,
          `wrangler env.development.vars.SUPABASE_URL must be live development ${LIVE_DEVELOPMENT_SUPABASE_URL}, got "${developmentUrl}"`,
        );
      } else if (
        urlText.includes(STAGING_SUPABASE) ||
        /REPLACE_ME_(STAGING|PRODUCTION)_REF/i.test(urlText)
      ) {
        fail(
          RULE.NON_PROD_SUPABASE_POINTS_TO_DEFERRED,
          `wrangler env.development.vars.SUPABASE_URL must be live development ${LIVE_DEVELOPMENT_SUPABASE_URL}, got "${developmentUrl}"`,
        );
      } else {
        fail(
          RULE.WRANGLER_CONFIG_INVALID,
          `wrangler env.development.vars.SUPABASE_URL must be live development ${LIVE_DEVELOPMENT_SUPABASE_URL}, got "${developmentUrl}"`,
        );
      }
    }
    assertNonProductionEnv('development', envs.development, config);
    assertNoDeferredSupabase('development', envs.development, config);
  }
  if (envs.staging) {
    if (envs.staging.name !== 'ridevector-api-staging') {
      if (
        envs.staging.name === PRODUCTION_WORKER ||
        String(envs.staging.name).includes('production')
      ) {
        fail(
          RULE.NON_PROD_WORKER_POINTS_TO_PRODUCTION,
          `wrangler env.staging.name must be ridevector-api-staging, got "${envs.staging.name}"`,
        );
      } else {
        fail(
          RULE.WRANGLER_CONFIG_INVALID,
          `wrangler env.staging.name must be ridevector-api-staging, got "${envs.staging.name}"`,
        );
      }
    }
    assertNonProductionEnv('staging', envs.staging, config);
  }
  if (envs.production) {
    if (envs.production.name !== PRODUCTION_WORKER) {
      fail(
        RULE.WRANGLER_CONFIG_INVALID,
        `wrangler env.production.name must be ${PRODUCTION_WORKER}, got "${envs.production.name}"`,
      );
    }
    if (envs.production.vars?.ENVIRONMENT !== 'production') {
      fail(
        RULE.WRANGLER_CONFIG_INVALID,
        'wrangler env.production.vars.ENVIRONMENT must be "production"',
      );
    }
  }
  // Local/base config must not point at deferred remote Supabase projects.
  assertNoDeferredSupabase('local(base)', { vars: config.vars ?? {} }, { vars: {} });
}

function assertNoDeferredSupabase(envName, envConfig, topLevel) {
  const vars = { ...(topLevel.vars ?? {}), ...(envConfig.vars ?? {}) };
  const supabaseBlob = JSON.stringify({
    SUPABASE_PROJECT_REF: vars.SUPABASE_PROJECT_REF,
    SUPABASE_URL: vars.SUPABASE_URL,
    SUPABASE_PROJECT_URL: vars.SUPABASE_PROJECT_URL,
  });
  for (const marker of DEFERRED_REMOTE_SUPABASE_MARKERS) {
    if (!supabaseBlob.includes(marker)) continue;
    const ruleId =
      marker === PRODUCTION_SUPABASE || marker.includes('ridevector-production')
        ? RULE.NON_PROD_SUPABASE_POINTS_TO_PRODUCTION
        : RULE.NON_PROD_SUPABASE_POINTS_TO_DEFERRED;
    fail(
      ruleId,
      `wrangler env.${envName}: must not resolve deferred/live staging|production Supabase marker "${marker}"`,
    );
  }
  // Reject accidental use of staging/production placeholder hosts in development/local.
  if (envName === 'development' || envName.startsWith('local')) {
    for (const url of [vars.SUPABASE_URL, vars.SUPABASE_PROJECT_URL, vars.SUPABASE_PROJECT_REF]) {
      if (!url) continue;
      if (/REPLACE_ME_(STAGING|PRODUCTION)_REF/i.test(String(url))) {
        fail(
          RULE.NON_PROD_SUPABASE_POINTS_TO_DEFERRED,
          `wrangler env.${envName}: must not use staging/production REPLACE_ME placeholders (got "${url}")`,
        );
      }
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
  for (const file of walk(root)) {
    const rel = relative(root, file);
    if (!shouldScanFile(rel)) continue;
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (text.includes(PRODUCTION_WORKER) || PRODUCTION_HOST_MARKERS.some((m) => text.includes(m))) {
      fail(
        RULE.NON_PROD_WORKER_POINTS_TO_PRODUCTION,
        `${rel} contains forbidden production Worker marker`,
      );
    }
    if (text.includes(PRODUCTION_SUPABASE) || text.includes('supabase.co/ridevector-production')) {
      fail(
        RULE.NON_PROD_SUPABASE_POINTS_TO_PRODUCTION,
        `${rel} contains forbidden production Supabase marker`,
      );
    }
    if (text.includes('SUPABASE_SERVICE_ROLE') || text.includes('SERVICE_ROLE_KEY')) {
      fail(
        RULE.CLIENT_CONTAINS_PRIVILEGED_SECRET,
        `${rel} contains forbidden privileged secret marker`,
      );
    }
  }
}

function checkPackageDeployScripts() {
  const pkgPath = join(root, 'apps/api/package.json');
  if (!existsSync(pkgPath)) return;
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  } catch (err) {
    fail(
      RULE.FIXTURE_EXECUTION_ERROR,
      `apps/api/package.json could not be parsed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return;
  }
  const scripts = pkg.scripts ?? {};
  if (scripts.dev && /--env\s+development/.test(scripts.dev)) {
    fail(
      RULE.LOCAL_DEV_USES_REMOTE_ENV,
      'apps/api package.json "dev" must use base local Wrangler config (no --env development)',
    );
  }
  if (scripts.deploy && !/--env/.test(scripts.deploy)) {
    fail(
      RULE.REMOTE_DEPLOY_MISSING_EXPLICIT_ENV,
      'apps/api must not expose an unnamed remote deploy script',
    );
  }
  for (const key of Object.keys(scripts)) {
    if (key === 'deploy' || key.startsWith('deploy:')) {
      const cmd = scripts[key];
      if (!/--env\s+(development|staging|production)/.test(cmd)) {
        fail(
          RULE.REMOTE_DEPLOY_MISSING_EXPLICIT_ENV,
          `apps/api script "${key}" must pass explicit --env development|staging|production`,
        );
      }
    }
  }
  if (
    !scripts['deploy:development'] ||
    !scripts['deploy:staging'] ||
    !scripts['deploy:production']
  ) {
    fail(
      RULE.WRANGLER_CONFIG_INVALID,
      'apps/api must define deploy:development, deploy:staging, and deploy:production',
    );
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
    if (text.includes(PRODUCTION_WORKER) || PRODUCTION_HOST_MARKERS.some((m) => text.includes(m))) {
      fail(
        RULE.NON_PROD_WORKER_POINTS_TO_PRODUCTION,
        `${rel} (${kind}) must not reference production Worker resources`,
      );
    }
    if (text.includes(PRODUCTION_SUPABASE)) {
      fail(
        RULE.NON_PROD_SUPABASE_POINTS_TO_PRODUCTION,
        `${rel} (${kind}) must not reference production Supabase resources`,
      );
    }
    if (
      (kind === 'development' || kind === 'local') &&
      (text.includes(STAGING_SUPABASE) || /REPLACE_ME_(STAGING|PRODUCTION)_REF/i.test(text))
    ) {
      fail(
        RULE.NON_PROD_SUPABASE_POINTS_TO_DEFERRED,
        `${rel} (${kind}) must not reference deferred staging/production Supabase resources`,
      );
    }
    if (/SERVICE_ROLE|service_role|DATABASE_URL\s*=\s*postgres/i.test(text)) {
      fail(
        RULE.CLIENT_CONTAINS_PRIVILEGED_SECRET,
        `${rel} must not contain service-role or database credential placeholders with real shapes`,
      );
    }
  }
}

function formatViolations(list) {
  return list.map((v) => `RULE_ID=${v.ruleId} ${v.message}`).join('\n');
}

function run() {
  try {
    checkWranglerConfig();
    checkPackageDeployScripts();
    checkExampleEnvIsolation();
    scanFilesForMarkers();
  } catch (err) {
    fail(
      RULE.FIXTURE_EXECUTION_ERROR,
      `isolation checker crashed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (violations.length > 0) {
    console.error('Environment isolation check failed:\n' + formatViolations(violations));
    process.exit(1);
  }

  console.log('Environment isolation check passed.');
}

run();
