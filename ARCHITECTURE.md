# Architecture

## Status and goals

This document records the target architecture before implementation. Items labeled *proposed* require validation during Milestone 0 or a later named milestone.

RideVector optimizes ride quality under composable distance, time, waypoint, surface, elevation, traffic, and departure constraints. The architecture prioritizes explainable results, replaceable providers, strict data ownership, and equivalent web/iOS contracts.

Agents and contributors must treat this file and the other permanent documents named in `README.md` as authoritative. `RIDEVECTOR_HANDOFF.md` is historical planning input only.

## System context

```text
React web ─┐
           ├─ HTTPS ─> Cloudflare Worker API ─> Supabase Auth/PostgreSQL
SwiftUI ───┘                    │
                               ├─> Routing adapter ─> Valhalla service
                               ├─> Traffic adapter ─> traffic provider
                               └─> Weather adapter ─> weather provider
```

The clients collect and present route requests. The Worker authenticates, validates, orchestrates, rate-limits, and persists. Valhalla performs graph-heavy routing outside Workers. PostgreSQL stores durable application state. Provider-specific representations stop at adapters.

## Logical boundaries

### Shared domain

Owns route constraints, normalized requests, candidates, results, rejection reasons, scores, explanations, and provider-neutral geometry/value objects. It must be deterministic where practical and runnable in unit tests without network access.

TypeScript domain code is expected to be shared by the web and Worker where runtime boundaries permit. Swift models mirror the versioned API contract; Swift must not import TypeScript implementation details.

Milestone 0 does **not** create a shared domain package. Layout is `apps/web`, `apps/api`, `ios` (toolchain placeholder), `supabase`, and `contracts` (OpenAPI 3.1 health/smoke only). `packages/domain` (or equivalent) waits for Milestone 1. Route domain models and product schemas belong to Milestone 1+.

### React web client

Owns web interaction, map presentation, request editing, alternative comparison, saving, and export initiation. It uses only public client credentials and the API. It does not call privileged database or provider operations.

### SwiftUI iOS client

Owns the native equivalent of the supported planner experience. It consumes the same API semantics and provider-neutral geometry. Platform map SDK types stay in the presentation adapter.

### Cloudflare Worker API

Owns authentication validation, authorization, input normalization at the trust boundary, orchestration, rate limiting, cache policy, external calls, persistence, stable errors, and observability. Heavy graph processing and long-lived routing data do not belong in the Worker.

Authentication product UX (sign-in methods, client account flows) is undecided. Milestone 0 may establish session-validation wiring or configuration only. Any user-owned API introduced in later milestones must validate sessions at the Worker before handling private data, with RLS as mandatory defense at the database.

### Supabase/PostgreSQL

Owns durable user profiles, preferences, route requests, generated alternatives, waypoints, saved routes, feedback, and external-connection metadata. Database constraints preserve invariants; RLS is mandatory defense at the data boundary.

### Routing service

Valhalla is the proposed initial engine. It runs as an independently deployable service with explicit coverage/version metadata, health checks, timeouts, and an internal adapter. Hosting and geographic coverage remain unresolved until Milestone 2 benchmarking.

### External providers

Traffic, weather, geocoding, and mapping are replaceable integrations. Raw responses are translated into internal models immediately. Licensing, retention, caching, attribution, geographic availability, latency, and cost must be evaluated before selection.

## Request flow

1. Client sends a versioned request with an access token.
2. Worker authenticates, authorizes, validates, normalizes units/times, and records a request safely.
3. Generation orchestrator asks the routing adapter for diverse candidates.
4. Enrichment derives route metrics and calls enabled providers.
5. Hard-constraint validation rejects invalid candidates with machine-readable reasons.
6. Deterministic scoring ranks remaining candidates and selects distinct personalities.
7. Worker persists appropriate normalized output and returns alternatives with explanations.

Generation may be synchronous initially only if measured latency fits the API budget. If it cannot reliably complete within the platform/request budget, a later decision must introduce an asynchronous job protocol; this document does not preselect one.

## Dependency rules

- Domain → no UI, database client, Worker runtime, map SDK, or provider SDK.
- Clients → API contracts and local presentation adapters only.
- Worker handlers → application use cases; handlers do not contain scoring algorithms.
- Application use cases → domain plus ports/interfaces.
- Infrastructure adapters → provider SDKs, Supabase, Valhalla, clocks, and telemetry.
- Database schema and public API evolve through reviewed, backward-aware changes.

## Environment topology

Canonical environments are `local`, `development`, `staging`, and `production`. See `ENVIRONMENTS.md` for the binding platform-name mapping (GitHub Actions Environments, Cloudflare/Wrangler env names, Supabase projects, and example env files).

**Target production topology:** Development, staging, and production must use distinct Cloudflare environments and distinct Supabase projects. They must have separate secrets, URLs, signing context, provider credentials/quotas where feasible, and protected deployment paths. Local development uses emulators/local services.

**Milestone 0 (ADR-016):** Verified local Supabase plus one live remote Supabase project (`ridevector-development`). Staging and production Supabase **names**, config placeholders, GitHub Environment guards, and secret conventions are required; live `ridevector-staging` and `ridevector-production` projects are **not** required yet. Cloudflare Workers for development, staging, and production may already exist and isolation must be demonstrated for what is live. Those Workers must not receive or reference nonexistent Supabase staging/production credentials.

**Deferred:** Create live Supabase staging and production projects during later deployment / private-beta readiness, still in order local → development → staging → production. Production Cloudflare deploys must always be selected explicitly; no default command may target production.

Secrets are platform-native only (GitHub, Cloudflare, Supabase).

## Repository layout (Milestone 0)

```text
apps/web      React + TypeScript web client (smoke only in M0)
apps/api      Cloudflare Worker API (smoke/health only in M0)
ios/          Verified Swift/Xcode toolchain placeholder (no Xcode project in M0)
supabase/     Declarative schemas + generated reviewed migrations (no product tables in M0)
contracts/    OpenAPI 3.1 (health/smoke contract only in M0)
```

Do not add `packages/domain` until Milestone 1.

## Cursor rule path conventions

Approved globs:

- React/web: `apps/web/**`
- Worker/API: `apps/api/**`
- iOS placeholder/docs and future native files: `ios/**`
- Supabase: `supabase/**`

The React rule must not govern `apps/api` or other non-web TypeScript.

## Cross-cutting concerns

- Canonical storage and API units: meters, seconds, UTC timestamps; clients localize display.
- Coordinates: WGS84 latitude/longitude unless a documented contract says otherwise.
- Time: ISO 8601 with offset at boundaries; persist `timestamptz`; retain rider timezone where wall-clock interpretation matters.
- Idempotency: generation/save endpoints that can be retried should gain explicit idempotency semantics before production.
- Observability: latency by stage/provider, candidate/rejection counts, scores, error classes, and selected personality; redact sensitive route/user data.
- Performance target: preferred under 5 seconds and MVP acceptable under 10 seconds for generation, subject to measurement and platform limits.

## Known assumptions and unresolved design work

- There is no existing application architecture to preserve; all stack choices remain unvalidated intentions.
- Monorepo tooling for Milestone 0 is decided: pnpm workspace, mise-managed Node 24.19.0, GitHub Actions, layout above. Swift Xcode project creation, Valhalla host/coverage, traffic license/capability, weather provider, job model, geometry storage format, and retention policy remain undecided for later milestones.
- The conceptual database and API designs require threat modeling and compatibility review before implementation.
- Whether `GET /api/routes/:id` identifies a route request or a generated alternative is an open Milestone 1 API decision.
