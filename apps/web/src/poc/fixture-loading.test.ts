import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'App.tsx'),
  'utf8',
);

describe('App fixture loading during generation', () => {
  it('resets generation status when a fixture is loaded mid-request', () => {
    const applyFixtureBlock = appSource.slice(
      appSource.indexOf('function applyFixture'),
      appSource.indexOf('function handleSaveSelected'),
    );
    expect(applyFixtureBlock).toContain('clearGenerationResults()');
    expect(appSource).toContain("setStatus('idle')");
  });
});
