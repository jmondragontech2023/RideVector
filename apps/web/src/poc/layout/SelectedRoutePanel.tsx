import { RouteScoreBreakdown } from '../RouteScoreBreakdown';
import { TrafficDiagnosticsPanel } from '../TrafficDiagnosticsPanel';
import type { SavedPocRoute, WouldRide } from '../storage';
import type { PocAlternative, PocExperimentalFeatures, PocGenerateResponse } from '../types';

type Props = {
  result: PocGenerateResponse;
  selected: PocAlternative;
  features: PocExperimentalFeatures;
  wouldRide: WouldRide;
  feedbackReason: string;
  deviationAcceptable: boolean | null;
  saveMessage: string | null;
  savedRoutes: SavedPocRoute[];
  onWouldRideChange: (value: WouldRide) => void;
  onFeedbackReasonChange: (value: string) => void;
  onDeviationAcceptableChange: (value: boolean) => void;
  onSaveSelected: () => void;
  onOpenSaved: (route: SavedPocRoute) => void;
  onDeleteSaved: (id: string) => void;
};

export function SelectedRoutePanel({
  result,
  selected,
  features,
  wouldRide,
  feedbackReason,
  deviationAcceptable,
  saveMessage,
  savedRoutes,
  onWouldRideChange,
  onFeedbackReasonChange,
  onDeviationAcceptableChange,
  onSaveSelected,
  onOpenSaved,
  onDeleteSaved,
}: Props) {
  const showTrafficDiagnostics =
    Boolean(result.trafficDiagnostics) && (result.features ?? features).motorTrafficEnrichment;

  return (
    <div className="selected-route-panel">
      <RouteScoreBreakdown alternative={selected} features={result.features ?? features} />

      {showTrafficDiagnostics && result.trafficDiagnostics ? (
        <TrafficDiagnosticsPanel diagnostics={result.trafficDiagnostics} />
      ) : null}

      <fieldset className="field feedback-block">
        <legend>Would you ride this?</legend>
        {(['yes', 'maybe', 'no'] as const).map((value) => (
          <label key={value} className="choice">
            <input
              type="radio"
              name="wouldRide"
              checked={wouldRide === value}
              onChange={() => onWouldRideChange(value)}
            />
            {value}
          </label>
        ))}
        <label className="field">
          <span>Optional reason</span>
          <textarea
            rows={2}
            maxLength={280}
            value={feedbackReason}
            onChange={(event) => onFeedbackReasonChange(event.target.value)}
            placeholder="Why regenerate or reject?"
          />
        </label>
        {selected.distanceClassification === 'near_match' ? (
          <fieldset className="field">
            <legend>Was this distance deviation acceptable?</legend>
            <label className="choice">
              <input
                type="radio"
                name="deviationAcceptable"
                checked={deviationAcceptable === true}
                onChange={() => onDeviationAcceptableChange(true)}
              />
              Yes, acceptable for this ride
            </label>
            <label className="choice">
              <input
                type="radio"
                name="deviationAcceptable"
                checked={deviationAcceptable === false}
                onChange={() => onDeviationAcceptableChange(false)}
              />
              No, too far from my requested range
            </label>
          </fieldset>
        ) : null}
        <button type="button" onClick={onSaveSelected}>
          Save selected locally
        </button>
      </fieldset>

      {saveMessage ? <p className="status">{saveMessage}</p> : null}

      <details className="saved-block" open={savedRoutes.length > 0}>
        <summary>Saved locally ({savedRoutes.length})</summary>
        {savedRoutes.length === 0 ? (
          <p className="subtle">No browser-local saves yet.</p>
        ) : (
          <ul className="saved-list">
            {savedRoutes.map((route) => (
              <li key={route.id}>
                <div>
                  <strong>{route.label}</strong>
                  <p className="subtle">
                    seed {route.seed}
                    {route.feedback ? ` · would ride: ${route.feedback.wouldRide}` : ''}
                  </p>
                </div>
                <div className="actions">
                  <button type="button" className="secondary" onClick={() => onOpenSaved(route)}>
                    Open
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => onDeleteSaved(route.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}
