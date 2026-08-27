# Project plan

## Delivery principles

Complete one milestone at a time. Each milestone begins with repository inspection and a reviewed task plan, and ends only after its acceptance checks, verification, documentation update, diff review, and independent review for substantial changes.

Prefer permanent documents named in `README.md` over `RIDEVECTOR_HANDOFF.md`.

## Milestones

### Milestone 0 — Repository and environments

Establish workspace structure (`apps/web`, `apps/api`, `ios` placeholder, `supabase`, `contracts`), pnpm workspace with root scripts, mise-managed Node 24.19.0 and pnpm 11, local setup, development/staging/production separation for Cloudflare and environment taxonomy per `ENVIRONMENTS.md` / ADR-016 (one live remote Supabase development project; staging/production Supabase deferred), platform-native secrets, GitHub Actions CI, linting, type checking, and test foundations.

Milestone 0 scaffolding is limited to empty/smoke packages and configuration. No `packages/domain`, route domain models, product schemas, product API contracts, or application behavior. Contract work is OpenAPI 3.1 health/smoke only. Authentication product UX is out of scope; session-validation wiring/configuration may be established, but user-owned APIs must validate sessions before they are implemented later. iOS remains a toolchain placeholder (no Xcode project).

Acceptance:

- Development cannot accidentally write production data.
- Cloudflare Workers exist for development, staging, and production and are isolated. Production secrets and deployment permissions are isolated.
- Supabase in Milestone 0 (ADR-016): verified local stack; one live Free/Nano remote project `ridevector-development` in `us-west-1`; staging/production Supabase **names**, placeholders, guards, and secret conventions complete; **no** live `ridevector-staging` or `ridevector-production` projects yet (deferred for cost).
- Development config cannot resolve future staging/production Supabase resources or credentials.
- Tests and required quality checks gate production deployment.
- `.gitignore`, secret-ignore conventions, and secret-scan baseline are in place.
- A new contributor can follow verified environment/setup documentation, including the environment-name mapping.
- No application feature behavior is introduced.

### POC — Local route-generation experiment

Time-box a local-only vertical slice before Milestone 1 to test the central product hypothesis: can RideVector generate bicycle loops that the owner would consider riding?

This is an evidence-gathering detour, not a replacement for Milestones 1–11. It reuses `apps/web` and `apps/api` and deliberately implements only the minimum provisional types and behavior needed for personal testing. Production architecture, security, persistence, and deployment decisions remain recorded and resume after the POC is evaluated.

Scope:

- Select a start point on a web map.
- Enter a target distance and choose a broad road or gravel bicycle profile.
- Generate bounded, seeded, directionally varied loop candidates through a provider-neutral routing adapter backed initially by a configurable Valhalla-compatible endpoint.
- Return and display up to three alternatives with geometry, distance, estimated duration, target-distance difference, and factual warnings.
- Select, regenerate, and save candidates in browser-local storage for personal evaluation.
- Download the selected accepted alternative as a client-side GPX 1.1 track for manual Garmin Connect course import (field-test export only).
- Record local generation timing, candidate counts, selection, and a simple “would ride” assessment.

Explicit POC limits:

- Local execution only; no public or production deployment.
- No Supabase persistence, authentication, user-owned API, RLS, iOS, deadline handling, or production route personalities.
- No production export service, OAuth, direct Garmin Courses API publishing, FIT/TCX generation, or Strava integration. Manual client-side GPX download for field testing is in scope (POC-4 / ADR-019).
- No claim that road/gravel costing represents measured surface percentages.
- No creation of `packages/domain`; provisional contracts stay narrow and are replaced or promoted deliberately in Milestone 1.
- Public/shared routing endpoints are disposable development dependencies only and must be configurable, policy-compatible, and replaceable.

Acceptance:

- From a clean local checkout, a rider can select a start, request a distance-based loop, and see at least one real routed bicycle loop on the map.
- Common test locations normally yield at least two visibly different alternatives within a provisional ±20% target tolerance, or return an honest structured explanation.
- A generation attempt is bounded to 10 provider calls and records its seed and aggregate timing.
- Routes can be selected, regenerated, and saved locally without Supabase.
- A selected or reopened accepted route can be downloaded as standards-valid GPX 1.1 for manual Garmin Connect import.
- At least five synthetic or non-sensitive start/distance scenarios are evaluated, and findings determine whether to continue, revise candidate generation, or stop.
- POC limitations are visible in the UI and documentation; the POC is not deployable to staging or production.

### Milestone 1 — Core domain model

Implement and document provider-neutral route request, constraints, waypoints, candidates, results, preferences, validation, and normalization. Finalize product API resource schemas, validation-library usage, and the full error taxonomy. Resolve whether `GET /api/routes/:id` identifies a route request or a generated alternative.

Acceptance: invalid combinations are rejected; normalization and boundary cases have unit tests; models and units are documented.

### Milestone 2 — Basic routing service

Validate and operate Valhalla for bicycle start/destination, ordered required waypoints, and loop requests.

Acceptance: bicycle restrictions are respected; geometry and statistics return through the adapter; hosting/coverage/latency/cost are recorded.

### Milestone 3 — Distance-based loop generation

Generate multiple directionally diverse loops within target distance/tolerance and remove near duplicates.

Acceptance: multiple materially distinct loops; configured tolerance enforcement; duplicate filtering and diversity tests.

### Milestone 4 — Surface-aware routing

Classify paved, gravel, dirt/unpaved, and unknown surface; score requested ranges.

Acceptance: percentages and confidence provenance are represented; mismatch changes rank or validity; tests cover incomplete OSM metadata.

### Milestone 5 — Time-based generation

Add available/preferred time, maximum duration, rider-speed estimates, and must-finish-by safety buffer.

Acceptance: duration estimation; hard maximum/deadline enforcement; centralized configurable speeds and buffer; time-zone tests.

### Milestone 6 — Traffic integration

Integrate a selected provider through an adapter and normalize route exposure.

Acceptance: departure-aware analysis where supported; normalized score; traffic preference affects ranking; licensing/caching behavior documented.

### Milestone 7 — Route ranking

Implement explainable deterministic scoring and distinct Best Overall, Quietest, and Adventure selections.

Acceptance: centralized weights; scoring/ranking/diversity tests; machine-readable explanations; no three near-identical results.

### Milestone 8 — React planner

Build the supported web planning, map, generation, and comparison experience with accessible failure/loading states.

### Milestone 9 — iOS planner

Build the equivalent supported SwiftUI flow against the same API semantics.

### Milestone 10 — Saved routes and GPX

Add secured saved-route history and production-grade, standards-valid GPX export for authenticated clients. The local POC already supports a client-side GPX 1.1 download for manual Garmin field testing (ADR-019); Milestone 10 hardens contracts, persistence, security, supported-client behavior, and any remaining export semantics required for private beta.

### Milestone 11 — Private beta

Operate a controlled beta and measure generation acceptance, regeneration, selection, completion, rating, and surface/traffic accuracy. Primary metric: did the rider choose and ride a generated route?

## Deferred from MVP

Voice navigation, watch navigation, activity recording, training plans, social/competitive features, messaging, live tracking, crash detection, full offline navigation, and extensive moderation are out of scope. Personalization, safety intelligence, surface confidence, weather-aware ranking, departure optimization, community intelligence, learned ranking, direct Garmin publishing, and ride presets follow evidence and explicit milestones.

## Definition of private-beta readiness

A signed-in rider can plan with start/end or return-to-start, required waypoints, distance/range, time/deadline, departure time, surfaces, elevation, and traffic; receive at least three materially different explained alternatives; compare their essential metrics; save one; export valid GPX; and retrieve the saved route through supported clients. Authentication product UX remains an explicit decision before those user-facing sign-in flows are built.
