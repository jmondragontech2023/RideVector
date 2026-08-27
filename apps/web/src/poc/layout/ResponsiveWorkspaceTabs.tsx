import type { PlanningSidebarTab, ResultsWorkspaceTab } from './planner-workspace';

type PlanningTabsProps = {
  active: PlanningSidebarTab;
  onChange: (tab: PlanningSidebarTab) => void;
};

export function PlanningWorkspaceTabs({ active, onChange }: PlanningTabsProps) {
  return (
    <div className="workspace-tabs planning-tabs" role="tablist" aria-label="Planning panels">
      <button
        type="button"
        role="tab"
        id="planning-tab-plan"
        aria-controls="planning-panel-plan"
        aria-selected={active === 'plan'}
        className={active === 'plan' ? 'workspace-tab selected' : 'workspace-tab'}
        onClick={() => onChange('plan')}
      >
        Plan
      </button>
      <button
        type="button"
        role="tab"
        id="planning-tab-experiment"
        aria-controls="planning-panel-experiment"
        aria-selected={active === 'experiment'}
        className={active === 'experiment' ? 'workspace-tab selected' : 'workspace-tab'}
        onClick={() => onChange('experiment')}
      >
        Experiment
      </button>
    </div>
  );
}

type ResultsTabsProps = {
  active: ResultsWorkspaceTab;
  diagnosticsCount: number;
  onChange: (tab: ResultsWorkspaceTab) => void;
};

export function ResultsWorkspaceTabs({ active, diagnosticsCount, onChange }: ResultsTabsProps) {
  return (
    <div className="workspace-tabs results-tabs" role="tablist" aria-label="Route evaluation">
      <button
        type="button"
        role="tab"
        id="results-tab-overview"
        aria-controls="results-panel-overview"
        aria-selected={active === 'overview'}
        className={active === 'overview' ? 'workspace-tab selected' : 'workspace-tab'}
        onClick={() => onChange('overview')}
      >
        Overview
      </button>
      <button
        type="button"
        role="tab"
        id="results-tab-details"
        aria-controls="results-panel-details"
        aria-selected={active === 'details'}
        className={active === 'details' ? 'workspace-tab selected' : 'workspace-tab'}
        onClick={() => onChange('details')}
      >
        Details
      </button>
      <button
        type="button"
        role="tab"
        id="results-tab-diagnostics"
        aria-controls="results-panel-diagnostics"
        aria-selected={active === 'diagnostics'}
        className={active === 'diagnostics' ? 'workspace-tab selected' : 'workspace-tab'}
        onClick={() => onChange('diagnostics')}
      >
        Diagnostics ({diagnosticsCount})
      </button>
    </div>
  );
}
