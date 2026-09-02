import type { PocExperimentalFeatures, PocRouteMode } from '../types';
import { POC_SCORING_CONFIG, SCORING_CONFIG_VERSION, type ScoringComponentKey } from './config';

export type ComponentScore = {
  score: number | null;
  weight: number;
  raw: Record<string, unknown>;
  applicable: boolean;
};

export type CombinedScoreResult = {
  version: string;
  overallScore: number | null;
  components: Partial<Record<ScoringComponentKey, ComponentScore>>;
  missingComponents: string[];
  explanations: string[];
  explanationCodes: string[];
};

export type ScoreInputs = {
  features: PocExperimentalFeatures;
  routeMode?: PocRouteMode;
  distanceFit: { score: number; raw: Record<string, unknown> } | null;
  loopQuality: { score: number; raw: Record<string, unknown> } | null;
  diversity: { score: number; raw: Record<string, unknown> } | null;
  elevation: { score: number | null; raw: Record<string, unknown>; applicable: boolean } | null;
  motorTraffic: { score: number | null; raw: Record<string, unknown>; applicable: boolean } | null;
  weather: { score: number | null; raw: Record<string, unknown>; applicable: boolean } | null;
};

function baseWeight(key: ScoringComponentKey, useFull: boolean): number {
  if (useFull) {
    return POC_SCORING_CONFIG.fullWeights[key];
  }
  if (key === 'distanceFit' || key === 'loopQuality' || key === 'diversity') {
    return POC_SCORING_CONFIG.geometryWeights[key];
  }
  return POC_SCORING_CONFIG.fullWeights[key];
}

/**
 * Normalize enabled applicable component weights to 100 and compute POC fit.
 * Missing/null component scores are excluded from the average and listed as missing.
 */
export function combineComponentScores(input: ScoreInputs): CombinedScoreResult {
  const useFull =
    input.features.elevationScoring ||
    input.features.motorTrafficScoring ||
    input.features.weatherScoring;

  const candidates: Array<{
    key: ScoringComponentKey;
    enabled: boolean;
    score: number | null;
    raw: Record<string, unknown>;
    applicable: boolean;
  }> = [
    {
      key: 'distanceFit',
      enabled: input.features.distanceFitScoring,
      score: input.distanceFit?.score ?? null,
      raw: input.distanceFit?.raw ?? {},
      applicable: input.distanceFit !== null,
    },
    {
      key: 'loopQuality',
      enabled: input.features.loopQualityScoring,
      score: input.loopQuality?.score ?? null,
      raw: input.loopQuality?.raw ?? {},
      applicable: input.loopQuality !== null,
    },
    {
      key: 'diversity',
      enabled: input.features.routeDiversityScoring,
      score: input.diversity?.score ?? null,
      raw: input.diversity?.raw ?? {},
      applicable: input.diversity !== null,
    },
    {
      key: 'elevation',
      enabled: input.features.elevationScoring,
      score: input.elevation?.score ?? null,
      raw: input.elevation?.raw ?? {},
      applicable: input.elevation?.applicable === true,
    },
    {
      key: 'motorTraffic',
      enabled: input.features.motorTrafficScoring,
      score: input.motorTraffic?.score ?? null,
      raw: input.motorTraffic?.raw ?? {},
      applicable: input.motorTraffic?.applicable === true,
    },
    {
      key: 'weather',
      enabled: input.features.weatherScoring,
      score: input.weather?.score ?? null,
      raw: input.weather?.raw ?? {},
      applicable: input.weather?.applicable === true,
    },
  ];

  const active = candidates.filter(
    (item) => item.enabled && item.applicable && item.score !== null,
  );
  const weightSum = active.reduce((sum, item) => sum + baseWeight(item.key, useFull), 0);

  const components: CombinedScoreResult['components'] = {};
  const missingComponents: string[] = [];
  let weighted = 0;

  for (const item of candidates) {
    if (!item.enabled) {
      continue;
    }
    const rawWeight = baseWeight(item.key, useFull);
    const normalizedWeight =
      item.applicable && item.score !== null && weightSum > 0
        ? Math.round((rawWeight / weightSum) * 1000) / 10
        : 0;
    components[item.key] = {
      score: item.score,
      weight: normalizedWeight,
      raw: item.raw,
      applicable: item.applicable,
    };
    if (!item.applicable || item.score === null) {
      missingComponents.push(item.key);
    } else if (weightSum > 0) {
      weighted += item.score * (rawWeight / weightSum);
    }
  }

  const explanations: string[] = [];
  const explanationCodes: string[] = [];
  if (input.distanceFit && input.features.distanceFitScoring) {
    if (input.distanceFit.raw.insideRange === true) {
      explanations.push('inside your distance range');
      explanationCodes.push('distance_inside_range');
    } else {
      explanations.push('near your distance range');
      explanationCodes.push('distance_near_match');
    }
  }
  if (input.loopQuality && input.features.loopQualityScoring && input.loopQuality.score >= 75) {
    if (input.routeMode === 'point_to_point') {
      explanations.push('clean path shape');
      explanationCodes.push('path_quality_clean');
    } else {
      explanations.push('clean loop shape');
      explanationCodes.push('loop_quality_clean');
    }
  }
  if (input.diversity && input.features.routeDiversityScoring && input.diversity.score >= 70) {
    explanations.push('distinct alternative');
    explanationCodes.push('diversity_high');
  }

  return {
    version: SCORING_CONFIG_VERSION,
    overallScore: active.length === 0 ? null : Math.round(weighted),
    components,
    missingComponents,
    explanations,
    explanationCodes,
  };
}

export { SCORING_CONFIG_VERSION };
