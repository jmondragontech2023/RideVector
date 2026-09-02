import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FeatureHelpTip } from './FeatureHelpTip';
import { DEPARTURE_HELP, EXPERIMENTAL_FEATURE_HELP } from './experimental-feature-help';
import { ExperimentalFeaturesPanel } from './ExperimentalFeaturesPanel';
import { DEFAULT_POC_FEATURES } from './types';

describe('experimental feature help', () => {
  it('defines help text for every experimental toggle', () => {
    for (const key of Object.keys(DEFAULT_POC_FEATURES) as Array<
      keyof typeof DEFAULT_POC_FEATURES
    >) {
      expect(EXPERIMENTAL_FEATURE_HELP[key].length).toBeGreaterThan(20);
    }
    expect(DEPARTURE_HELP).toContain('weather');
  });

  it('renders help triggers in the experimental panel', () => {
    const markup = renderToStaticMarkup(
      <ExperimentalFeaturesPanel
        features={DEFAULT_POC_FEATURES}
        elevationPreference="none"
        trafficPreference="none"
        departureMode="now"
        customLocalDateTime=""
        onChange={() => undefined}
      />,
    );
    expect(markup).toContain('feature-help-tip__trigger');
    expect(markup).toContain('Motor-traffic enrichment information');
    expect(markup).toContain('Motor-traffic enrichment');
  });

  it('renders a help trigger wired for floating tooltip content', () => {
    const markup = renderToStaticMarkup(
      <FeatureHelpTip id="help-test" text="Example help copy." label="Example help" />,
    );
    expect(markup).toContain('aria-label="Example help"');
    expect(markup).toContain('feature-help-tip__trigger');
  });
});
