import type {
  PocElevationPreference,
  PocExperimentalFeatures,
  PocFeaturePreset,
  PocTrafficPreference,
} from './types';

export const EXPERIMENTAL_FEATURE_HELP: Record<keyof PocExperimentalFeatures, string> = {
  distanceFitScoring:
    'Softly ranks returned loops by how closely each distance matches your target. Routes inside your accepted range score higher than near matches. Distance acceptance rules stay strict—this does not reject out-of-range candidates. Ignored for start-and-end rides, which have no distance target.',
  loopQualityScoring:
    'Ranks loops by geometry shape: start/end closure, backtracking, repeated segments, self-intersections, and short spikes. Approximation for comparison only—not a safety or road-quality score.',
  routeDiversityScoring:
    'Prefers alternatives that differ from each other geometrically. Affects comparison and POC fit among returned routes only; duplicate filtering during generation is unchanged.',
  elevationEnrichment:
    'Samples elevation along each returned route (Valhalla /height). Adds gain, loss, and category badges such as flattest or most climbing. Missing elevation stays unknown—never treated as flat.',
  elevationScoring:
    'Includes elevation in POC fit when an elevation preference is set. With “No preference”, enrichment is informational and does not change ranking.',
  motorTrafficEnrichment:
    'Samples TomTom traffic on final alternatives only. Adds estimated motor-traffic exposure labels and traffic debug info. Generation continues if traffic is unavailable.',
  motorTrafficScoring:
    'Uses traffic exposure in POC fit when a traffic preference is set and enough routes have sample coverage. With “No preference”, traffic data is shown but does not affect ranking.',
  weatherForecast:
    'Adds hourly forecast context for start, midpoint, and farthest route points at departure time. Multi-point forecast only—not exact weather along every segment.',
  weatherScoring:
    'Applies conservative weather penalties to POC fit when enabled. Missing or partial weather never counts as favorable conditions.',
};

export const ELEVATION_PREFERENCE_HELP: Record<PocElevationPreference, string> = {
  none: 'Show elevation details without using them to rank routes.',
  flatter: 'Prefer lower climbing per mile when elevation scoring is enabled.',
  rolling: 'Prefer moderate rolling terrain when elevation scoring is enabled.',
  climbing: 'Prefer higher climbing per mile when elevation scoring is enabled.',
};

export const TRAFFIC_PREFERENCE_HELP: Record<PocTrafficPreference, string> = {
  none: 'Show traffic exposure without using it to rank routes. TomTom may still be called when enrichment is on.',
  prefer_lower:
    'Prefer routes with lower estimated motor-traffic exposure when traffic scoring and coverage allow.',
  strongly_avoid_heavy:
    'Strongly penalize higher estimated motor-traffic exposure when traffic scoring and coverage allow.',
};

export const DEPARTURE_HELP =
  'Departure time drives weather forecast sampling. “Depart now” uses the current time; custom departure uses your local date and time.';

export const PRESET_HELP: Record<PocFeaturePreset, string> = {
  basic:
    'Distance-fit scoring only—closest geometry comparison without loop, diversity, or enrichment.',
  geometry: 'Distance, loop quality, and diversity scoring without elevation, traffic, or weather.',
  traffic: 'Geometry scoring plus motor-traffic enrichment and scoring.',
  weather: 'Geometry scoring plus weather forecast (scoring off by default).',
  full: 'All geometry scoring plus elevation, traffic, and weather enrichment and scoring.',
};

export function featureHelpId(key: keyof PocExperimentalFeatures): string {
  return `feature-help-${key}`;
}

export function preferenceHelpId(kind: 'elevation' | 'traffic' | 'departure'): string {
  return `feature-help-${kind}`;
}

export function presetHelpId(preset: PocFeaturePreset): string {
  return `preset-help-${preset}`;
}
