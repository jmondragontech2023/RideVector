import { useEffect, useState } from 'react';

export type ColorScheme = 'light' | 'dark';

export function getPrefersColorScheme(): ColorScheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function usePrefersColorScheme(): ColorScheme {
  const [scheme, setScheme] = useState<ColorScheme>(() => getPrefersColorScheme());

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setScheme(media.matches ? 'dark' : 'light');
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return scheme;
}

export function readCssColor(variable: string, fallback: string): string {
  if (typeof document === 'undefined') {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}
