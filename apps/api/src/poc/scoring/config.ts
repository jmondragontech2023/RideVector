import { METERS_PER_MILE } from '../config';

/** Versioned scoring configuration for POC explanations and saved routes. */
export const SCORING_CONFIG_VERSION = 'poc-scoring-v1';

export const POC_SCORING_CONFIG = {
  version: SCORING_CONFIG_VERSION,
  /** Geometry-only weights when only distance/loop/diversity scoring are on. */
  geometryWeights: {
    distanceFit: 50,
    loopQuality: 30,
    diversity: 20,
  },
  /** Full-experiment weights when every applicable component is active. */
  fullWeights: {
    distanceFit: 30,
    loopQuality: 20,
    diversity: 15,
    motorTraffic: 20,
    elevation: 10,
    weather: 5,
  },
  elevation: {
    /** Gain per mile (meters/mile) category thresholds. */
    flattestMaxGainPerMile: 15,
    rollingMaxGainPerMile: 45,
    /** Max sampled geometry points for /height. */
    maxSamplePoints: 50,
    timeoutMs: 5_000,
  },
  weather: {
    timeoutMs: 5_000,
    /** Provisional scoring penalty thresholds. */
    heavyPrecipitationMm: 2,
    highPrecipProbability: 60,
    strongWindKmh: 40,
    strongGustKmh: 60,
    extremeTempLowC: 0,
    extremeTempHighC: 35,
  },
  traffic: {
    timeoutMs: 5_000,
    maxSamplesPerRoute: 5,
    maxRoutes: 3,
    maxCallsPerGeneration: 15,
    concurrency: 3,
    dedupeRadiusMeters: 50,
    /** Minimum sample coverage (0–1) for a route to participate in traffic ranking. */
    minComparableCoverage: 0.6,
    /** At least this many routes must meet coverage to enable traffic ranking. */
    minComparableRoutes: 2,
    /** Zoom for TomTom flowSegmentData. */
    zoom: 10,
    style: 'absolute' as const,
  },
  geometry: {
    /** Sample stride for overlap / quality approximations. */
    samplePointCount: 48,
    closureExcellentMeters: 25,
    closurePoorMeters: 400,
    spikeLengthMeters: 80,
    spikeAngleDegrees: 35,
  },
  metersPerMile: METERS_PER_MILE,
} as const;

export type ScoringComponentKey =
  | 'distanceFit'
  | 'loopQuality'
  | 'diversity'
  | 'motorTraffic'
  | 'elevation'
  | 'weather';
