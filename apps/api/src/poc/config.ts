/**
 * Centralized provisional POC routing configuration.
 * Values are intentionally labeled provisional and are not the production Milestone contract.
 */

/** Exact statute mile in meters (POC display conversion boundary). */
export const METERS_PER_MILE = 1609.344;

export const POC_CONFIG = {
  /** ±20% of target distance (provisional). */
  toleranceFraction: 0.2,
  /** Attempt this many candidates first. */
  initialCandidateCount: 6,
  /** Cap upstream attempts when more alternatives are needed. */
  maxCandidateCount: 10,
  /** Maximum alternatives returned to the client. */
  maxAlternatives: 3,
  /** Bounded concurrency for upstream route calls. */
  concurrency: 3,
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
