import { describe, expect, it } from 'vitest';
import { DEFAULT_POC_FEATURES } from '../src/poc/features';
import { buildTrafficDiagnostics } from '../src/poc/enrichment';

describe('traffic diagnostics', () => {
  it('reports api key missing without claiming TomTom calls were made', () => {
    const diagnostics = buildTrafficDiagnostics({
      features: {
        ...DEFAULT_POC_FEATURES,
        motorTrafficEnrichment: true,
        motorTrafficScoring: true,
      },
      apiKeyConfigured: false,
      providerPresent: false,
      preference: 'prefer_lower',
      callsAttempted: 0,
      callOutcomes: { ok: 0, timeout: 0, error: 0, unavailable: 0 },
      httpStatusCounts: {},
      routesConsidered: 0,
      routesEnriched: 0,
      routesWithComparableCoverage: 0,
      rankingEnabled: false,
    });
    expect(diagnostics.providerInvoked).toBe(false);
    expect(diagnostics.apiKeyConfigured).toBe(false);
    expect(diagnostics.callsAttempted).toBe(0);
    expect(diagnostics.rankingDisabledReason).toBe('api_key_missing');
  });

  it('reports call outcomes when TomTom sampling ran but coverage is insufficient', () => {
    const diagnostics = buildTrafficDiagnostics({
      features: {
        ...DEFAULT_POC_FEATURES,
        motorTrafficEnrichment: true,
        motorTrafficScoring: true,
      },
      apiKeyConfigured: true,
      providerPresent: true,
      preference: 'prefer_lower',
      callsAttempted: 9,
      callOutcomes: { ok: 3, timeout: 4, error: 2, unavailable: 0 },
      httpStatusCounts: { '429': 2, '200': 3 },
      routesConsidered: 3,
      routesEnriched: 3,
      routesWithComparableCoverage: 1,
      rankingEnabled: false,
    });
    expect(diagnostics.providerInvoked).toBe(true);
    expect(diagnostics.callsAttempted).toBe(9);
    expect(diagnostics.callOutcomes.ok).toBe(3);
    expect(diagnostics.rankingDisabledReason).toBe('insufficient_comparable_coverage');
  });
});
