# POC evaluation worksheet

Owner field-test record for the local route-generation POC. **Do not invent results.** Leave outcome fields marked `pending` until the owner actually rides or visually judges each scenario.

## How to run a scenario

1. Start Valhalla-compatible routing and both RideVector processes (see root `README.md`).
2. Open the web app, load the matching public fixture (or click a non-personal start).
3. Set the target distance and distance flexibility (± miles). Confirm the displayed accepted range before generating.
4. Generate, compare up to three alternatives (including any amber **Near match** routes), regenerate if needed, and optionally save with feedback in browser `localStorage` only.
5. Fill the table below with your judgment.

## Scenario results

| # | Fixture / area | Requested target | Flexibility (± mi) | Chosen route type | Would ride? | Deviation acceptable? | Dominant issue | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Golden Gate Park loop | 10 mi | 3 | pending | pending | pending | pending | pending |
| 2 | Central Park loop | 12 mi | 3 | pending | pending | pending | pending | pending |
| 3 | Prospect Park gravel preference | 15 mi | 3 | pending | pending | pending | pending | pending |
| 4 | Boulder foothills loop | 20 mi | 3 | pending | pending | pending | pending | pending |
| 5 | Zilker Park loop | 18 mi | 4 | pending | pending | pending | pending | pending |

**Chosen route type:** `within_range` / `near_match`

**Would ride values:** `yes` / `maybe` / `no`

**Deviation acceptable values (near matches only):** `yes` / `no` / `n/a`

**Dominant issue values:** `candidate quality` / `comparison UX` / `missing constraints` / `other` (specify in notes)

## Aggregate prompts (owner)

Answer after at least five scenarios:

1. How often were useful alternatives returned?
   - pending
2. How often did you accept a near match instead of a within-range route?
   - pending
3. Why were routes rejected or regenerated?
   - pending
4. Was the dominant problem candidate quality, comparison UX, or missing constraints?
   - pending
5. Decision: **continue** into production milestones, **revise** candidate generation, or **stop**?
   - pending

## Guardrails reminder

- Do not commit personal home coordinates or private ride logs.
- Road/Gravel is a costing preference, not a measured surface guarantee.
- Near matches are labeled explicitly and do not satisfy the exact requested range.
- This worksheet is evidence for ADR-017 exit; it does not change Milestone 1–11 scope by itself.
