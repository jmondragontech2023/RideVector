import { afterEach, describe, expect, it, vi } from 'vitest';
import { generatePocRoutes, PocApiError } from './api';

describe('generatePocRoutes client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts to the POC endpoint and returns JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          seed: 2,
          durationMs: 40,
          attemptedCount: 6,
          acceptedCount: 1,
          alternatives: [],
          rejections: {
            upstream_failure: 0,
            malformed_geometry: 0,
            outside_tolerance: 0,
            duplicate_candidate: 0,
            selection_limit: 0,
          },
          warnings: [],
          candidateDiagnostics: [],
          diagnosticSummary: {
            attemptedCount: 6,
            acceptedCount: 0,
            rejectionCounts: {
              upstream_failure: 0,
              malformed_geometry: 0,
              outside_tolerance: 0,
              duplicate_candidate: 0,
              selection_limit: 0,
            },
          },
          distanceFlexibilityMeters: 4828.032,
          requestedRangeMeters: { min: 5171.968, max: 14828.032 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await generatePocRoutes({
      start: { latitude: 37.77, longitude: -122.42 },
      targetDistanceMeters: 10_000,
      distanceFlexibilityMeters: 4828.032,
      costing: 'road',
      seed: 2,
    });

    expect(result.seed).toBe(2);
    expect(result.candidateDiagnostics).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('valhalla');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/poc/routes/generate');
    expect(init.method).toBe('POST');
  });

  it('maps API error envelopes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'VALIDATION_FAILED', message: 'bad' } }), {
          status: 400,
        }),
      ),
    );

    await expect(
      generatePocRoutes({
        start: { latitude: 37.77, longitude: -122.42 },
        targetDistanceMeters: 10_000,
        distanceFlexibilityMeters: 4828.032,
        costing: 'gravel',
      }),
    ).rejects.toBeInstanceOf(PocApiError);
  });
});
