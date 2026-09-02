import type { ResultsWorkspaceTab } from './planner-workspace';

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
        className={
          active === 'diagnostics'
            ? 'workspace-tab workspace-tab--secondary selected'
            : 'workspace-tab workspace-tab--secondary'
        }
        onClick={() => onChange('diagnostics')}
      >
        Diagnostics ({diagnosticsCount})
      </button>
    </div>
  );
}
