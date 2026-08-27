import {
  categoryBadgeLabel,
  trafficLabelText,
  type PocAlternative,
  type PocExperimentalFeatures,
} from './types';
import { formatMiles } from './units';

type Props = {
  alternatives: PocAlternative[];
  features: PocExperimentalFeatures;
};

function pickBy(
  alternatives: PocAlternative[],
  score: (alt: PocAlternative) => number | null,
  direction: 'min' | 'max' = 'min',
): PocAlternative | null {
  const eligible = alternatives.filter((alt) => score(alt) !== null);
  if (eligible.length === 0) {
    return null;
  }
  return [...eligible].sort((left, right) => {
    const leftScore = score(left)!;
    const rightScore = score(right)!;
    return direction === 'min' ? leftScore - rightScore : rightScore - leftScore;
  })[0]!;
}

export function RouteComparisonPanel({ alternatives, features }: Props) {
  if (alternatives.length === 0) {
    return null;
  }

  const closest = pickBy(alternatives, (alt) => Math.abs(alt.distanceFromTargetMeters));
  const cleanest = features.loopQualityScoring
    ? pickBy(alternatives, (alt) => alt.scoring?.components.loopQuality?.score ?? null, 'max')
    : null;
  const distinct = features.routeDiversityScoring
    ? pickBy(alternatives, (alt) => alt.diversity?.contributionScore ?? null, 'max')
    : null;
  const lowestTraffic = features.motorTrafficEnrichment
    ? pickBy(alternatives, (alt) => alt.traffic?.baselineExposure ?? null)
    : null;
  const flattest = features.elevationEnrichment
    ? pickBy(alternatives, (alt) => alt.elevation?.gainPerMile ?? null)
    : null;
  const hilliest = features.elevationEnrichment
    ? pickBy(alternatives, (alt) => alt.elevation?.gainPerMile ?? null, 'max')
    : null;
  const bestWeather = features.weatherForecast
    ? pickBy(alternatives, (alt) => alt.scoring?.components.weather?.score ?? alt.weather?.precipitationProbabilityMax ?? null, features.weatherScoring ? 'max' : 'min')
    : null;

  const rows: Array<{ question: string; answer: string }> = [
    {
      question: 'Closest to requested distance?',
      answer: closest ? `${closest.name} (${formatMiles(closest.distanceMeters)})` : 'n/a',
    },
    {
      question: 'Cleanest geometry?',
      answer: features.loopQualityScoring
        ? cleanest
          ? cleanest.name
          : 'unavailable'
        : 'Loop-quality scoring disabled',
    },
    {
      question: 'Most different?',
      answer: features.routeDiversityScoring
        ? distinct
          ? distinct.name
          : 'unavailable'
        : 'Diversity scoring disabled',
    },
    {
      question: 'Lowest estimated motor-traffic exposure?',
      answer: features.motorTrafficEnrichment
        ? lowestTraffic
          ? `${lowestTraffic.name} (${trafficLabelText(lowestTraffic.traffic?.exposureLabel ?? null) ?? 'n/a'})`
          : 'unavailable'
        : 'Traffic enrichment disabled',
    },
    {
      question: 'Flatter / hillier?',
      answer: features.elevationEnrichment
        ? flattest && hilliest
          ? `Flatter: ${flattest.name}; hillier: ${hilliest.name}`
          : 'unavailable'
        : 'Elevation enrichment disabled',
    },
    {
      question: 'Most favorable forecast?',
      answer: features.weatherForecast
        ? bestWeather
          ? bestWeather.name
          : 'unavailable'
        : 'Weather forecast disabled',
    },
  ];

  return (
    <section className="comparison-panel" aria-label="Route comparison">
      <h2>Compare</h2>
      <ul className="comparison-list">
        {rows.map((row) => (
          <li key={row.question}>
            <strong>{row.question}</strong>
            <span>{row.answer}</span>
          </li>
        ))}
      </ul>
      <ul className="badge-row comparison-badges">
        {alternatives.flatMap((alt) =>
          (alt.categories ?? []).map((badge) => (
            <li key={`${alt.id}-${badge}`}>
              <span className="category-badge">
                {alt.name}: {categoryBadgeLabel(badge)}
              </span>
            </li>
          )),
        )}
      </ul>
    </section>
  );
}
