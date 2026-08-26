# Route-generation POC

## Purpose

Get a real end-to-end bicycle-loop experience running locally as quickly as possible and use it to answer one question: **does RideVector generate routes the owner would consider riding?**

This directory documents the experiment. POC implementation belongs in the existing `apps/web` and `apps/api` packages; do not create a parallel app here.

## Cursor execution directive

This entire plan is approved for autonomous implementation on `poc/route-generation`. Complete POC-1, POC-2, and POC-3 in order without asking for intermediate review or expanding the scope. Make reasonable implementation decisions within the fixed choices below, run verification after each slice, and continue when checks pass. Commit in coherent slices if repository permissions allow. Return to the owner only after the complete definition of done is met, or when blocked by missing access that has no safe local substitute.

Do not wait for approval to add the specified dependencies, provisional types, tests, fixtures, or local-only configuration. Do not deploy, create paid resources, create remote data, weaken production guards, or send personal coordinates to committed fixtures.

## Fixed implementation choices

Use these choices so the POC does not stall on design exploration:

- Map UI: Leaflet with React Leaflet and OpenStreetMap raster tiles, with visible attribution.
- Display distance: miles in the UI; convert once at the boundary and use meters internally. One mile is exactly 1,609.344 meters.
- Geometry: provider-neutral GeoJSON `LineString` coordinates in `[longitude, latitude]` order.
- Routing backend: Valhalla-compatible HTTP API behind a small `RoutingProvider` interface in `apps/api`.
- Routing endpoint: required local Worker configuration value named `VALHALLA_BASE_URL`; keep secrets out of the URL and repository. An unavailable public endpoint is a documented local setup blocker, not a reason to introduce another provider.
- Bicycle costing: map Road to Valhalla `bicycle` with road-oriented costing options and Gravel to `bicycle` with gravel-oriented costing options. Keep these options centralized and label them provisional.
- Loop generation: deterministic waypoint anchors derived from the start, target distance, and integer seed. Attempt 6 candidates first; permit up to 10 only when needed to obtain alternatives.
- Tolerance: centralized ±20% of target distance.
- Upstream behavior: bounded concurrency of 3, per-call timeout of 8 seconds, no automatic retries inside a generation attempt.
- Alternatives: return at most 3. Use factual names `Route A`, `Route B`, and `Route C`; do not use production personality names.
- Saving and feedback: browser `localStorage` only, with a versioned storage key and graceful handling of corrupt entries.
- Testing: Vitest unit/component tests plus mocked Worker/provider integration tests. Live routing checks are opt-in and never part of ordinary CI.
- Styling: extend the existing CSS; do not add a design system.

If a library version must be selected, use the current stable version compatible with the pinned React, Vite, TypeScript, Node, and Wrangler versions, pin it exactly, and update the lockfile.

## Experience

1. Start the local web app and Worker.
2. Select a start point on a map.
3. Enter a target distance and select Road or Gravel costing.
4. Generate bounded, seeded loop candidates.
5. Compare up to three routes by map geometry, distance, duration, and distance-from-target.
6. Select, regenerate, save locally, and record whether a route looks worth riding.

## Delivery sequence

### POC-1 — One real loop

Wire the complete browser → local Worker → routing provider → browser path for one route. Optimize for observable truth, not breadth.

Required result:

- `POST /api/poc/routes/generate` exists only when `ENVIRONMENT=local`; all non-local environments return `404` for the POC route.
- The request validates coordinate bounds, target distance, costing mode, and optional seed.
- The Worker maps one Valhalla response into the provisional provider-neutral contract and never returns raw upstream payloads or URLs.
- The web app provides map-click start selection, target miles, costing mode, Generate, loading/error states, and one rendered route with distance and duration.
- A mocked provider integration test proves the complete Worker mapping path.

### POC-2 — Alternatives

Create 6–10 seeded candidates from separated bearing families, enforce a provisional ±20% target tolerance, filter obvious duplicates, and present up to three alternatives.

Required result:

- Candidate creation is deterministic for identical normalized input and seed.
- Candidate calls obey the fixed concurrency, timeout, and maximum-attempt values.
- Rejection reasons distinguish upstream failure, malformed geometry, outside tolerance, and duplicate candidate.
- Diversity uses one documented lightweight geometric rule that is deterministic and covered by tests; do not build a production-grade similarity engine.
- Partial success returns valid alternatives plus aggregate warnings.
- The web app displays selectable route cards and highlights the selected geometry without hiding the other alternatives.

### POC-3 — Personal evaluation

Add broad costing modes, regeneration, browser-local saving, local feedback, five non-sensitive geographic scenarios, and a written continue/revise/stop decision.

Required result:

- Regenerate advances or replaces the integer seed and shows the active seed.
- A selected route can be saved, listed, reopened, and deleted locally.
- Feedback records `wouldRide` (`yes`, `maybe`, or `no`) plus an optional short regeneration/rejection reason locally.
- The UI shows generation duration and attempted/accepted candidate counts.
- Five committed fixtures use public landmarks or synthetic coordinates, never a contributor's home; tests assert invariants rather than exact third-party polylines.
- Add `poc/EVALUATION.md` with a ready-to-fill five-scenario results template. Do not invent field-test results; leave actual evaluation fields clearly marked pending for the owner.

## Provisional contract

The request needs only:

- WGS84 start coordinate
- target distance in meters
- `road` or `gravel` costing preference
- optional integer seed

Each alternative needs only:

- POC-local opaque identifier
- provider-neutral geometry
- distance in meters
- estimated duration in seconds
- target-distance difference
- bearing-family label for debugging
- factual warnings

The response also reports the seed, aggregate duration, attempted/accepted candidate counts, and aggregate rejection reasons. Exact schemas are implemented and tested with POC-1; they are not the final Milestone 1 contract.

## Safety and operational boundaries

- The generation endpoint is local-only and unauthenticated. It must reject execution when `ENVIRONMENT` is not `local`.
- Do not modify staging or production deployment workflows to include POC behavior.
- Maximum 10 upstream routing calls per user action, with explicit timeout and bounded concurrency.
- Do not commit API keys, access tokens, precise personal start points, provider payload dumps, or personal route logs.
- Display required map/routing attribution and follow the selected endpoint's usage policy.
- Road/Gravel is a routing-cost preference, not a measured surface guarantee.

## Explicitly deferred

Supabase product tables, authentication, authorization, RLS, cross-device saves, iOS, GPX, traffic, weather, surface percentages, elevation scoring, time/deadline constraints, full OpenAPI resources, final domain package, production personalities, production analytics, and public deployment.

## Exit decision

After testing at least five non-sensitive scenarios, record:

- how often useful alternatives were returned;
- why routes were rejected or regenerated;
- whether candidate quality, comparison UX, or missing constraints were the dominant problem;
- whether to continue into the production milestones, revise candidate generation, or stop.

Do not expand the POC until this decision is made.

## Complete definition of done

Cursor should return the branch for final review only when all of the following are true:

1. POC-1 through POC-3 implementation tasks are complete, except actual owner field-test answers in `poc/EVALUATION.md`.
2. `pnpm run check` passes from the repository root.
3. Web and Worker production builds pass without exposing the local POC endpoint in non-local environments.
4. Unit and mocked integration tests cover validation, deterministic anchors, tolerance filtering, provider mapping, partial failures, diversity filtering, and corrupt local storage.
5. A local manual smoke test has been run against a configured Valhalla-compatible endpoint when network access is available. If unavailable, report it as the sole unverified check; do not replace it with a false passing claim.
6. README local-start instructions include `VALHALLA_BASE_URL` setup and the exact two-process start sequence.
7. The final diff contains no secrets, personal coordinates, provider payload dumps, database product work, deployment changes, or unrelated files.
8. `TASKS.md` reflects actual completion accurately.

The final handoff must summarize what works, exact checks run and results, the manual start procedure, known POC limitations, and the owner actions required to fill `poc/EVALUATION.md`. Do not merge the branch or deploy it; those decisions belong to the final owner review.
