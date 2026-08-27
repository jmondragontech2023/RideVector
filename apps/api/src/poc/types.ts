import type { PocCostingMode } from './config';

/** WGS84 coordinate used at the POC API boundary. */
export type PocCoordinate = {
  latitude: number;
  longitude: number;
};

/** Provider-neutral GeoJSON LineString; coordinates are [longitude, latitude]. */
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

export type PocGenerateRequest = {
  start: PocCoordinate;
  /** Canonical target distance in meters. */
  targetDistanceMeters: number;
  /** ± flexibility around target in meters (user-controlled). */
  distanceFlexibilityMeters: number;
  costing: PocCostingMode;
  /** Optional integer seed for deterministic anchors. */
  seed?: number;
  features?: Partial<PocExperimentalFeatures>;
  elevationPreference?: PocElevationPreference;
  trafficPreference?: PocTrafficPreference;
  departure?: PocDepartureRequest;
};

export type PocDistanceClassification = 'within_range' | 'near_match';

export type PocRejectionReason =
  | 'upstream_failure'
  | 'malformed_geometry'
  | 'outside_tolerance'
  | 'duplicate_candidate'
  | 'selection_limit';

export type PocCandidateOutcome = 'accepted' | 'rejected';

export type PocCandidateDiagnostic = {
  /** Stable 1-based attempt index for this generation. */
  attemptNumber: number;
  bearingFamily: string;
  outcome: PocCandidateOutcome;
  rejectionReason?: PocRejectionReason;
  distanceMeters?: number;
  durationSeconds?: number;
  distanceFromTargetMeters?: number;
  geometry?: PocLineString;
  /** Safe factual explanation without provider internals. */
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

/** Safe debug summary for traffic enrichment — no keys, URLs, payloads, or coordinates. */
export type PocTrafficDiagnostics = {
  enrichmentRequested: boolean;
  scoringRequested: boolean;
  apiKeyConfigured: boolean;
  providerInvoked: boolean;
  callsAttempted: number;
  callOutcomes: {
    ok: number;
    timeout: number;
    error: number;
    unavailable: number;
  };
  /** Counts of non-secret upstream HTTP statuses, e.g. { "401": 15 }. */
  httpStatusCounts: Record<string, number>;
  routesConsidered: number;
  routesEnriched: number;
  routesWithComparableCoverage: number;
  minComparableCoverage: number;
  minComparableRoutes: number;
  rankingEnabled: boolean;
  rankingDisabledReason:
    | null
    | 'enrichment_disabled'
    | 'scoring_disabled'
    | 'api_key_missing'
    | 'no_provider'
    | 'no_calls_attempted'
    | 'insufficient_comparable_coverage'
    | 'preference_none';
};

export type PocDiversitySummary = {
  sharedRoutePercentByPeer: Record<string, number>;
  contributionScore: number;
};

export type PocAlternative = {
  /** Opaque POC-local identifier. */
  id: string;
  /** Factual label: Route A / Route B / Route C. */
  name: string;
  geometry: PocLineString;
  distanceMeters: number;
  durationSeconds: number;
  distanceFromTargetMeters: number;
  /** Bearing-family label for debugging. */
  bearingFamily: string;
  warnings: string[];
  distanceClassification: PocDistanceClassification;
  requestedRangeMeters: { min: number; max: number };
  rangeDeviationMeters?: number;
  targetDifferencePercent?: number;
  categories: PocCategoryBadge[];
  scoring: PocRouteScoring;
  diversity?: PocDiversitySummary;
  elevation?: PocElevationSummary;
  weather?: PocWeatherSummary;
  traffic?: PocTrafficSummary;
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
  features: PocExperimentalFeatures;
  elevationPreference: PocElevationPreference;
  trafficPreference: PocTrafficPreference;
  departure: PocNormalizedDeparture;
  scoringVersion: string;
  enrichmentWarnings: string[];
  attribution: string[];
  trafficDiagnostics: PocTrafficDiagnostics;
};

export type PocValidationIssue = {
  field: string;
  reason: string;
};

export type PocErrorBody = {
  error: {
    code: string;
    message: string;
    details?: PocValidationIssue[];
  };
};
