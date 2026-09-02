/**
 * Centralized provisional POC routing configuration.
 * Values are intentionally labeled provisional and are not the production Milestone contract.
 */

/** Exact statute mile in meters (POC display conversion boundary). */
export const METERS_PER_MILE = 1609.344;

export const POC_CONFIG = {
  /**
   * Historical POC default (±20% of target). Superseded by user-controlled
   * `distanceFlexibilityMeters`; retained for documented context only.
   */
  toleranceFraction: 0.2,
  /** Default distance flexibility for new POC sessions (miles). */
  defaultDistanceFlexibilityMiles: 3,
  /** Maximum allowed distance flexibility input (miles). */
  maxDistanceFlexibilityMiles: 25,
  /** Near-match fallback: max miles beyond the requested min/max range. */
  nearMatchExtraMiles: 2,
  /** Near-match fallback: max absolute difference as a fraction of target. */
  nearMatchMaxTargetFraction: 0.35,
  /** Attempt this many candidates first. */
  initialCandidateCount: 6,
  /** Cap upstream attempts when more alternatives are needed. */
  maxCandidateCount: 10,
  /** Maximum alternatives returned to the client. */
  maxAlternatives: 3,
  /** Bounded concurrency for upstream route calls. */
  concurrency: 3,
  /**
   * Identifies RideVector on public Valhalla demo instances (POC/development only).
   * Override via VALHALLA_CLIENT_ID if needed.
   */
  valhallaClientId: 'RideVector',
  /**
   * Documented public POC default. Production should point at RideVector-controlled Valhalla.
   * Actual runtime value comes from Worker env `VALHALLA_BASE_URL`.
   */
  defaultValhallaBaseUrl: 'https://valhalla1.openstreetmap.de',
  /** Per-call upstream timeout in milliseconds. */
  timeoutMs: 8_000,
  /**
   * Diversity: reject a candidate whose geometry midpoint is closer than this
   * fraction of the estimated loop radius to an already-accepted midpoint.
   * Documented lightweight geometric rule for the POC only.
   */
  minMidpointSeparationFraction: 0.35,
  /** Minimum allowed target distance (1 km). */
  minTargetDistanceMeters: 1_000,
  /** Maximum allowed target distance (100 miles). */
  maxTargetDistanceMeters: 100 * METERS_PER_MILE,
  /** Maximum generate-request JSON body size (bytes). */
  maxRequestBodyBytes: 16_384,
  /**
   * Start and End closer than this are treated as the same place.
   * Point-to-point requests must use loop mode instead.
   */
  coincidentEndpointMeters: 25,
  /** Adjacent required locations closer than this collapse into a zero-length leg. */
  zeroLengthLegMeters: 10,
  /**
   * Provider-snapped first/last geometry points must stay within this
   * distance of the requested Start/End. Requested coordinates are retained
   * separately from snapped geometry.
   */
  endpointSnapToleranceMeters: 150,
  /**
   * Point-to-point candidates whose pairwise geometry overlap meets or exceeds
   * this fraction are treated as duplicates. Higher than a generic loop
   * midpoint check because open routes share endpoints by definition.
   */
  pointToPointDuplicateOverlapFraction: 0.88,
  /**
   * Base bearings (degrees) for candidate families, rotated by seed.
   * Six families cover the initial attempt set.
   */
  bearingFamilyDegrees: [0, 60, 120, 180, 240, 300] as const,
  /**
   * Extra bearings used only when expanding from 6 to 10 attempts.
   */
  extraBearingFamilyDegrees: [30, 90, 150, 210] as const,
  /**
   * Provisional Valhalla bicycle costing — Road preference.
   * Not a measured surface guarantee.
   */
  roadCostingOptions: {
    bicycle_type: 'Road',
    use_roads: 0.55,
    use_hills: 0.4,
    avoid_bad_surfaces: 0.75,
  },
  /**
   * Provisional Valhalla bicycle costing — Gravel preference.
   * Not a measured surface guarantee.
   */
  gravelCostingOptions: {
    bicycle_type: 'Mountain',
    use_roads: 0.25,
    use_hills: 0.55,
    avoid_bad_surfaces: 0.15,
  },
} as const;

export type PocCostingMode = 'road' | 'gravel';
