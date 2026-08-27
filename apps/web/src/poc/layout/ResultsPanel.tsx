import { CandidateDiagnosticsPanel } from '../CandidateDiagnosticsPanel';
import { RouteComparisonPanel } from '../RouteComparisonPanel';
import type { SavedPocRoute, WouldRide } from '../storage';
import type { PocAlternative, PocExperimentalFeatures, PocGenerateResponse } from '../types';
import { formatDuration, formatMiles } from '../units';
import type { ResultsWorkspaceTab } from './planner-workspace';
import { ResultsWorkspaceTabs } from './ResponsiveWorkspaceTabs';
import { RouteAlternativeSelector } from './RouteAlternativeSelector';
import { SelectedRoutePanel } from './SelectedRoutePanel';

type Props = {
  result: PocGenerateResponse;
  selected: PocAlternative | null;
  alternatives: PocAlternative[];
  features: PocExperimentalFeatures;
  planSummary: string;
  seed: number;
  status: 'idle' | 'loading' | 'error' | 'success';
  errorMessage: string | null;
  resultsTab: ResultsWorkspaceTab;
  targetDistanceMeters: number;
  previewAttemptNumber: number | null;
  wouldRide: WouldRide;
  feedbackReason: string;
  deviationAcceptable: boolean | null;
  saveMessage: string | null;
  savedRoutes: SavedPocRoute[];
  onResultsTabChange: (tab: ResultsWorkspaceTab) => void;
  onSelectAlternative: (id: string) => void;
  onEditPlan: () => void;
  onRegenerate: () => void;
  onPreviewAttempt: (attemptNumber: number | null) => void;
  onWouldRideChange: (value: WouldRide) => void;
  onFeedbackReasonChange: (value: string) => void;
  onDeviationAcceptableChange: (value: boolean) => void;
  onSaveSelected: () => void;
  onOpenSaved: (route: SavedPocRoute) => void;
  onDeleteSaved: (id: string) => void;
};

export function ResultsPanel({
  result,
  selected,
  alternatives,
  features,
  planSummary,
  seed,
  status,
  errorMessage,
  resultsTab,
  targetDistanceMeters,
  previewAttemptNumber,
  wouldRide,
  feedbackReason,
  deviationAcceptable,
  saveMessage,
  savedRoutes,
  onResultsTabChange,
  onSelectAlternative,
  onEditPlan,
  onRegenerate,
  onPreviewAttempt,
  onWouldRideChange,
  onFeedbackReasonChange,
  onDeviationAcceptableChange,
  onSaveSelected,
  onOpenSaved,
  onDeleteSaved,
}: Props) {
  const effectiveFeatures = result.features ?? features;

  return (
    <aside className="results-column" aria-label="Route evaluation workspace">
      <div className="results-sticky-header">
        <div className="plan-summary-row">
          <p className="plan-summary" aria-label="Active plan summary">
            {planSummary}
          </p>
          <p className="seed-line compact">
            Seed <code>{seed}</code>
          </p>
        </div>
        <div className="actions sticky-actions">
          <button
            type="button"
            className="secondary"
            disabled={status === 'loading'}
            onClick={onEditPlan}
          >
            Edit plan
          </button>
          <button type="button" disabled={status === 'loading'} onClick={onRegenerate}>
            {status === 'loading' ? 'Generating…' : 'Regenerate'}
          </button>
        </div>
        {errorMessage ? (
          <p className="status error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        {status === 'loading' ? (
          <p className="status" role="status">
            Trying up to 10 directionally varied loops…
          </p>
        ) : null}
        {alternatives.length > 0 ? (
          <RouteAlternativeSelector
            alternatives={alternatives}
            selectedId={selected?.id ?? null}
            onSelect={onSelectAlternative}
          />
        ) : (
          <p className="subtle">No accepted alternatives in this generation.</p>
        )}
        <ResultsWorkspaceTabs
          active={resultsTab}
          diagnosticsCount={result.candidateDiagnostics.length}
          onChange={onResultsTabChange}
        />
      </div>

      <div className="results-tab-body">
        {resultsTab === 'overview' ? (
          <div
            id="results-panel-overview"
            role="tabpanel"
            aria-labelledby="results-tab-overview"
            className="results-tab-panel"
          >
            {selected ? (
              <p className="metrics">
                {formatMiles(selected.distanceMeters)} · {formatDuration(selected.durationSeconds)}{' '}
                · {selected.distanceFromTargetMeters >= 0 ? '+' : ''}
                {formatMiles(Math.abs(selected.distanceFromTargetMeters))} from target
              </p>
            ) : null}
            <p className="metrics subtle">
              Generation {result.durationMs} ms · attempted {result.attemptedCount} · accepted{' '}
              {result.acceptedCount}
            </p>
            <RouteComparisonPanel alternatives={alternatives} features={effectiveFeatures} />
            {result.warnings.length > 0 ? (
              <ul className="warnings">
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
            {result.attribution && result.attribution.length > 0 ? (
              <p className="subtle attribution-line">{result.attribution.join(' · ')}</p>
            ) : null}
          </div>
        ) : null}

        {resultsTab === 'details' && selected ? (
          <div
            id="results-panel-details"
            role="tabpanel"
            aria-labelledby="results-tab-details"
            className="results-tab-panel"
          >
            <SelectedRoutePanel
              result={result}
              selected={selected}
              features={features}
              wouldRide={wouldRide}
              feedbackReason={feedbackReason}
              deviationAcceptable={deviationAcceptable}
              saveMessage={saveMessage}
              savedRoutes={savedRoutes}
              onWouldRideChange={onWouldRideChange}
              onFeedbackReasonChange={onFeedbackReasonChange}
              onDeviationAcceptableChange={onDeviationAcceptableChange}
              onSaveSelected={onSaveSelected}
              onOpenSaved={onOpenSaved}
              onDeleteSaved={onDeleteSaved}
            />
          </div>
        ) : null}

        {resultsTab === 'details' && !selected ? (
          <p className="subtle">Select a route to view details.</p>
        ) : null}

        {resultsTab === 'diagnostics' ? (
          <div
            id="results-panel-diagnostics"
            role="tabpanel"
            aria-labelledby="results-tab-diagnostics"
            className="results-tab-panel results-tab-panel--diagnostics"
          >
            {result.enrichmentWarnings && result.enrichmentWarnings.length > 0 ? (
              <ul className="warnings">
                {result.enrichmentWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
            <CandidateDiagnosticsPanel
              result={result}
              targetDistanceMeters={targetDistanceMeters}
              expanded
              hideToggle
              onToggleExpanded={() => undefined}
              previewAttemptNumber={previewAttemptNumber}
              onPreviewAttempt={onPreviewAttempt}
            />
          </div>
        ) : null}
      </div>
    </aside>
  );
}
