import { categoryBadgeLabel, formatNearMatchDeviation, type PocAlternative } from '../types';
import { formatDuration, formatMiles } from '../units';

type Props = {
  alternatives: PocAlternative[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function RouteAlternativeSelector({ alternatives, selectedId, onSelect }: Props) {
  return (
    <ul className="route-cards route-cards--sticky" aria-label="Route alternatives">
      {alternatives.map((alt) => {
        const nearMatchDeviation = formatNearMatchDeviation(alt);
        const badges = (alt.categories ?? []).slice(0, 2);
        const selected = alt.id === selectedId;
        return (
          <li key={alt.id}>
            <button
              type="button"
              className={selected ? 'route-card selected' : 'route-card'}
              aria-pressed={selected}
              onClick={() => onSelect(alt.id)}
            >
              <span className="route-card-title">
                <strong>{alt.name}</strong>
                {alt.scoring?.overallScore !== null && alt.scoring?.overallScore !== undefined ? (
                  <span className="poc-fit-badge">POC fit {alt.scoring.overallScore}</span>
                ) : null}
                {alt.distanceClassification === 'near_match' ? (
                  <span className="near-match-badge">Near match</span>
                ) : null}
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
