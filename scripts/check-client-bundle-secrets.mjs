#!/usr/bin/env node
/**
 * Fails if the web client source or production build artifacts contain
 * privileged secrets (service-role keys, DB credentials, provider secrets,
 * signing secrets). CI builds the web app before this runs when invoked via
 * `pnpm run check:client-bundle-secrets` after `pnpm --filter @ridevector/web build`.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const FORBIDDEN_PATTERNS = [
  { name: 'supabase-service-role-jwt', re: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/ },
  { name: 'service-role-key-literal', re: /service[_-]?role[_-]?key\s*[:=]\s*['"][^'"]+['"]/i },
  { name: 'SUPABASE_SERVICE_ROLE', re: /SUPABASE_SERVICE_ROLE/ },
  { name: 'DATABASE_URL postgres', re: /postgres(?:ql)?:\/\/[^\s'"]+/i },
  { name: 'signing-secret assignment', re: /SIGNING_SECRET\s*[:=]\s*['"][^'"]+['"]/i },
  {
    name: 'provider-secret assignment',
    re: /(?:TOMTOM|VALHALLA|WEATHER|MAPBOX)_API_KEY\s*[:=]\s*['"][^'"]+['"]/i,
  },
  { name: 'cloudflare-api-token assignment', re: /CLOUDFLARE_API_TOKEN\s*[:=]\s*['"][^'"]+['"]/ },
];

const SKIP_DIRS = new Set(['node_modules', '.git', 'coverage', '.wrangler']);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

function scanFile(file, violations) {
  const rel = relative(root, file);
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return;
  }
  for (const { name, re } of FORBIDDEN_PATTERNS) {
    if (re.test(text)) {
      violations.push(`${rel} matches forbidden pattern: ${name}`);
    }
  }
}

const violations = [];
const webSrc = join(root, 'apps/web/src');
const webDist = join(root, 'apps/web/dist');
const webExamples = [
  join(root, 'apps/web/.env.development.example'),
  join(root, 'apps/web/.env.staging.example'),
  join(root, 'apps/web/.env.production.example'),
];

for (const file of walk(webSrc)) {
  if (/\.(ts|tsx|js|jsx|css|html|json)$/.test(file)) scanFile(file, violations);
}
if (existsSync(webDist)) {
  for (const file of walk(webDist)) {
    if (/\.(js|mjs|cjs|html|map|css)$/.test(file)) scanFile(file, violations);
  }
} else {
  console.warn(
    'apps/web/dist missing — scanning source and examples only. Run web build before relying on bundle scan.',
  );
}
for (const file of webExamples) {
  if (existsSync(file)) scanFile(file, violations);
}

// VITE_ must never expose service-role-shaped names in committed web env examples
for (const file of webExamples) {
  if (!existsSync(file)) continue;
  const text = readFileSync(file, 'utf8');
  for (const line of text.split('\n')) {
    if (/^VITE_.*SERVICE_ROLE|^VITE_.*SECRET|^VITE_.*DATABASE/i.test(line)) {
      violations.push(`${relative(root, file)} exposes privileged name via VITE_: ${line.trim()}`);
    }
  }
}

if (violations.length > 0) {
  console.error(
    'Client bundle/secret check failed:\n' + violations.map((v) => ` - ${v}`).join('\n'),
  );
  process.exit(1);
}

console.log('Client bundle/secret check passed.');
