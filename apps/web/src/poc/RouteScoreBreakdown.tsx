import { useState } from 'react';
import {
  categoryBadgeLabel,
  trafficLabelText,
  type PocAlternative,
  type PocExperimentalFeatures,
} from './types';
import { formatDuration, formatMiles } from './units';

type Props = {
  alternative: PocAlternative;
  features: PocExperimentalFeatures;
};

function formatMaybe(value: number | null | undefined, suffix = ''): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'unavailable';
  }
  return `${value}${suffix}`;
}

export function RouteScoreBreakdown({ alternative, features }: Props) {
  const [expanded, setExpanded] = useState(false);
  const scoring = alternative.scoring;
  const categories = alternative.categories ?? [];

  return (
    <div className="score-breakdown">
      <div className="score-summary">
        <p className="fit-line">
          {scoring?.fitSummary ??
            (scoring?.overallScore !== null && scoring?.overallScore !== undefined
              ? `POC fit ${scoring.overallScore}/100`
              : 'POC fit unavailable')}
        </p>
        {categories.length > 0 ? (
          <ul className="badge-row">
            {categories.map((badge) => (
              <li key={badge}>
                <span className="category-badge">{categoryBadgeLabel(badge)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <button
        type="button"
        className="secondary score-toggle"
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? 'Hide score details' : 'Show score details'}
      </button>
      {expanded ? (
        <div className="score-details">
          <p className="subtle">
            {formatMiles(alternative.distanceMeters)} ·{' '}
            {formatDuration(alternative.durationSeconds)}
          </p>
          {scoring ? (
            <ul className="component-list">
              {Object.entries(scoring.components).map(([key, component]) => (
                <li key={key}>
                  <strong>{key}</strong>: {formatMaybe(component?.score ?? null)}
                  {component ? ` (weight ${component.weight})` : ''}
                  {!featuresDistanceEnabled(key, features) ? ' · disabled' : ''}
                  {component && !component.applicable ? ' · not applicable' : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="subtle">No scoring payload on this route.</p>
          )}
          {alternative.diversity ? (
            <p className="subtle">
              Diversity contribution {alternative.diversity.contributionScore}/100
            </p>
          ) : null}
          {features.elevationEnrichment ? (
            <p className="subtle">
              Elevation: {alternative.elevation?.status ?? 'unavailable'}
              {alternative.elevation?.gainPerMile !== null &&
              alternative.elevation?.gainPerMile !== undefined
                ? ` · gain ${alternative.elevation.gainPerMile} m/mi`
                : ' · unknown gain'}
            </p>
          ) : (
            <p className="subtle">Elevation enrichment disabled.</p>
          )}
          {features.motorTrafficEnrichment ? (
            <p className="subtle">
              Traffic:{' '}
              {trafficLabelText(alternative.traffic?.exposureLabel ?? null) ??
                alternative.traffic?.status ??
                'unavailable'}
              {alternative.traffic?.coverage !== null && alternative.traffic?.coverage !== undefined
                ? ` · ${Math.round(alternative.traffic.coverage * 100)}% coverage`
                : ''}
              {alternative.traffic?.currentCongestionDetected
                ? ' · current congestion detected'
                : ''}
            </p>
          ) : (
            <p className="subtle">Motor-traffic enrichment disabled.</p>
          )}
          {features.weatherForecast ? (
            <p className="subtle">
              Weather: {alternative.weather?.status ?? 'unavailable'}
              {alternative.weather?.temperatureMinC !== null &&
              alternative.weather?.temperatureMaxC !== null
                ? ` · ${alternative.weather?.temperatureMinC}–${alternative.weather?.temperatureMaxC}°C`
                : ''}
              {alternative.weather?.precipitationProbabilityMax !== null &&
              alternative.weather?.precipitationProbabilityMax !== undefined
                ? ` · precip chance ${alternative.weather.precipitationProbabilityMax}%`
                : ''}
            </p>
          ) : (
            <p className="subtle">Weather forecast disabled.</p>
          )}
          {scoring?.missingComponents?.length ? (
            <p className="subtle">Missing: {scoring.missingComponents.join(', ')}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function featuresDistanceEnabled(key: string, features: PocExperimentalFeatures): boolean {
  switch (key) {
    case 'distanceFit':
      return features.distanceFitScoring;
    case 'loopQuality':
      return features.loopQualityScoring;
    case 'diversity':
      return features.routeDiversityScoring;
    case 'elevation':
      return features.elevationScoring;
    case 'motorTraffic':
      return features.motorTrafficScoring;
    case 'weather':
      return features.weatherScoring;
    default:
      return true;
  }
}
