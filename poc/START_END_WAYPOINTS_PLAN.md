# POC extension plan: start/end, ordered stops, and return routing

Status: Phase 1 authorized and implemented 2026-09-02 on `cursor/start-end-phase-1-44a8`. Phase 2 remains blocked until the owner confirms the start/end experience. This document originally authorized no implementation by itself; the owner later approved Phase 1 only.

## Execution contract

After the owner authorizes implementation, complete Phase 1, verify it, and stop for the owner to confirm the start/end experience. Implement Phase 2 only after that confirmation. Do not interpret the existing POC-1–POC-4 autonomous execution directive as permission to skip this new checkpoint.

Read `AGENTS.md` and the permanent documents named in `README.md` before implementation. Reuse `apps/web` and `apps/api`; retain local-only execution, provider isolation, browser-local saving, and client-side GPX export. Keep Milestones 1–11 intact. Do not add a domain package, database work, authentication, deployment, address-search provider, or automatic stop-order optimization.

## Baseline and documentation conflicts

Inspected branch: `cursor/mobile-expandable-map-2070`; working tree was clean before this plan. Recheck at implementation time and preserve unrelated changes. Base implementation on the current POC code, including the mobile map work; do not reset to an older branch merely because documentation names it.

- `TASKS.md` identifies the active phase as the POC, with scoring/enrichment and GPX implemented; owner evaluations remain pending. Some historical task entries and `.cursor/rules/00-project.mdc` still describe Milestone 0 as active.
- `poc/README.md` and ADR-017 describe generated loops and require an exit decision before expansion. This proposed extension adds an explicit end and required stops. When implementation is authorized, record a dated, narrowly scoped POC decision and update the active scope; do not silently broaden ADR-017 or mark owner field tests complete.
- `PROJECT_PLAN.md` and historical checklist items still mention ±20% acceptance. Current code and `poc/README.md` use user-controlled flexibility with near-match fallback. Preserve the current behavior and clarify the historical wording when touching these documents.
- `RoutingProvider.route()` already supports an ordered list of locations. `routeLoop()` wraps it by appending the start. The local `/api/poc/routes/route` endpoint is a two-point spike; it does not provide the scored generation experience.
- `generate.ts` builds loop anchors, filters primarily by distance/midpoint diversity, selects up to three routes, then enriches and scores that shortlist. `geometry-quality.ts` penalizes lack of closure and repeated geometry. These assumptions need explicit adaptation.

## Product behavior

Keep the existing **Generate a loop** mode. Add **Start and end** mode, initially with two required locations. Selection is by map click/tap or editable coordinates; **Use my location** continues to set the start. Show an explicit active selection control so tapping the map does not unexpectedly overwrite the start. Use distinct Start and End labels, not color alone. Allow editing, clearing, and swapping the two endpoints.

Phase 2 adds an ordered stop list between Start and End. Default to a maximum of five intermediate stops, centralized in configuration. Riders can add, edit, remove, and move stops up/down with keyboard-accessible controls; dragging is optional. Map pins show their order. User stops are mandatory; generated shaping anchors are separate internal inputs. Never reorder or drop required stops to improve a score.

Phase 2 also adds **Return to start**, off by default, with two choices when enabled:

- **Same route back:** Start → stops in order → End, followed by the selected outbound path in reverse, only when the routing service can validate bicycle traversal in that direction. Reversing only the stop list does not establish that the same roads are used.
- **Shortest return:** Start → stops in order → End, then a separate distance-prioritized bicycle route from End to Start. Intermediate stops are required outbound only. Do not extend the return leg to reach the target distance.

When returning, relabel End as **Turnaround**. Keep the control usable with zero intermediate stops. In loop mode, hide these controls and send only loop inputs. Switching back to start/end may restore that mode's draft, but inactive fields must never leak into a request.

Target distance and flexibility remain required POC inputs and apply to the **entire ride**, including the return. Label this explicitly. A marker-constrained ride that cannot fit the requested range returns the existing bounded near-match behavior or an honest no-route explanation; never move endpoints/stops or silently relax limits.

## Phase 1 — Select start/end and generate scored routes

### 1. Extend the provisional contract and validation

Extend `/api/poc/routes/generate`, keeping the spike endpoint compatible. Proposed fields in the existing request:

```ts
routeMode?: 'loop' | 'point_to_point'; // omitted means legacy loop
end?: PocCoordinate;
// Added in Phase 2:
waypoints?: PocCoordinate[]; // ordered intermediate stops
returnMode?: 'none' | 'same_path' | 'shortest';
```

Normalize to a discriminated internal request. Phase 1 requires `end` for point-to-point and rejects premature waypoint/return inputs. Phase 2 accepts them only in point-to-point mode. Loop requests with incompatible end/stop/return fields fail validation rather than ignoring ambiguous inputs. Missing Phase 2 fields default to `[]` and `none`.

Validate finite WGS84 coordinates, mode combinations, body size, stop count, existing target/flexibility bounds, and adjacent locations that collapse into a zero-length leg. Reject coincident Start/End in point-to-point mode with guidance to use loop mode. Centralize endpoint/stop snapping and continuity tolerances; retain the requested coordinates separately from provider-snapped coordinates. Never accept client-computed scores or provider options.

### 2. Generate endpoint-constrained alternatives

Keep loop generation behavior. For point-to-point, route the direct Start → End baseline, then try deterministic seeded detours between the fixed endpoints when needed for distance fit and variety. Use the baseline distance to size bounded detours; do not reuse circular loop anchors unchanged. Always preserve endpoint constraints.

Extract shared validation, shortlist selection, enrichment, scoring, and response assembly from `generate.ts` as needed; keep handlers thin. Use stable candidate IDs independent of loop bearing labels. Adapt diagnostics and empty-state copy so open routes are not called failed loops.

Replace the loop-midpoint duplicate heuristic for point-to-point candidates with the existing geometry-overlap machinery plus a centralized threshold: routes sharing endpoints and a corridor can still be meaningfully different. Keep legacy loop selection stable unless a separately explained regression fix is necessary. Return up to three distinct alternatives, never duplicate one to fill the UI.

### 3. Adapt scoring before presenting results

Apply distance fit, diversity, elevation, traffic, and weather using the existing toggles, dependency rules, coverage gates, and missing-data behavior. Score complete routes. Road/Gravel remains a routing preference rather than measured surface coverage.

For open paths, replace the closure term with endpoint/required-stop compliance as hard validation. Retain applicable geometry checks for unintended repeats, spikes, and detours; do not deduct points because Start differs from End. Make geometry-quality explanations and badges mode-aware, including replacing “clean loop shape” for open routes.

Preserve bounded enrichment of at most three shortlisted candidates. Geometry scoring should inform the new-mode shortlist; optional enrichment scores rank that shortlist. State this limitation: the POC does not globally optimize traffic/weather/elevation across every possible path. Disabled or unavailable components never become favorable zero values. Version changed scoring semantics and preserve historical score versions on saved routes.

### 4. Integrate UI, saves, and exports

Update planner state, `PlanPanel`, and `RouteMap` together. Include both endpoints in map bounds and support desktop/mobile selection. Every endpoint, mode, distance, or preference edit must invalidate any in-flight generation and prevent stale results from being saved/exported under a changed plan. Reuse `GenerationSession` and existing location-session cancellation patterns.

Save the normalized route request alongside the selected geometry and its scoring snapshot. Version storage and migrate legacy entries as loop requests; preserve existing saves, corrupt-entry handling, and historical geometry. Reopening restores the matching planner mode and endpoints. GPX keeps the exact selected geometry and does not close an open route.

### Phase 1 acceptance and owner checkpoint

- A rider selects distinct Start/End on desktop and mobile, generates a valid open bicycle route, compares available alternatives, saves, reopens, and exports it.
- Existing loop mode, geolocation, fixtures, experimental preferences, and GPX remain usable.
- Enabled applicable scores affect ranking; open routes receive no loop-closure penalty. Unreachable endpoints and impossible distance ranges have clear outcomes.
- Validation, adapter, generation, scoring, interaction, storage, and GPX tests pass; the root quality gate passes.
- Provide exact verification results and a short owner test script using public locations. Ask the owner to confirm start/end behavior. **Stop here until confirmed; do not implement Phase 2 early.**

## Phase 2 — Ordered markers and return choices

### 5. Add mandatory ordered stops

Extend the Phase 1 normalized request and editor. Route the entire ordered location list in one provider request where possible, rather than one call per stop. Seeded detours may be inserted between required locations but cannot change their order. Validate that routed legs actually reach each required stop in order within the centralized snap tolerance; mere proximity somewhere on the overall line is insufficient.

Preserve normalized leg boundaries and snapped locations behind the adapter as needed. The current mapper joins all shapes and drops the first point of later legs unconditionally; check junction continuity before deduplicating. Reject disconnected legs instead of drawing straight connector lines.

### 6. Implement return routing behind the provider boundary

First prove provider support with focused mocked fixtures and an opt-in public-location smoke check. The existing adapter exposes geometry and totals only; it does not yet prove reverse-path access or support a separate shortest-distance objective.

For **Same route back**, obtain a provider-routed return constrained to the outbound path, and verify ordered path equivalence and bicycle access in reverse. Reversing coordinates or routing through reversed stops alone is insufficient. A map match alone must not be treated as proof of legal reverse traversal. Keep any edge identifiers or provider-specific matching data inside the adapter. Accept only the provider-validated return; reject candidates that require a different path, and show “Same-route return unavailable” when none qualify. Never silently switch strategies. If the configured service cannot establish this reliably within the POC budget, report that capability blocker rather than shipping an unverified same-path claim.

For **Shortest return**, add a provider-neutral distance-prioritized objective and translate it only inside the Valhalla adapter. Validate the configured service's support; do not assume normal bicycle costing is shortest-distance routing. Keep bicycle access restrictions. Cache identical End → Start return requests within one generation and share the leg across outbound candidates when their snapped junctions are compatible.

Valhalla documents its `shortest` option as quasi-shortest distance-based costing, not a proof of a global minimum. Use **Shortest return** with concise explanatory text about the routing engine's distance-prioritized result. If that objective is unsupported, return a clear unavailable result instead of silently using ordinary costing. Source: [Valhalla route API reference](https://valhalla.github.io/valhalla/api/route/api-reference/).

Distance priority controls the return leg. Existing enabled scoring evaluates and ranks the **complete ride** among valid alternatives; it must not replace the requested shortest-return leg with a longer one to improve traffic or elevation fit. Show the return's own distance/duration so this tradeoff is understandable.

Join outbound and return only after continuity checks. Sum actual provider distance/duration, retaining both legs and their boundaries. Do not double outbound duration: uphill/downhill and directional restrictions can differ. Export one continuous track using the accepted combined geometry.

### 7. Keep scoring fair for deliberate returns

Validate return-to-start closure as a hard requirement. For same-path returns, compute unintended backtracking/repetition quality on the outbound path and exclude the requested reversal. For shortest-return rides, exclude deliberate cross-leg overlap and the turnaround from accidental backtracking penalties, while retaining within-leg defect checks. Do not exempt malformed/disconnected geometry.

Evaluate distance and enrichment over the complete ride. Count repeated travel in ride metrics even when provider sample lookups are deduplicated. Elevation gain/loss and weather intervals must include the return; never copy outbound elevation gain or forecast interval unchanged. Retain the existing traffic coverage gate and proxy wording. Keep distinctness comparisons focused on meaningful alternative differences rather than penalizing every candidate for a shared required return corridor.

### 8. Enforce one request budget across the whole operation

All routing/return-validation calls share a maximum of **10 per Generate action**, concurrency **≤3**, **8-second per-call timeout**, and **no retries**. Count actual provider calls, not candidates. Reserve return-validation capacity before dispatching outbound candidates; reduce candidate count rather than increasing limits. For example, five outbound plus five return calls exhaust the budget; one shared shortest return leaves at most nine outbound calls. If validation requires additional calls, reduce those counts again.

Propagate cancellation, stop dispatching work when the request is obsolete, and report aggregate attempted/succeeded/failed counts. Preserve separate existing enrichment limits, including traffic **≤15 calls** across **≤3 complete routes**. Do not multiply enrichment budgets by number of legs or stops.

## Implementation map

- API contracts/validation: `apps/api/src/poc/types.ts`, `validate.ts`, `config.ts`; mirrored provisional client types in `apps/web/src/poc/types.ts` and request handling in `api.ts`.
- Generation: `generate.ts`, `anchors.ts`, `selection.ts`, `diversity.ts`, `diagnostics.ts`, and `handler.ts` under `apps/api/src/poc/`.
- Adapter: `routing/provider.ts`, `routing/valhalla.ts`, `routing/valhalla-mapping.ts`; use verified provider options and normalized leg metadata.
- Scoring/enrichment: `scoring/geometry-quality.ts`, `scoring/overlap.ts`, `scoring/combine.ts`, `scoring/categories.ts`, `scoring/config.ts`, and `enrichment.ts`.
- Client: `apps/web/src/App.tsx`, `poc/layout/PlanPanel.tsx`, `poc/RouteMap.tsx`, existing result/score panels, `generation-session.ts`, `storage.ts`, and GPX tests.
- Documentation: update `poc/README.md`, `poc/SCORING_AND_ENRICHMENT.md`, `poc/EVALUATION.md`, active `TASKS.md`, and focused POC sections of `PROJECT_PLAN.md`, `ROUTING.md`, and `DECISIONS.md`. Keep owner evidence pending until supplied.

New helper modules are reasonable where they isolate request state, candidate generation by mode, return composition, or provider validation. Avoid a broad architecture rewrite or new dependencies unless existing utilities are insufficient.

## Verification and final handoff

Use Vitest and mocked providers for ordinary CI. Add geographic regression fixtures built from public/synthetic locations covering open urban routes, constrained corridors, mixed Road/Gravel profiles, ordered stops, a reversible out-and-back, a one-way reverse restriction, an unreachable stop, and a shortest return that differs from outbound.

Required assertions across both phases:

- Endpoint/stop order, snapping, no zero-length adjacent legs, no disconnected geometry, no silently skipped stop, and valid mode/default handling.
- Deterministic candidates with a fixed seed and deterministic provider; honest fewer-than-three/no-route results and bounded near-match fallback on total distance.
- Same-route reversal validated or rejected; shortest-return objective mapped correctly; geometry stitching and total metrics correct; intentional overlap not scored as an accidental defect.
- All supported feature presets and missing-provider states work for each mode. Scoring never overcomes a hard route constraint; unavailable inputs are not favorable; toggles change rank where applicable.
- A forced out-of-range return, failed validation, timeout, cancellation, or invalid stop cannot be saved/exported as a successful complete ride.
- Rapid map edits/reordering/mode changes cannot apply stale results. Stop controls work by keyboard and on mobile; markers do not interfere with route selection or direction arrows.
- Legacy saves still reopen; new saves restore stops and return choice; GPX preserves open/outbound/return point order and never exports a rejected preview.
- Routing budgets hold under partial failures, expansion, and return-validation calls. Non-local environments still reject every POC generation mode.

Run focused API/web tests during each slice and `pnpm run check` from the root at each phase handoff using the pinned mise toolchain. This includes format, lint, types, tests, builds, environment isolation, client-secret scanning, and Wrangler type freshness. Run live checks only as opt-in smoke tests; record unavailable providers/access honestly. Inspect the final diff for secrets, personal coordinates, unrelated work, and documentation drift.

Handoff: summarize delivered behavior, changed files, exact checks/results, observed provider limitations, and owner test steps. Do not merge or deploy. Phase 2 is complete only when both return choices meet their validation semantics, or the owner explicitly accepts a documented reduced scope; an unavailable same-path capability is a blocker to full completion, not a successful substitute.
