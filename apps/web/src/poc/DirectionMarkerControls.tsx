import { FeatureHelpTip } from './FeatureHelpTip';
import {
  DIRECTION_MARKER_SETTING_BOUNDS,
  type DirectionMarkerSettingsV1,
} from './direction-marker-settings';

type Props = {
  settings: DirectionMarkerSettingsV1;
  markerCount: number;
  onChange: (next: DirectionMarkerSettingsV1) => void;
  onReset: () => void;
};

type SliderKey = Exclude<keyof DirectionMarkerSettingsV1, 'version'>;

const SLIDERS: Array<{
  key: SliderKey;
  label: string;
  unit: string;
  help: string;
}> = [
  {
    key: 'maxMarkers',
    label: 'Max markers',
    unit: '',
    help: 'Ceiling on how many numbered arrows can appear on the selected route. Raise this when zoomed-in stretches still feel empty; lower it to reduce clutter on overview zoom.',
  },
  {
    key: 'targetSpacingMeters',
    label: 'Target spacing',
    unit: 'm',
    help: 'Desired distance between ordinary arrows along the ride. Lower values pack markers closer together (easier to follow when zoomed in). Higher values space them out for a cleaner map.',
  },
  {
    key: 'maxGapMeters',
    label: 'Max gap',
    unit: 'm',
    help: 'If two consecutive arrows are farther apart than this, extra markers are inserted to fill the empty stretch. Lower this to avoid long marker-free segments between turns.',
  },
  {
    key: 'minMarkerSeparationMeters',
    label: 'Min separation',
    unit: 'm',
    help: 'Minimum along-route distance before two arrows can both stay. Raise it to stop near-duplicates; lower it if turn pairs feel too far from the corner.',
  },
  {
    key: 'turnBearingThreshold',
    label: 'Turn angle',
    unit: '°',
    help: 'Heading change that counts as a turn. At that corner the map places an approach arrow (old direction) and a departure arrow (new direction). Lower catches gentler bends; higher only marks sharp corners.',
  },
];

export function DirectionMarkerControls({ settings, markerCount, onChange, onReset }: Props) {
  return (
    <details className="direction-marker-controls">
      <summary>
        Direction markers
        <span className="direction-marker-controls__count">
          {markerCount > 0 ? `${markerCount} on map` : 'none yet'}
        </span>
      </summary>
      <p className="direction-marker-controls__hint">
        Experiment with density and turn detection. Hover the{' '}
        <span className="direction-marker-controls__hint-mark" aria-hidden="true">
          i
        </span>{' '}
        icons for what each slider does. Values stick in this browser until reset.
      </p>
      <div className="direction-marker-controls__grid">
        {SLIDERS.map((slider) => {
          const bounds = DIRECTION_MARKER_SETTING_BOUNDS[slider.key];
          const value = settings[slider.key];
          const inputId = `direction-marker-${slider.key}`;
          return (
            <div key={slider.key} className="direction-marker-controls__field">
              <div className="direction-marker-controls__label">
                <span className="direction-marker-controls__label-text">
                  <label htmlFor={inputId}>{slider.label}</label>
                  <FeatureHelpTip
                    id={`direction-marker-help-${slider.key}`}
                    text={slider.help}
                    label={`${slider.label} information`}
                  />
                </span>
                <strong>
                  {value}
                  {slider.unit}
                </strong>
              </div>
              <input
                id={inputId}
                type="range"
                min={bounds.min}
                max={bounds.max}
                step={bounds.step}
                value={value}
                aria-label={slider.label}
                onChange={(event) =>
                  onChange({
                    ...settings,
                    [slider.key]: Number(event.target.value),
                  })
                }
              />
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="secondary direction-marker-controls__reset"
        onClick={onReset}
      >
        Reset marker defaults
      </button>
    </details>
  );
}
