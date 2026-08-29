import { AppearanceControls } from './AppearanceControls';
import type { ThemePreference } from '../appearance-settings';
import type { SavedPocRoute } from '../storage';

type Props = {
  contractTitle: string;
  themePreference: ThemePreference;
  onThemePreferenceChange: (preference: ThemePreference) => void;
  savedRoutes: SavedPocRoute[];
  onOpenSaved: (route: SavedPocRoute) => void;
  onDeleteSaved: (id: string) => void;
  workspaceMode: 'planning' | 'results';
  planSummary?: string;
  onEditPlan?: () => void;
};

export function PlannerHeader({
  contractTitle,
  themePreference,
  onThemePreferenceChange,
  savedRoutes,
  onOpenSaved,
  onDeleteSaved,
  workspaceMode,
  planSummary,
  onEditPlan,
}: Props) {
  return (
    <header className="poc-header" data-testid="planner-header">
      <div className="poc-header__brand">
        <h1>RideVector</h1>
        <p className="poc-header__tagline">Build a ride worth riding</p>
      </div>

      <div className="poc-header__actions">
        <span className="poc-status-pill" data-testid="local-poc-status">
          Local POC
        </span>

        {workspaceMode === 'results' && planSummary ? (
          <div className="poc-header__plan" data-testid="header-active-plan">
            <span className="poc-header__plan-label">Active plan</span>
            <span className="poc-header__plan-value">{planSummary}</span>
            {onEditPlan ? (
              <button type="button" className="secondary header-edit-plan" onClick={onEditPlan}>
                Edit plan
              </button>
            ) : null}
          </div>
        ) : null}

        <details className="header-menu" data-testid="saved-routes-menu">
          <summary>Saved routes ({savedRoutes.length})</summary>
          <div className="header-menu__panel">
            {savedRoutes.length === 0 ? (
              <p className="subtle">No browser-local saves yet.</p>
            ) : (
              <ul className="saved-list">
                {savedRoutes.map((route) => (
                  <li key={route.id}>
                    <div>
                      <strong>{route.label}</strong>
                      <p className="subtle">
                        seed {route.seed}
                        {route.feedback ? ` · would ride: ${route.feedback.wouldRide}` : ''}
                      </p>
                    </div>
                    <div className="actions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => onOpenSaved(route)}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => onDeleteSaved(route.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>

        <details className="header-menu" data-testid="poc-tools-menu">
          <summary>POC tools</summary>
          <div className="header-menu__panel">
            <AppearanceControls
              themePreference={themePreference}
              onThemePreferenceChange={onThemePreferenceChange}
            />
            <p className="contract-meta" data-testid="contract-title">
              Contract: {contractTitle}
            </p>
            <p className="subtle">Milestone 0 smoke · local route-generation POC metadata</p>
          </div>
        </details>
      </div>
    </header>
  );
}
