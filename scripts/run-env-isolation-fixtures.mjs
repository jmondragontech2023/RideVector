#!/usr/bin/env node
/**
 * Runs env-isolation fixtures with rule-ID-specific assertions.
 *
 * Each fixture directory under scripts/fixtures/ named env-isolation-* must
 * contain expect.json:
 *   { "kind": "positive" }
 *   { "kind": "negative", "expectedRuleIds": ["RULE_ID", ...] }
 *
 * Negative fixtures pass only when the checker fails AND every expected rule ID
 * appears in machine-readable output. An unrelated failure or different rule ID
 * does not satisfy the fixture.
 *
 * Includes a harness self-test proving malformed expect/config handling is
 * reported as a test failure (not accepted as an isolation violation).
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const fixturesRoot = join(root, 'scripts/fixtures');
const checker = join(root, 'scripts/check-env-isolation.mjs');

const RULE_ID_RE = /^RULE_ID=([A-Z][A-Z0-9_]*)\s/gm;

/**
 * @param {string} output
 * @returns {string[]}
 */
export function parseRuleIds(output) {
  const ids = [];
  for (const match of output.matchAll(RULE_ID_RE)) {
    ids.push(match[1]);
  }
  return ids;
}

/**
 * @param {{ status: number | null, stdout: string, stderr: string }} result
 * @param {{ kind: string, expectedRuleIds?: string[] }} expectation
 * @returns {{ ok: boolean, reason: string }}
 */
export function evaluateFixtureResult(result, expectation) {
  const combined = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const ruleIds = parseRuleIds(combined);

  if (expectation.kind === 'positive') {
    if (result.status !== 0) {
      return {
        ok: false,
        reason: `expected pass, checker exited ${result.status}; rules=${ruleIds.join(',') || '(none)'}`,
      };
    }
    if (ruleIds.length > 0) {
      return {
        ok: false,
        reason: `expected pass with no RULE_ID lines, got ${ruleIds.join(',')}`,
      };
    }
    return { ok: true, reason: 'passed' };
  }

  if (expectation.kind !== 'negative') {
    return { ok: false, reason: `unsupported expect kind "${expectation.kind}"` };
  }

  const expected = expectation.expectedRuleIds ?? [];
  if (!Array.isArray(expected) || expected.length === 0) {
    return { ok: false, reason: 'negative fixture requires non-empty expectedRuleIds' };
  }

  if (result.status === 0) {
    return { ok: false, reason: 'expected checker failure, but checker passed' };
  }

  // Malformed/crash-only failures must not satisfy a specific isolation rule.
  if (ruleIds.length === 0) {
    return {
      ok: false,
      reason: 'checker failed without machine-readable RULE_ID lines (malformed execution)',
    };
  }

  const missing = expected.filter((id) => !ruleIds.includes(id));
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `expected rule ID(s) ${missing.join(', ')} not present; observed ${ruleIds.join(',')}`,
    };
  }

  return { ok: true, reason: `failed with required rule(s) ${expected.join(', ')}` };
}

/**
 * @param {string} fixtureDir absolute path
 */
function loadExpectation(fixtureDir) {
  const expectPath = join(fixtureDir, 'expect.json');
  if (!existsSync(expectPath)) {
    throw new Error(`missing expect.json in ${fixtureDir}`);
  }
  let raw;
  try {
    raw = JSON.parse(readFileSync(expectPath, 'utf8'));
  } catch (err) {
    throw new Error(
      `malformed expect.json in ${fixtureDir}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!raw || typeof raw !== 'object' || typeof raw.kind !== 'string') {
    throw new Error(`malformed expect.json in ${fixtureDir}: kind is required`);
  }
  if (raw.kind === 'negative') {
    if (!Array.isArray(raw.expectedRuleIds) || raw.expectedRuleIds.length === 0) {
      throw new Error(
        `malformed expect.json in ${fixtureDir}: negative fixtures need expectedRuleIds`,
      );
    }
    if (!raw.expectedRuleIds.every((id) => typeof id === 'string' && id.length > 0)) {
      throw new Error(`malformed expect.json in ${fixtureDir}: expectedRuleIds must be strings`);
    }
  } else if (raw.kind !== 'positive') {
    throw new Error(`malformed expect.json in ${fixtureDir}: unknown kind "${raw.kind}"`);
  }
  return raw;
}

function runChecker(fixtureRelOrAbs) {
  return spawnSync(process.execPath, [checker, '--fixture', fixtureRelOrAbs], {
    cwd: root,
    encoding: 'utf8',
  });
}

function runHarnessSelfTests() {
  /** @type {string[]} */
  const failures = [];

  // 1) Wrong rule ID must not satisfy a negative fixture.
  {
    const fake = {
      status: 1,
      stdout: '',
      stderr:
        'Environment isolation check failed:\nRULE_ID=CLIENT_CONTAINS_PRIVILEGED_SECRET example\n',
    };
    const verdict = evaluateFixtureResult(fake, {
      kind: 'negative',
      expectedRuleIds: ['NON_PROD_WORKER_POINTS_TO_PRODUCTION'],
    });
    if (verdict.ok) {
      failures.push('self-test: wrong rule ID was incorrectly accepted');
    }
  }

  // 2) Checker pass must not satisfy a negative fixture.
  {
    const fake = { status: 0, stdout: 'Environment isolation check passed.\n', stderr: '' };
    const verdict = evaluateFixtureResult(fake, {
      kind: 'negative',
      expectedRuleIds: ['NON_PROD_WORKER_POINTS_TO_PRODUCTION'],
    });
    if (verdict.ok) {
      failures.push('self-test: unexpected checker pass was incorrectly accepted');
    }
  }

  // 3) Failure without RULE_ID lines (malformed execution) must not be accepted.
  {
    const fake = {
      status: 1,
      stdout: '',
      stderr: 'SyntaxError: Unexpected token\n',
    };
    const verdict = evaluateFixtureResult(fake, {
      kind: 'negative',
      expectedRuleIds: ['NON_PROD_SUPABASE_POINTS_TO_PRODUCTION'],
    });
    if (verdict.ok) {
      failures.push('self-test: malformed checker output was incorrectly accepted');
    }
  }

  // 4) Missing/malformed expect.json must surface as harness failure, not isolation success.
  {
    const tmp = mkdtempSync(join(tmpdir(), 'rv-env-isolation-'));
    try {
      writeFileSync(join(tmp, 'expect.json'), '{ not-json', 'utf8');
      try {
        loadExpectation(tmp);
        failures.push('self-test: malformed expect.json did not throw');
      } catch {
        // expected
      }

      const tmp2 = mkdtempSync(join(tmpdir(), 'rv-env-isolation-missing-'));
      try {
        try {
          loadExpectation(tmp2);
          failures.push('self-test: missing expect.json did not throw');
        } catch {
          // expected
        }
      } finally {
        rmSync(tmp2, { recursive: true, force: true });
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }

  // 5) On-disk malformed wrangler must emit FIXTURE_EXECUTION_ERROR and must not
  //    satisfy an unrelated expected isolation rule.
  {
    const tmp = mkdtempSync(join(tmpdir(), 'rv-env-isolation-badcfg-'));
    try {
      mkdirSync(join(tmp, 'apps/api'), { recursive: true });
      writeFileSync(join(tmp, 'apps/api/wrangler.jsonc'), '{ not valid jsonc {{{', 'utf8');
      writeFileSync(
        join(tmp, 'apps/api/package.json'),
        JSON.stringify({
          name: '@ridevector/api',
          private: true,
          scripts: {
            dev: 'wrangler dev',
            'deploy:development': 'wrangler deploy --env development',
            'deploy:staging': 'wrangler deploy --env staging',
            'deploy:production': 'wrangler deploy --env production',
          },
        }),
        'utf8',
      );
      const result = runChecker(tmp);
      const verdict = evaluateFixtureResult(result, {
        kind: 'negative',
        expectedRuleIds: ['NON_PROD_WORKER_POINTS_TO_PRODUCTION'],
      });
      if (verdict.ok) {
        failures.push(
          'self-test: malformed wrangler failure was incorrectly accepted as NON_PROD_WORKER_POINTS_TO_PRODUCTION',
        );
      }
      const ids = parseRuleIds(`${result.stdout ?? ''}\n${result.stderr ?? ''}`);
      if (!ids.includes('FIXTURE_EXECUTION_ERROR')) {
        failures.push(
          `self-test: expected FIXTURE_EXECUTION_ERROR for malformed wrangler, got ${ids.join(',') || '(none)'}`,
        );
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }

  // 6) Correct rule ID + failure must pass evaluation.
  {
    const fake = {
      status: 1,
      stdout: '',
      stderr:
        'Environment isolation check failed:\nRULE_ID=NON_PROD_WORKER_POINTS_TO_PRODUCTION bad worker\n',
    };
    const verdict = evaluateFixtureResult(fake, {
      kind: 'negative',
      expectedRuleIds: ['NON_PROD_WORKER_POINTS_TO_PRODUCTION'],
    });
    if (!verdict.ok) {
      failures.push(`self-test: correct rule ID should pass evaluation (${verdict.reason})`);
    }
  }

  return failures;
}

const fixtures = readdirSync(fixturesRoot)
  .filter((name) => {
    const st = statSync(join(fixturesRoot, name));
    return st.isDirectory() && name.startsWith('env-isolation-');
  })
  .sort();

if (fixtures.length === 0) {
  console.error('No env-isolation fixtures found under scripts/fixtures/');
  process.exit(1);
}

let failed = false;

const selfTestFailures = runHarnessSelfTests();
if (selfTestFailures.length > 0) {
  failed = true;
  console.error('Harness self-tests failed:');
  for (const msg of selfTestFailures) console.error(` - ${msg}`);
} else {
  console.log('Harness self-tests passed.');
}

for (const name of fixtures) {
  const fixtureDir = join(fixturesRoot, name);
  let expectation;
  try {
    expectation = loadExpectation(fixtureDir);
  } catch (err) {
    failed = true;
    console.error(`Fixture ${name}: ${err instanceof Error ? err.message : String(err)}`);
    continue;
  }

  const result = runChecker(join('scripts/fixtures', name));
  const verdict = evaluateFixtureResult(result, expectation);
  if (!verdict.ok) {
    failed = true;
    console.error(`Fixture ${name} failed: ${verdict.reason}`);
    console.error(result.stdout || '');
    console.error(result.stderr || '');
  } else {
    console.log(`Fixture ${name}: ${verdict.reason}`);
  }
}

if (failed) process.exit(1);
console.log(`All ${fixtures.length} env-isolation fixtures passed (with harness self-tests).`);
