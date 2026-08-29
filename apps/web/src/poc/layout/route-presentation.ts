/**
 * Stable route presentation colors — distinct from scoring/status colors.
 * Route B → blue, Route C → violet, Route A → orange.
 */

export type RouteIdentitySlot = 'a' | 'b' | 'c' | 'other';

export type RoutePresentationTokens = {
  slot: RouteIdentitySlot;
  /** CSS custom-property name for the route identity color. */
  cssVar: '--rv-route-a' | '--rv-route-b' | '--rv-route-c' | '--rv-route-other';
  /** Fallback hex used when CSS variables are unavailable (e.g. map paint). */
  fallback: string;
  className: string;
};

const BY_SLOT: Record<RouteIdentitySlot, RoutePresentationTokens> = {
  b: {
    slot: 'b',
    cssVar: '--rv-route-b',
    fallback: '#2563eb',
    className: 'route-identity--b',
  },
  c: {
    slot: 'c',
    cssVar: '--rv-route-c',
    fallback: '#7c3aed',
    className: 'route-identity--c',
  },
  a: {
    slot: 'a',
    cssVar: '--rv-route-a',
    fallback: '#ea580c',
    className: 'route-identity--a',
  },
  other: {
    slot: 'other',
    cssVar: '--rv-route-other',
    fallback: '#64748b',
    className: 'route-identity--other',
  },
};

export function routeIdentitySlot(name: string): RouteIdentitySlot {
  const normalized = name.trim().toLowerCase();
  if (normalized === 'route b' || normalized.endsWith(' b')) {
    return 'b';
  }
  if (normalized === 'route c' || normalized.endsWith(' c')) {
    return 'c';
  }
  if (normalized === 'route a' || normalized.endsWith(' a')) {
    return 'a';
  }
  return 'other';
}

export function routePresentationForName(name: string): RoutePresentationTokens {
  return BY_SLOT[routeIdentitySlot(name)];
}
