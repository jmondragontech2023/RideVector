import { CandidateDiagnosticsPanel } from '../CandidateDiagnosticsPanel';
import { RouteComparisonPanel } from '../RouteComparisonPanel';
import type { WouldRide } from '../storage';
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
  onResultsTabChange: (tab: ResultsWorkspaceTab) => void;
  onSelectAlternative: (id: string) => void;
  onEditPlan: () => void;
  onRegenerate: () => void;
  onPreviewAttempt: (attemptNumber: number | null) => void;
  onWouldRideChange: (value: WouldRide) => void;
  onFeedbackReasonChange: (value: string) => void;
  onDeviationAcceptableChange: (value: boolean) => void;
  onSaveSelected: () => void;
  onDownloadGpx: () => void;
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
  onResultsTabChange,
  onSelectAlternative,
  onEditPlan,
  onRegenerate,
  onPreviewAttempt,
  onWouldRideChange,
  onFeedbackReasonChange,
  onDeviationAcceptableChange,
  onSaveSelected,
  onDownloadGpx,
}: Props) {
  const effectiveFeatures = result.features ?? features;

  return (
    <aside
      className="results-column"
      aria-label="Route evaluation workspace"
      data-testid="decision-rail"
    >
      <div className="results-sticky-header">
        <div className="plan-summary-row">
          <p className="plan-summary" aria-label="Active plan summary">
            {planSummary}
          </p>
          <p className="seed-line compact">
            Seed <code>{seed}</code>
          </p>
        </div>
        <div className="actions results-secondary-actions">
          <button
            type="button"
            className="secondary edit-plan-control edit-plan-control--mobile"
            data-edit-plan-slot="rail"
            data-testid="edit-plan-rail"
            disabled={status === 'loading'}
            onClick={onEditPlan}
          >
            Edit plan
          </button>
          <button
            type="button"
            className="secondary"
            disabled={status === 'loading'}
            onClick={onRegenerate}
          >
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
              hideStickyActions
              onWouldRideChange={onWouldRideChange}
              onFeedbackReasonChange={onFeedbackReasonChange}
              onDeviationAcceptableChange={onDeviationAcceptableChange}
              onSaveSelected={onSaveSelected}
              onDownloadGpx={onDownloadGpx}
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

      <div className="results-sticky-actions sticky-actions" data-testid="results-sticky-actions">
        <button
          type="button"
          className="primary-action results-action-save"
          data-testid="results-action-save"
          disabled={!selected}
          onClick={onSaveSelected}
          aria-label="Save selected locally"
        >
          <span className="action-label action-label--full">Save selected locally</span>
          <span className="action-label action-label--short" aria-hidden="true">
            Save
          </span>
        </button>
        <button
          type="button"
          className="primary-action results-action-export"
          data-testid="results-action-export"
          disabled={!selected}
          onClick={onDownloadGpx}
          aria-label="Export to Garmin"
        >
          <span className="action-label action-label--full">Export to Garmin</span>
          <span className="action-label action-label--short" aria-hidden="true">
            Export
          </span>
        </button>
        <button
          type="button"
          className="secondary results-action-download results-action-download--desktop"
          data-testid="results-action-download-desktop"
          disabled={!selected}
          onClick={onDownloadGpx}
        >
          Download GPX
        </button>
        <details className="results-more-actions results-more-actions--mobile">
          <summary
            className="results-more-actions__summary"
            data-testid="results-action-more"
            aria-label="More export options"
          >
            More
          </summary>
          <div
            className="results-more-actions__panel"
            role="group"
            aria-label="More export options"
          >
            <button
              type="button"
              className="secondary"
              data-testid="results-action-download-mobile"
              disabled={!selected}
              onClick={onDownloadGpx}
            >
              Download GPX
            </button>
          </div>
        </details>
      </div>
    </aside>
  );
}
