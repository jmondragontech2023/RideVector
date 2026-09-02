import type { PocTrafficDiagnostics } from './types';

type Props = {
  diagnostics: PocTrafficDiagnostics;
};

function reasonLabel(reason: PocTrafficDiagnostics['rankingDisabledReason']): string {
  switch (reason) {
    case 'enrichment_disabled':
      return 'Traffic enrichment is off';
    case 'scoring_disabled':
      return 'Traffic scoring is off (enrichment may still run)';
    case 'api_key_missing':
      return 'TOMTOM_API_KEY is not configured in apps/api/.dev.vars';
    case 'no_provider':
      return 'Traffic provider was not attached';
    case 'no_calls_attempted':
      return 'No TomTom sample calls were attempted';
    case 'insufficient_comparable_coverage':
      return 'Fewer than two routes reached the comparable-coverage threshold';
    case 'preference_none':
      return 'Traffic preference is “No preference”';
    default:
      return 'n/a';
  }
}

export function TrafficDiagnosticsPanel({ diagnostics }: Props) {
  const outcomes = diagnostics.callOutcomes;
  return (
    <section className="traffic-diagnostics" aria-label="Traffic enrichment diagnostics">
      <h2>Traffic debug</h2>
      <p className="subtle">
        Safe summary of TomTom sample attempts for this generation. No API keys, URLs, or
        coordinates are shown.
      </p>
      <dl className="traffic-diagnostics-grid">
        <dt>API key configured</dt>
        <dd>{diagnostics.apiKeyConfigured ? 'yes' : 'no'}</dd>
        <dt>Provider invoked</dt>
        <dd>{diagnostics.providerInvoked ? 'yes — TomTom calls were made' : 'no'}</dd>
        <dt>Calls attempted</dt>
        <dd>{diagnostics.callsAttempted}</dd>
        <dt>Call outcomes</dt>
        <dd>
          ok {outcomes.ok} · timeout {outcomes.timeout} · error {outcomes.error} · unavailable{' '}
          {outcomes.unavailable}
        </dd>
        <dt>HTTP statuses</dt>
        <dd>
          {Object.keys(diagnostics.httpStatusCounts).length === 0
            ? 'none'
            : Object.entries(diagnostics.httpStatusCounts)
                .sort(([left], [right]) => Number(left) - Number(right))
                .map(([status, count]) => `${status}×${count}`)
                .join(', ')}
        </dd>
        <dt>Routes enriched</dt>
        <dd>
          {diagnostics.routesEnriched}/{diagnostics.routesConsidered}
        </dd>
        <dt>Comparable coverage</dt>
        <dd>
          {diagnostics.routesWithComparableCoverage} route(s) ≥
          {Math.round(diagnostics.minComparableCoverage * 100)}% (need ≥
          {diagnostics.minComparableRoutes})
        </dd>
        <dt>Ranking enabled</dt>
        <dd>{diagnostics.rankingEnabled ? 'yes' : 'no'}</dd>
        {!diagnostics.rankingEnabled ? (
          <>
            <dt>Ranking disabled because</dt>
            <dd>{reasonLabel(diagnostics.rankingDisabledReason)}</dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}
