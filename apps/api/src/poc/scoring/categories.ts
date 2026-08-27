import type { PocCategoryBadge, PocDistanceClassification } from '../types';

export type CategoryCandidate = {
  id: string;
  distanceMeters: number;
  durationSeconds: number;
  distanceFromTargetMeters: number;
  classification: PocDistanceClassification;
  loopQualityScore: number | null;
  diversityScore: number | null;
  elevationGainPerMile: number | null;
  weatherSuitability: number | null;
  precipProbabilityMax: number | null;
  windMaxKmh: number | null;
  trafficExposure: number | null;
  trafficComparable: boolean;
};

/**
 * Assign factual category badges from measurements.
 * Categories are not forced unique or required to exist.
 */
export function assignCategoryBadges(candidates: CategoryCandidate[]): Map<string, PocCategoryBadge[]> {
  const byId = new Map<string, PocCategoryBadge[]>();
  for (const candidate of candidates) {
    const badges: PocCategoryBadge[] = [];
    if (candidate.classification === 'near_match') {
      badges.push('near_match');
    }
    byId.set(candidate.id, badges);
  }

  const addBest = (
    badge: PocCategoryBadge,
    pick: (items: CategoryCandidate[]) => CategoryCandidate | null,
  ): void => {
    const winner = pick(candidates);
    if (!winner) {
      return;
    }
    const list = byId.get(winner.id) ?? [];
    if (!list.includes(badge)) {
      list.push(badge);
      byId.set(winner.id, list);
    }
  };

  addBest('closest_to_target', (items) => {
    if (items.length === 0) {
      return null;
    }
    return [...items].sort(
      (a, b) =>
        Math.abs(a.distanceFromTargetMeters) - Math.abs(b.distanceFromTargetMeters) ||
        a.id.localeCompare(b.id),
    )[0]!;
  });

  addBest('cleanest_loop', (items) => {
    const scored = items.filter((item) => item.loopQualityScore !== null);
    if (scored.length === 0) {
      return null;
    }
    return [...scored].sort(
      (a, b) => (b.loopQualityScore ?? 0) - (a.loopQualityScore ?? 0) || a.id.localeCompare(b.id),
    )[0]!;
  });

  addBest('most_distinct', (items) => {
    const scored = items.filter((item) => item.diversityScore !== null);
    if (scored.length === 0) {
      return null;
    }
    return [...scored].sort(
      (a, b) => (b.diversityScore ?? 0) - (a.diversityScore ?? 0) || a.id.localeCompare(b.id),
    )[0]!;
  });

  addBest('shortest_estimated_time', (items) => {
    if (items.length === 0) {
      return null;
    }
    return [...items].sort(
      (a, b) => a.durationSeconds - b.durationSeconds || a.id.localeCompare(b.id),
    )[0]!;
  });

  const withElevation = candidates.filter((item) => item.elevationGainPerMile !== null);
  if (withElevation.length > 0) {
    addBest('flattest', (items) => {
      const scored = items.filter((item) => item.elevationGainPerMile !== null);
      return [...scored].sort(
        (a, b) =>
          (a.elevationGainPerMile ?? 0) - (b.elevationGainPerMile ?? 0) || a.id.localeCompare(b.id),
      )[0]!;
    });
    addBest('most_climbing', (items) => {
      const scored = items.filter((item) => item.elevationGainPerMile !== null);
      return [...scored].sort(
        (a, b) =>
          (b.elevationGainPerMile ?? 0) - (a.elevationGainPerMile ?? 0) || a.id.localeCompare(b.id),
      )[0]!;
    });
    for (const item of withElevation) {
      const gain = item.elevationGainPerMile!;
      if (gain >= 15 && gain <= 45) {
        const list = byId.get(item.id) ?? [];
        if (!list.includes('rolling')) {
          list.push('rolling');
          byId.set(item.id, list);
        }
      }
    }
  }

  addBest('best_weather_window', (items) => {
    const scored = items.filter((item) => item.weatherSuitability !== null);
    if (scored.length === 0) {
      return null;
    }
    return [...scored].sort(
      (a, b) =>
        (b.weatherSuitability ?? 0) - (a.weatherSuitability ?? 0) || a.id.localeCompare(b.id),
    )[0]!;
  });

  addBest('lowest_rain_exposure', (items) => {
    const scored = items.filter((item) => item.precipProbabilityMax !== null);
    if (scored.length === 0) {
      return null;
    }
    return [...scored].sort(
      (a, b) =>
        (a.precipProbabilityMax ?? 100) - (b.precipProbabilityMax ?? 100) ||
        a.id.localeCompare(b.id),
    )[0]!;
  });

  addBest('lowest_wind_exposure', (items) => {
    const scored = items.filter((item) => item.windMaxKmh !== null);
    if (scored.length === 0) {
      return null;
    }
    return [...scored].sort(
      (a, b) => (a.windMaxKmh ?? 999) - (b.windMaxKmh ?? 999) || a.id.localeCompare(b.id),
    )[0]!;
  });

  addBest('lowest_estimated_motor_traffic_exposure', (items) => {
    const scored = items.filter(
      (item) => item.trafficComparable && item.trafficExposure !== null,
    );
    if (scored.length === 0) {
      return null;
    }
    return [...scored].sort(
      (a, b) =>
        (a.trafficExposure ?? 100) - (b.trafficExposure ?? 100) || a.id.localeCompare(b.id),
    )[0]!;
  });

  return byId;
}

export function categoryLabel(badge: PocCategoryBadge): string {
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
