import { smokeContractTitle } from './smokeContract';

export function App() {
  return (
    <main>
      <h1>RideVector</h1>
      <p>Milestone 0 smoke web shell. No planner behavior.</p>
      <p data-testid="contract-title">Contract: {smokeContractTitle}</p>
    </main>
  );
}
