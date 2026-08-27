import { METERS_PER_MILE } from './units';

export const DEFAULT_DISTANCE_FLEXIBILITY_MILES = 3;

export type PocCostingMode = 'road' | 'gravel';

export type PocCoordinate = {
  latitude: number;
  longitude: number;
};

export type PocLineString = {
  type: 'LineString';
  coordinates: Array<[number, number]>;
};

export type PocExperimentalFeatures = {
  distanceFitScoring: boolean;
  loopQualityScoring: boolean;
  routeDiversityScoring: boolean;
  elevationEnrichment: boolean;
  elevationScoring: boolean;
  motorTrafficEnrichment: boolean;
  motorTrafficScoring: boolean;
  weatherForecast: boolean;
  weatherScoring: boolean;
};

export type PocFeaturePreset = 'basic' | 'geometry' | 'traffic' | 'weather' | 'full';

export type PocElevationPreference = 'none' | 'flatter' | 'rolling' | 'climbing';

export type PocTrafficPreference = 'none' | 'prefer_lower' | 'strongly_avoid_heavy';

export type PocDepartureRequest =
  | { mode: 'now' }
  | { mode: 'custom'; localDateTime: string; timeZone: string };

export type PocNormalizedDeparture = {
  mode: 'now' | 'custom';
  departureInstantIso: string;
  timeZone: string;
};

export type PocDistanceClassification = 'within_range' | 'near_match';

export type PocCategoryBadge =
  | 'closest_to_target'
  | 'cleanest_loop'
  | 'most_distinct'
  | 'shortest_estimated_time'
  | 'near_match'
  | 'flattest'
  | 'rolling'
  | 'most_climbing'
  | 'best_weather_window'
  | 'lowest_rain_exposure'
  | 'lowest_wind_exposure'
  | 'lowest_estimated_motor_traffic_exposure';

export type PocComponentScore = {
  score: number | null;
  weight: number;
  raw: Record<string, unknown>;
  applicable: boolean;
};

export type PocRouteScoring = {
  version: string;
  overallScore: number | null;
  components: Partial<
    Record<
      'distanceFit' | 'loopQuality' | 'diversity' | 'motorTraffic' | 'elevation' | 'weather',
      PocComponentScore
    >
  >;
  missingComponents: string[];
  explanations: string[];
  explanationCodes: string[];
  fitSummary: string;
};

export type PocElevationSummary = {
  status: 'ok' | 'unknown' | 'unavailable' | 'partial';
  gainMeters: number | null;
  lossMeters: number | null;
  minMeters: number | null;
  maxMeters: number | null;
  gainPerMile: number | null;
  coverage: number | null;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  provider: 'valhalla_height';
};

export type PocWeatherSummary = {
  status: 'ok' | 'unknown' | 'unavailable' | 'partial' | 'stale';
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
  apparentTemperatureMinC: number | null;
  apparentTemperatureMaxC: number | null;
  precipitationProbabilityMax: number | null;
  precipitationMm: number | null;
  windSpeedMaxKmh: number | null;
  windGustMaxKmh: number | null;
  weatherCodes: number[];
  warnings: string[];
  coverage: number | null;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  provider: 'open_meteo';
  forecastGeneratedAtIso: string | null;
  intervalStartIso: string | null;
  intervalEndIso: string | null;
};

export type PocTrafficSummary = {
  status: 'ok' | 'unknown' | 'unavailable' | 'partial';
  baselineExposure: number | null;
  exposureLabel:
    | 'lower_estimated_motor_traffic_exposure'
    | 'moderate_estimated_motor_traffic_exposure'
    | 'higher_estimated_motor_traffic_exposure'
    | 'insufficient_traffic_coverage'
    | null;
  currentCongestionDetected: boolean;
  coverage: number | null;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  sampleCount: number;
  usableSampleCount: number;
  closuresDetected: boolean;
  provider: 'tomtom_flow';
  warnings: string[];
};

export type PocDiversitySummary = {
  sharedRoutePercentByPeer: Record<string, number>;
  contributionScore: number;
};

export type PocAlternative = {
  id: string;
  name: string;
  geometry: PocLineString;
  distanceMeters: number;
  durationSeconds: number;
  distanceFromTargetMeters: number;
  bearingFamily: string;
  warnings: string[];
  distanceClassification: PocDistanceClassification;
  requestedRangeMeters: { min: number; max: number };
  rangeDeviationMeters?: number;
  targetDifferencePercent?: number;
  categories?: PocCategoryBadge[];
  scoring?: PocRouteScoring;
  diversity?: PocDiversitySummary;
  elevation?: PocElevationSummary;
  weather?: PocWeatherSummary;
  traffic?: PocTrafficSummary;
};

export type PocRejectionReason =
  | 'upstream_failure'
  | 'malformed_geometry'
  | 'outside_tolerance'
  | 'duplicate_candidate'
  | 'selection_limit';

export type PocCandidateOutcome = 'accepted' | 'rejected';

export type PocCandidateDiagnostic = {
  attemptNumber: number;
  bearingFamily: string;
  outcome: PocCandidateOutcome;
  rejectionReason?: PocRejectionReason;
  distanceMeters?: number;
  durationSeconds?: number;
  distanceFromTargetMeters?: number;
  geometry?: PocLineString;
  explanation: string;
};

export type PocDiagnosticSummary = {
  attemptedCount: number;
  acceptedCount: number;
  rejectionCounts: Record<PocRejectionReason, number>;
  acceptedDistanceRangeMeters?: { min: number; max: number };
  closestRoutableRejected?: {
    attemptNumber: number;
    distanceMeters: number;
    distanceFromTargetMeters: number;
    toleranceMissMeters: number;
    toleranceMissPercent: number;
    direction: 'below' | 'above' | 'within';
  };
};

export type PocGenerateResponse = {
  seed: number;
  durationMs: number;
  attemptedCount: number;
  acceptedCount: number;
  alternatives: PocAlternative[];
  rejections: Record<PocRejectionReason, number>;
  warnings: string[];
  candidateDiagnostics: PocCandidateDiagnostic[];
  diagnosticSummary: PocDiagnosticSummary;
  distanceFlexibilityMeters: number;
  requestedRangeMeters: { min: number; max: number };
  features?: PocExperimentalFeatures;
  elevationPreference?: PocElevationPreference;
  trafficPreference?: PocTrafficPreference;
  departure?: PocNormalizedDeparture;
  scoringVersion?: string;
  enrichmentWarnings?: string[];
  attribution?: string[];
};

export type PocGenerateRequestBody = {
  start: PocCoordinate;
  targetDistanceMeters: number;
  distanceFlexibilityMeters: number;
  costing: PocCostingMode;
  seed?: number;
  features?: PocExperimentalFeatures;
  elevationPreference?: PocElevationPreference;
  trafficPreference?: PocTrafficPreference;
  departure?: PocDepartureRequest;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; reason: string }>;
  };
};

export { METERS_PER_MILE };

export const DEFAULT_POC_FEATURES: PocExperimentalFeatures = {
  distanceFitScoring: true,
  loopQualityScoring: true,
  routeDiversityScoring: true,
  elevationEnrichment: false,
  elevationScoring: false,
  motorTrafficEnrichment: false,
  motorTrafficScoring: false,
  weatherForecast: false,
  weatherScoring: false,
};

export const FEATURE_PRESETS: Record<PocFeaturePreset, PocExperimentalFeatures> = {
  basic: {
    ...DEFAULT_POC_FEATURES,
    loopQualityScoring: false,
    routeDiversityScoring: false,
  },
  geometry: { ...DEFAULT_POC_FEATURES },
  traffic: {
    ...DEFAULT_POC_FEATURES,
    motorTrafficEnrichment: true,
    motorTrafficScoring: true,
  },
  weather: {
    ...DEFAULT_POC_FEATURES,
    weatherForecast: true,
    weatherScoring: false,
  },
  full: {
    distanceFitScoring: true,
    loopQualityScoring: true,
    routeDiversityScoring: true,
    elevationEnrichment: true,
    elevationScoring: true,
    motorTrafficEnrichment: true,
    motorTrafficScoring: true,
    weatherForecast: true,
    weatherScoring: true,
  },
};

export function coerceFeatureDependencies(
  features: PocExperimentalFeatures,
): PocExperimentalFeatures {
  return {
    ...features,
    elevationScoring: features.elevationEnrichment && features.elevationScoring,
    motorTrafficScoring: features.motorTrafficEnrichment && features.motorTrafficScoring,
    weatherScoring: features.weatherForecast && features.weatherScoring,
  };
}

export function categoryBadgeLabel(badge: PocCategoryBadge): string {
  switch (badge) {
    case 'closest_to_target':
      return 'Closest to target';
    case 'cleanest_loop':
      return 'Cleanest loop';
    case 'most_distinct':
      return 'Most distinct';
    case 'shortest_estimated_time':
      return 'Shortest estimated time';
    case 'near_match':
      return 'Near match';
    case 'flattest':
      return 'Flattest';
    case 'rolling':
      return 'Rolling';
    case 'most_climbing':
      return 'Most climbing';
    case 'best_weather_window':
      return 'Best weather window';
    case 'lowest_rain_exposure':
      return 'Lowest rain exposure';
    case 'lowest_wind_exposure':
      return 'Lowest wind exposure';
    case 'lowest_estimated_motor_traffic_exposure':
      return 'Lowest estimated motor-traffic exposure';
    default:
      return badge;
  }
}

export function trafficLabelText(label: PocTrafficSummary['exposureLabel']): string | null {
  switch (label) {
    case 'lower_estimated_motor_traffic_exposure':
      return 'Lower estimated motor-traffic exposure';
    case 'moderate_estimated_motor_traffic_exposure':
      return 'Moderate estimated motor-traffic exposure';
    case 'higher_estimated_motor_traffic_exposure':
      return 'Higher estimated motor-traffic exposure';
    case 'insufficient_traffic_coverage':
      return 'Insufficient traffic coverage';
    default:
      return null;
  }
}

export function formatAcceptedRangeLabel(requestedRangeMeters: {
  min: number;
  max: number;
}): string {
  const low = requestedRangeMeters.min / METERS_PER_MILE;
  const high = requestedRangeMeters.max / METERS_PER_MILE;
  return `Accepted range: ${low.toFixed(1)}–${high.toFixed(1)} miles.`;
}

export function formatNearMatchDeviation(alternative: PocAlternative): string | null {
  if (alternative.distanceClassification !== 'near_match') {
    return null;
  }
  const miles = Math.abs(alternative.rangeDeviationMeters ?? 0) / METERS_PER_MILE;
  const direction = (alternative.rangeDeviationMeters ?? 0) < 0 ? 'below' : 'above';
  return `${miles.toFixed(1)} miles ${direction} your requested range.`;
}
