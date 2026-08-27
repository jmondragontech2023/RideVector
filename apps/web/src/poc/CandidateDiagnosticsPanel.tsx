import {
  buildGenerationSummary,
  canPreviewOnMap,
  formatTargetDeltaWithTarget,
  rejectionReasonLabel,
} from './candidate-diagnostics';
import { formatDuration, formatMiles } from './units';
import type { PocCandidateDiagnostic, PocGenerateResponse } from './types';

export type CandidateDiagnosticsPanelProps = {
  result: PocGenerateResponse;
  targetDistanceMeters: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  previewAttemptNumber: number | null;
  onPreviewAttempt: (attemptNumber: number | null) => void;
  /** When true, always show the list and omit the expand/collapse control. */
  hideToggle?: boolean;
};

function DiagnosticRow({
  diagnostic,
  targetDistanceMeters,
  previewAttemptNumber,
  onPreviewAttempt,
}: {
  diagnostic: PocCandidateDiagnostic;
  targetDistanceMeters: number;
  previewAttemptNumber: number | null;
  onPreviewAttempt: (attemptNumber: number | null) => void;
}) {
  const previewable = canPreviewOnMap(diagnostic);
  const isPreviewing = previewAttemptNumber === diagnostic.attemptNumber;
  const statusLabel =
    diagnostic.outcome === 'accepted'
      ? 'Accepted'
      : diagnostic.rejectionReason
        ? rejectionReasonLabel(diagnostic.rejectionReason).short
        : 'Not returned';

  return (
    <li className={`candidate-diagnostic ${diagnostic.outcome}`}>
      <div className="candidate-diagnostic-head">
        <strong>Attempt {diagnostic.attemptNumber}</strong>
        <span className={`candidate-diagnostic-badge ${diagnostic.outcome}`}>{statusLabel}</span>
      </div>
      <p className="subtle">{diagnostic.explanation}</p>
      <dl className="candidate-diagnostic-metrics">
        {diagnostic.distanceMeters !== undefined ? (
          <>
            <dt>Distance</dt>
            <dd>{formatMiles(diagnostic.distanceMeters)}</dd>
          </>
        ) : null}
        {diagnostic.durationSeconds !== undefined ? (
          <>
            <dt>Duration</dt>
            <dd>{formatDuration(diagnostic.durationSeconds)}</dd>
          </>
        ) : null}
        {diagnostic.distanceFromTargetMeters !== undefined ? (
          <>
            <dt>Vs target</dt>
            <dd>
              {formatTargetDeltaWithTarget(
                diagnostic.distanceFromTargetMeters,
                targetDistanceMeters,
              )}
            </dd>
          </>
        ) : null}
        <dt>Bearing family</dt>
        <dd>{diagnostic.bearingFamily}</dd>
      </dl>
      {previewable ? (
        <div className="actions">
          {isPreviewing ? (
            <button type="button" className="secondary" onClick={() => onPreviewAttempt(null)}>
              Hide rejected candidate
            </button>
          ) : (
            <button
              type="button"
              className="secondary"
              disabled={previewAttemptNumber !== null && !isPreviewing}
              onClick={() => onPreviewAttempt(diagnostic.attemptNumber)}
            >
              Show on map
            </button>
          )}
        </div>
      ) : null}
    </li>
  );
}

export function CandidateDiagnosticsPanel({
  result,
  targetDistanceMeters,
  expanded,
  onToggleExpanded,
  previewAttemptNumber,
  onPreviewAttempt,
  hideToggle = false,
}: CandidateDiagnosticsPanelProps) {
  const summary = buildGenerationSummary(result);
  const showList = hideToggle || expanded;

  return (
    <section className="candidate-diagnostics-block" aria-label="Candidate diagnostics">
      <p className="generation-summary" role="status">
        {summary}
      </p>
      {hideToggle ? null : (
        <button
          type="button"
          className="diagnostics-toggle secondary"
          aria-expanded={expanded}
          onClick={onToggleExpanded}
        >
          {expanded ? 'Hide candidate diagnostics' : 'Candidate diagnostics'}
          <span className="subtle"> ({result.candidateDiagnostics.length})</span>
        </button>
      )}
      {showList ? (
        <div className="candidate-diagnostics-scroll">
          <ul className="candidate-diagnostics-list">
            {result.candidateDiagnostics.map((diagnostic) => (
              <DiagnosticRow
                key={diagnostic.attemptNumber}
                diagnostic={diagnostic}
                targetDistanceMeters={targetDistanceMeters}
                previewAttemptNumber={previewAttemptNumber}
                onPreviewAttempt={onPreviewAttempt}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
