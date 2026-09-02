# Route-generation POC

## Purpose

Get a real end-to-end bicycle-loop experience running locally as quickly as possible and use it to answer one question: **does RideVector generate routes the owner would consider riding?**

A narrowly scoped Phase 1 extension (ADR-020) also lets the owner select distinct Start and End points and generate scored open bicycle routes. Ordered stops and return-routing options are not implemented until that start/end experience is confirmed.

This directory documents the experiment. POC implementation belongs in the existing `apps/web` and `apps/api` packages; do not create a parallel app here.

## Cursor execution directive

This entire plan is approved for autonomous implementation on `poc/route-generation` (and narrowly scoped follow-on branches such as `poc/garmin-gpx-export`). Complete POC-1, POC-2, POC-3, POC-4, and the scoring/enrichment iteration in order without asking for intermediate review or expanding the scope. Make reasonable implementation decisions within the fixed choices below, run verification after each slice, and continue when checks pass. Commit in coherent slices if repository permissions allow. Return to the owner only after the complete definition of done is met, or when blocked by missing access that has no safe local substitute.

Do not wait for approval to add the specified dependencies, provisional types, tests, fixtures, or local-only configuration. Do not deploy, create paid resources, create remote data, weaken production guards, or send personal coordinates to committed fixtures.

## Fixed implementation choices

Use these choices so the POC does not stall on design exploration:

- Map UI: Leaflet with React Leaflet and OpenStreetMap raster tiles, with visible attribution.
- Display distance: miles in the UI; convert once at the boundary and use meters internally. One mile is exactly 1,609.344 meters.
- Geometry: provider-neutral GeoJSON `LineString` coordinates in `[longitude, latitude]` order.
- Routing backend: Valhalla-compatible HTTP API behind a small `RoutingProvider` interface in `apps/api`.
- Routing endpoint: required Worker configuration value named `VALHALLA_BASE_URL` (not hardcoded in application code). **POC default:** `https://valhalla1.openstreetmap.de` (public hosted demo; temporary). Override in `apps/api/.dev.vars` for self-hosted Valhalla. The React app must not call Valhalla directly.
- Public demo etiquette: send `X-Client-Id: RideVector` on upstream requests; no retries and bounded concurrency (max 3, timeout 8s) against the demo service.
- Bicycle costing: map Road to Valhalla `bicycle` with road-oriented costing options and Gravel to `bicycle` with gravel-oriented costing options. Keep these options centralized and label them provisional.
- Loop generation: deterministic waypoint anchors derived from the start, target distance, and integer seed. Attempt 6 candidates first; permit up to 10 only when needed to obtain alternatives.
- Distance acceptance: user-controlled ± flexibility (default 3 miles) with near-match fallback; not disableable.
- Upstream behavior: bounded concurrency of 3, per-call timeout of 8 seconds, no automatic retries inside a generation attempt.
- Alternatives: return at most 3. Use factual names `Route A`, `Route B`, and `Route C`; do not use production personality names.
- Scoring/enrichment: independently toggleable experimental features documented in `poc/SCORING_AND_ENRICHMENT.md` (`poc-scoring-v3`; historical saves may still show `poc-scoring-v1` or `poc-scoring-v2`). Geometry scores are local and mode-aware; elevation uses Valhalla `/height`; weather uses Open-Meteo; traffic uses TomTom Flow Segment Data with optional `TOMTOM_API_KEY`.
- Ride modes: **Generate a loop** (default / omitted `routeMode`) or **Start and end**. Point-to-point routes only the direct Start → End path. Target distance and flexibility are ignored because the endpoints define the ride. Requested endpoints are hard constraints.
- Saving and feedback: browser `localStorage` only, with versioned storage keys and graceful handling of corrupt entries. Feature preferences use a separate key from saved routes.
- GPX field-test export: client-side GPX 1.1 download of the selected accepted alternative (`apps/web/src/poc/gpx.ts`); UI label **Export to Garmin** (with **Download GPX** available) — no Worker export endpoint and no direct Garmin API sync.
- Testing: Vitest unit/component tests plus mocked Worker/provider integration tests. Live routing/weather/traffic checks are opt-in and never part of ordinary CI.
- Styling: extend the existing CSS; do not add a design system. Desktop uses a plan-or-decision rail beside the map; mobile uses a deliberate content order with sticky Generate / Save-Export actions. Experimental toggles and scenario fixtures live under **Advanced preferences / POC tools**.

If a library version must be selected, use the current stable version compatible with the pinned React, Vite, TypeScript, Node, and Wrangler versions, pin it exactly, and update the lockfile.

## Experience

1. Start the local web app and Worker (`pnpm dev`). For phone LAN/Tailscale testing of **Use my location**, use `pnpm run dev:mobile` (HTTPS) or `pnpm run dev:both` (HTTP :5173 + HTTPS :5174) and open the Vite `https://` Network URL (see root `README.md`).
2. Choose **Generate a loop** or **Start and end**. Select Start (and End, in start-and-end mode) on the map or by editing coordinates. **Map tap sets** chooses which endpoint the next tap writes.
3. For a loop, enter a target distance and flexibility. For start-and-end, those fields are hidden. Choose Road/Gravel costing.
4. Optionally open **Advanced preferences / POC tools** to configure experimental scoring/enrichment presets, departure time, and public scenario fixtures.
5. Generate bounded, seeded loop candidates (**Generate routes**).
6. Compare up to three routes by map geometry, POC fit, category badges, and expandable enrichment details.
7. Select, regenerate, save locally, and record whether a route looks worth riding.
8. Optionally **Export to Garmin** (or **Download GPX**) and import the file into Garmin Connect for an on-device field test.

## Delivery sequence

### POC-1 — One real loop

Complete.

### POC-2 — Alternatives

Complete.

### POC-3 — Personal evaluation

Complete except owner field-test answers in `poc/EVALUATION.md`.

### POC-4 — Garmin GPX field-test export

Download the currently selected accepted alternative (or a route reopened from browser-local saves) as a client-side GPX 1.1 track for manual Garmin Connect course import. No Worker endpoint, OAuth, FIT/TCX, or direct Garmin publishing.

### POC scoring and enrichment iteration

Add independent experimental toggles, deterministic geometry scoring, factual categories, elevation/weather/traffic enrichment behind Worker ports, combined POC fit ranking, expandable comparison UI, and an expanded evaluation matrix. Details and acceptance rules live in `poc/SCORING_AND_ENRICHMENT.md`.

## Provisional contract

The request includes:

- WGS84 start coordinate
- optional `routeMode` (`loop` | `point_to_point`; omitted means loop)
- WGS84 end coordinate when `routeMode` is `point_to_point`
- target distance in meters (required for loops; omitted/ignored for start-and-end)
- distance flexibility in meters (required for loops; omitted/ignored for start-and-end)
- `road` or `gravel` costing preference
- optional integer seed
- optional experimental feature flags and preferences
- optional departure (`now` or custom local date/time + timezone)

Phase 2 `waypoints` and `returnMode` fields are rejected unless omitted or set to the documented empty/`none` defaults. Loop requests that include `end` fail validation.

Each alternative includes geometry, distance, duration, distance classification, POC fit scoring payload, optional enrichment summaries, and factual category badges. The response also reports the feature snapshot, scoring version, enrichment warnings, and attribution strings. Exact schemas are implemented and tested; they are not the final Milestone 1 contract.

## Safety and operational boundaries

- The generation endpoint is local-only and unauthenticated. It must reject execution when `ENVIRONMENT` is not `local`.
- Do not modify staging or production deployment workflows to include POC behavior.
- Maximum 10 upstream routing calls per user action, with explicit timeout and bounded concurrency.
- Traffic enrichment adds at most 15 TomTom calls per generation (≤5 samples × ≤3 routes), concurrency ≤3, 5s timeout, no retries.
- Do not commit API keys, access tokens, precise personal start points, provider payload dumps, or personal route logs.
- Display required map/routing/weather/traffic attribution and follow each endpoint's usage policy.
- Road/Gravel is a routing-cost preference, not a measured surface guarantee.
- Motor-traffic exposure is not a bicycle safety or verified volume score.

## Explicitly deferred

Supabase product tables, authentication, authorization, RLS, cross-device saves, iOS, production export infrastructure, direct Garmin Courses API / Strava publishing, FIT/TCX generation, full OpenAPI resources, final domain package, production personalities, production analytics, and public deployment.

Manual client-side GPX 1.1 download for Garmin field testing is **in scope** as POC-4 (ADR-019).

## Exit decision

After testing at least five non-sensitive scenarios across the scoring/enrichment mode matrix in `poc/EVALUATION.md`, record:

- how often useful alternatives were returned;
- why routes were rejected or regenerated;
- whether candidate quality, comparison UX, or missing constraints were the dominant problem;
- whether POC fit / traffic / weather / elevation changed ride decisions;
- whether to continue into the production milestones, revise candidate generation, or stop.

Do not expand the POC into production milestones until this decision is made. ADR-020 is a dated local exception for Phase 1 start/end only; Phase 2 ordered stops and return routing still require a separate owner confirmation.

## Complete definition of done

Cursor should return the branch for final review only when all of the following are true:

1. POC-1 through POC-4 and the scoring/enrichment iteration are complete, except actual owner field-test answers in `poc/EVALUATION.md` (including Garmin import/device ride checks).
2. `pnpm run check` passes from the repository root.
3. Web and Worker production builds pass without exposing the local POC endpoint in non-local environments.
4. Unit and mocked integration tests cover validation, scoring, enrichment failure isolation, feature-toggle persistence, provider mapping, corrupt local storage, and client-side GPX export.
5. Opt-in live checks against configured providers are run when credentials/network are available; otherwise report them as unverified.
6. README local-start instructions include `VALHALLA_BASE_URL`, optional `TOMTOM_API_KEY`, the two-process start sequence, and the manual Garmin GPX import workflow.
7. The final diff contains no secrets, personal coordinates, provider payload dumps, database product work, deployment changes, or unrelated files.
8. `TASKS.md` reflects actual completion accurately.

The final handoff must summarize what works, exact checks run and results, provider setup, known POC limitations, and the owner actions required to fill `poc/EVALUATION.md`. Do not merge the branch or deploy it; those decisions belong to the final owner review.
