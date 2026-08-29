import { RouteScoreBreakdown } from '../RouteScoreBreakdown';
import { TrafficDiagnosticsPanel } from '../TrafficDiagnosticsPanel';
import type { WouldRide } from '../storage';
import type { PocAlternative, PocExperimentalFeatures, PocGenerateResponse } from '../types';

type Props = {
  result: PocGenerateResponse;
  selected: PocAlternative;
  features: PocExperimentalFeatures;
  wouldRide: WouldRide;
  feedbackReason: string;
  deviationAcceptable: boolean | null;
  saveMessage: string | null;
  onWouldRideChange: (value: WouldRide) => void;
  onFeedbackReasonChange: (value: string) => void;
  onDeviationAcceptableChange: (value: boolean) => void;
  onSaveSelected: () => void;
  onDownloadGpx: () => void;
  /** When true, Save/Export live in the sticky chrome instead of this panel. */
  hideStickyActions?: boolean;
};

export function SelectedRoutePanel({
  result,
  selected,
  features,
  wouldRide,
  feedbackReason,
  deviationAcceptable,
  saveMessage,
  onWouldRideChange,
  onFeedbackReasonChange,
  onDeviationAcceptableChange,
  onSaveSelected,
  onDownloadGpx,
  hideStickyActions = false,
}: Props) {
  const showTrafficDiagnostics =
    Boolean(result.trafficDiagnostics) && (result.features ?? features).motorTrafficEnrichment;

  return (
    <div className="selected-route-panel" data-testid="selected-route-panel">
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

        {!hideStickyActions ? (
          <div className="actions export-actions" data-testid="export-actions">
            <button type="button" className="primary-action" onClick={onSaveSelected}>
              Save selected locally
            </button>
            <button type="button" className="primary-action" onClick={onDownloadGpx}>
              Export to Garmin
            </button>
            <button type="button" className="secondary" onClick={onDownloadGpx}>
              Download GPX
            </button>
          </div>
        ) : null}

        <p className="subtle location-disclosure" data-testid="garmin-export-disclosure">
          Export to Garmin downloads a GPX file for import into Garmin Connect. GPX includes this
          route&apos;s precise location. Import under Training &amp; Planning → Courses → Import,
          then sync to your device. There is no direct Garmin API sync.
        </p>
      </fieldset>

      {saveMessage ? <p className="status">{saveMessage}</p> : null}
    </div>
  );
}
