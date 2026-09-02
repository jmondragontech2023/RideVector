import {
  FEATURE_PRESETS,
  type PocCostingMode,
  type PocExperimentalFeatures,
  type PocFeaturePreset,
  type PocGenerateResponse,
  type PocRouteMode,
} from '../types';

export type PlannerWorkspaceMode = 'planning' | 'results';

/** @deprecated Prefer Advanced preferences disclosure; kept for test migration. */
export type PlanningSidebarTab = 'plan' | 'experiment';

export type ResultsWorkspaceTab = 'overview' | 'details' | 'diagnostics';

const PRESET_LABELS: Record<PocFeaturePreset, string> = {
  basic: 'Basic',
  geometry: 'Geometry',
  traffic: 'Traffic',
  weather: 'Weather',
  full: 'Full experiment',
};

export function derivePlannerWorkspaceMode(input: {
  result: PocGenerateResponse | null;
}): PlannerWorkspaceMode {
  return input.result !== null ? 'results' : 'planning';
}

function featuresEqual(a: PocExperimentalFeatures, b: PocExperimentalFeatures): boolean {
  const keys = Object.keys(a) as Array<keyof PocExperimentalFeatures>;
  return keys.every((key) => a[key] === b[key]);
}

export function matchingFeaturePresetLabel(features: PocExperimentalFeatures): string {
  for (const preset of Object.keys(FEATURE_PRESETS) as PocFeaturePreset[]) {
    if (featuresEqual(features, FEATURE_PRESETS[preset])) {
      return PRESET_LABELS[preset];
    }
  }
  return 'Custom';
}

export function formatActivePlanSummary(input: {
  targetMiles: string;
  flexibilityMiles: string;
  costing: PocCostingMode;
  features: PocExperimentalFeatures;
  routeMode?: PocRouteMode;
}): string {
  const target = Number(input.targetMiles);
  const flex = Number(input.flexibilityMiles);
  const targetLabel = Number.isFinite(target) && target > 0 ? `${target} mi` : '— mi';
  const flexLabel = Number.isFinite(flex) && flex > 0 ? `±${flex} mi` : '±— mi';
  const costingLabel = input.costing === 'gravel' ? 'Gravel' : 'Road';
  const presetLabel = matchingFeaturePresetLabel(input.features);
  const modeLabel = input.routeMode === 'point_to_point' ? 'Start–end' : 'Loop';
  return `${modeLabel} · ${targetLabel} ${flexLabel} · ${costingLabel} · ${presetLabel}`;
}

export function defaultResultsTab(result: PocGenerateResponse): ResultsWorkspaceTab {
  if (result.alternatives.length === 0) {
    return 'diagnostics';
  }
  return 'overview';
}
