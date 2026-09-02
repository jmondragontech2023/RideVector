# Routing and ranking

## Product objective

RideVector finds the best bicycle ride under rider constraints; it is not a shortest-path wrapper. It returns multiple materially different, explainable alternatives. MVP personalities are **Best Overall**, **Quietest**, and **Adventure / Most Gravel**.

Prefer permanent documents named in `README.md` over `RIDEVECTOR_HANDOFF.md`.

## Domain concepts

- `RouteRequest`: normalized, validated request with start/end/return mode, required ordered waypoints, constraints, preferences, and departure context.
- `RouteCandidate`: provider-neutral path plus enrichment, provenance, violations, and score components.
- `RouteResult`: selected valid candidate with personality, metrics, geometry, warnings, explanations, and version metadata.
- Constraints distinguish hard bounds from soft targets/preferences.

Final types belong to Milestone 1. No map SDK or routing-provider type may appear in these domain models.

## Local POC algorithm

ADR-017 authorizes a deliberately reduced local experiment before the production pipeline below is implemented. The POC estimates an anchor radius from target distance, creates 6–10 reproducible bearing-family waypoint patterns, asks a configurable Valhalla-compatible adapter to route each bicycle loop, rejects failures and routes outside a centralized user-controlled distance range (with near-match fallback), applies a lightweight diversity check, and returns up to three factual alternatives.

ADR-020 adds Phase 1 start/end generation on the same endpoint: route only the direct Start → End path. Target distance and flexibility are ignored; requested endpoints are hard constraints. Ordered stops and return routing remain Phase 2.

After selection, optional Worker-side enrichment may attach elevation (Valhalla `/height`), weather (Open-Meteo), and motor-vehicle traffic samples (TomTom Flow Segment Data). Deterministic **POC fit** component scores and factual category badges are computed server-side when experimental toggles are enabled. See `poc/SCORING_AND_ENRICHMENT.md` for weights (`poc-scoring-v3`), limits, and missing-data rules. Motor-traffic exposure is an FRC/free-flow proxy — not bicycle safety or verified volume.

During the POC phase, development may use a **public hosted Valhalla demo** via `VALHALLA_BASE_URL` so local hardware does not block validation (ADR-018). The adapter boundary is preserved so the same application code can later target RideVector-controlled Valhalla without changing route-generation logic.

The POC does not claim exact surface composition, verified quietness, segment-exact weather, or the production Best Overall/Quietest/Adventure personalities. Its algorithm, types, tolerance, and explanations are provisional evidence-gathering tools. The complete normalize → generate → enrich → reject → score → deduplicate/select → explain pipeline remains the production direction.

## Pipeline

### 1. Normalize constraints

Validate coordinate bounds, end/return consistency, waypoint order, min/target/max relationships, percentage ranges, time zones, departure/deadline ordering, and at least one usable distance/time goal. Convert distance to meters, duration to seconds, and instants to canonical timestamps. Preserve enough timezone context to interpret the rider's deadline.

Distance, time, and deadline constraints compose independently. A target sits inside permitted min/max values. A must-finish deadline uses a centralized configurable safety buffer (initial product intent: roughly 10–15 minutes, final default decided and tested later), never an exact-boundary promise.

### 2. Generate diverse candidates

Ask the routing adapter for many candidates—initial hypothesis 20–50, tuned by benchmarks. Diversity inputs may include bearing/direction, anchor points, clockwise/counterclockwise traversal, costing/surface/road-class weights, and waypoint order only when the request permits reordering.

Randomized exploration must accept a recorded seed for reproducibility. Bound concurrency, calls, total latency, and cost. Provider errors must not corrupt valid candidates from other attempts.

### 3. Enrich

At minimum calculate distance, estimated duration, elevation gain/loss, paved/gravel/dirt-or-unpaved/unknown percentages, road classifications, traffic exposure when available, estimated finish, and constraint violations. Record unknown data rather than treating it as favorable.

Surface lengths must partition route length within a documented numeric tolerance. Traffic/weather requests use route/departure context and normalized provider-neutral results. Keep source/provider and data freshness for debugging without leaking it as a domain dependency.

### 4. Reject hard violations

Reject bicycle-prohibited/private access, unreachable required waypoints, invalid/disconnected geometry, hard maximum distance/duration, and buffered deadline violations. Later closures/severe hazards may become hard constraints. Keep structured rejection codes and aggregate counts; do not silently discard the cause.

### 5. Score valid candidates

Initial deterministic factors are target distance/time match, traffic preference, surface match, elevation match, road quality, and variety. Normalize factors to comparable ranges, centralize named/versioned weights, define missing-data behavior, and test monotonicity and boundary cases. Hard constraints never become merely low scores.

An explanation is derived from the same evaluated facts as the score, not independently generated marketing text. Example explanation codes: distance within range, surface target matched, low traffic exposure, duration below maximum, finish before buffered deadline, or unknown surface warning.

### 6. Deduplicate and select personalities

Filter exact and near duplicates using provider-neutral geometry/edge overlap or another documented similarity metric. Personality selection applies distinct objective weights or constrained selection over the valid pool:

- Best Overall: strongest balanced score.
- Quietest: minimizes traffic exposure while maintaining acceptable request fit.
- Adventure: favors gravel/adventure surface fit while maintaining hard constraints.

Enforce pairwise diversity thresholds. If fewer than three qualifying alternatives exist, return fewer with a structured explanation; never relabel near-identical routes to manufacture three.

### 7. Return and persist

Return canonical metrics, geometry, warnings, machine-readable explanations, and algorithm/routing/config versions. Persist only data required for product behavior, reproducibility, support, and approved analytics under the retention policy.

## Rider-speed model

MVP uses centralized configurable generic speeds by surface and gradient category. Duration estimation must define segment aggregation, stops (initially likely excluded unless specified), rounding, uncertainty, and fallback for unknown surface. Later personalized models can learn only from authorized rider data and must preserve deterministic safety checks.

## Traffic and safety

Traffic exposure is a normalized route-level value conceptually from 0 (very low) to 100 (very high), with provider confidence/freshness and departure relevance. It is not a bicycle safety score. Future safety combines traffic with speed, infrastructure, shoulders, intersections, classification, and reports in a separate model.

## Weather

MVP weather may be informational: temperature, precipitation probability, wind direction/speed for route time and location. Weather/wind cannot affect ranking until its scoring, missing-data, safety, and test semantics are explicitly added.

## Route-quality safeguards

- Fixed geographic fixtures cover urban, suburban, mountain, mixed surface, mostly gravel, waypoint, short time-constrained, and long-distance routes.
- Tests assert constraints, diversity, deterministic scores, explanations, and acceptable baseline metrics without overfitting exact third-party paths.
- Routing graph/provider/config versions are recorded so regressions are attributable.
- Candidate generation, rejection, enrichment, and ranking latencies are measured separately.

## Open decisions

Valhalla hosting/coverage and costing configuration; loop-anchor algorithm; similarity metric/threshold; geometry storage format and ownership timing (encoded polyline versus PostGIS or equivalent, decided before the first route-geometry migration; not a Milestone 0 decision); score formulas/weights; generic speed table; traffic provider/license; weather provider; missing-data penalties; maximum candidate budget; synchronous versus asynchronous orchestration; and route reproducibility guarantees.
