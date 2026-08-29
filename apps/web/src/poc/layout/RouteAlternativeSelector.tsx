import { categoryBadgeLabel, formatNearMatchDeviation, type PocAlternative } from '../types';
import { formatDuration, formatMiles } from '../units';
import { routePresentationForName } from './route-presentation';

type Props = {
  alternatives: PocAlternative[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function RouteAlternativeSelector({ alternatives, selectedId, onSelect }: Props) {
  return (
    <ul
      className="route-cards route-cards--sticky"
      aria-label="Route alternatives"
      data-testid="route-alternative-selector"
    >
      {alternatives.map((alt) => {
        const nearMatchDeviation = formatNearMatchDeviation(alt);
        const badges = (alt.categories ?? []).slice(0, 2);
        const selected = alt.id === selectedId;
        const identity = routePresentationForName(alt.name);
        const className = [
          'route-card',
          identity.className,
          selected ? 'selected' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <li key={alt.id}>
            <button
              type="button"
              className={className}
              data-route-identity={identity.slot}
              data-selected={selected ? 'true' : 'false'}
              aria-pressed={selected}
              onClick={() => onSelect(alt.id)}
            >
              <span className="route-card-title">
                <span className="route-identity-swatch" aria-hidden="true" />
                <strong>{alt.name}</strong>
                {alt.scoring?.overallScore !== null && alt.scoring?.overallScore !== undefined ? (
                  <span className="poc-fit-badge">POC fit {alt.scoring.overallScore}</span>
                ) : null}
                {alt.distanceClassification === 'near_match' ? (
                  <span className="near-match-badge">Near match</span>
                ) : null}
                {selected ? <span className="route-selected-label">Selected</span> : null}
              </span>
              <span>
                {formatMiles(alt.distanceMeters)} · {formatDuration(alt.durationSeconds)}
              </span>
              {nearMatchDeviation ? (
                <span className="near-match-deviation">{nearMatchDeviation}</span>
              ) : (
                <span className="subtle">
                  {alt.distanceFromTargetMeters >= 0 ? '+' : ''}
                  {formatMiles(Math.abs(alt.distanceFromTargetMeters))} from target
                </span>
              )}
              {badges.length > 0 ? (
                <span className="route-card-badges">
                  {badges.map((badge) => (
                    <span key={badge} className="category-badge">
                      {categoryBadgeLabel(badge)}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="subtle">{alt.bearingFamily}</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
