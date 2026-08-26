# Architectural decisions

## How to use this log

Accepted decisions are binding until superseded by a dated entry. Proposed decisions express current direction but require validation. Record context, choice, consequences, and superseding links; do not rewrite history to hide a change.

## Accepted

### ADR-001 — Route quality and explainability lead the MVP

- Status: Accepted
- Context: Existing products already record rides and navigate well.
- Decision: Prioritize constraint-aware generation of multiple distinct routes, deterministic/explainable ranking, comparison, save, and GPX export. Defer social, recording, and navigation breadth.
- Consequence: Routing/domain quality and regression testing precede UI polish.

### ADR-002 — Heavy routing is an external service

- Status: Accepted
- Decision: Do not run a routing graph inside Cloudflare Workers. Access routing through an internal provider-neutral port.
- Consequence: The routing service has independent deployment, scaling, health, coverage, and security concerns.

### ADR-003 — Clients are untrusted and providers are abstracted

- Status: Accepted
- Decision: Enforce authorization at Worker and database boundaries and translate routing, traffic, weather, geocoding, and map-provider types at adapters.
- Consequence: Web/iOS cannot hold privileged secrets or authoritative computed fields; provider replacement does not rewrite the domain.

### ADR-004 — Environments and production secrets are isolated

- Status: **Superseded** by ADR-016 (2026-08-26) for Milestone 0 Supabase remote-project count only
- Decision: Use separate development, staging, and production Supabase projects and Cloudflare environments, plus local development. Production targeting is explicit and protected. Creating those resources may happen later within Milestone 0, but Milestone 0 is not complete until separate development, staging, and production resources exist and isolation is demonstrated.
- Consequence: Milestone 0 must demonstrate isolation before feature work. Canonical names and platform mappings are recorded in ADR-010 and `ENVIRONMENTS.md`.
- Superseded note: ADR-016 retains the three-environment naming and isolation model, but defers live Supabase staging/production projects past Milestone 0 for cost reasons. Cloudflare remotes and GitHub Environment guards remain required in Milestone 0.

### ADR-005 — Permanent documents replace the handoff as shared memory

- Status: Accepted
- Decision: Maintain the repository document set named in `README.md`; keep `TASKS.md` limited to the active milestone. `RIDEVECTOR_HANDOFF.md` remains historical planning input only and is not authoritative when it conflicts with permanent documents.
- Consequence: Code changes that alter truth include focused documentation updates. Agents and contributors must prefer permanent docs over the handoff.

### ADR-006 — Milestone 0 repository layout

- Status: Accepted — 2026-08-26
- Context: Milestone 0 needs a minimal monorepo without premature domain packages.
- Decision: Use top-level `apps/web`, `apps/api`, `ios`, `supabase`, and `contracts`. Do not create `packages/domain` (or equivalent shared domain package) until Milestone 1.
- Consequence: Cursor rule globs are narrowed to these paths. Shared route domain code waits for Milestone 1.

### ADR-007 — JavaScript toolchain and workspace

- Status: Accepted — 2026-08-26
- Decision: Use a pnpm workspace with root scripts only (no Turbo/Nx). Pin Node.js to **24.19.0** (LTS) via **mise**. Use **pnpm 11.24.0** (pinned in `mise.toml` and `packageManager`). Pin all project dependencies and CLIs exactly (no floating ranges for direct deps).
- Consequence: Root `package.json` scripts orchestrate format, lint, typecheck, test, and build across `apps/web` and `apps/api`.

### ADR-008 — CI and deployment control plane

- Status: Accepted — 2026-08-26
- Decision: Use GitHub Actions for CI and protected deployments. Protect `main` and require pull-request workflow after the documentation-only first commit.
- Consequence: PR checks gate merges; staging deploys only from `main`; production deploys only from `main` with approval from `jmondragontech2023`; production is never a default target. See ADR-015 and `ENVIRONMENTS.md`.

### ADR-009 — Secrets are platform-native only

- Status: Accepted — 2026-08-26
- Decision: Store secrets only in platform-native facilities: GitHub Actions/Environment secrets, Cloudflare Workers/Wrangler secrets, and Supabase project secret mechanisms. Do not introduce a third-party secrets manager in Milestone 0.
- Consequence: Documentation covers ownership and rotation per platform without committing values. Example env files remain non-secret.

### ADR-010 — Environment taxonomy and name mapping

- Status: **Superseded in part** by ADR-016 (2026-08-26) for Milestone 0 Supabase remote-project liveness only
- Decision: Canonical environments are `local`, `development`, `staging`, and `production`. Create resources in that order: local → development → staging → production. All three remote environments (`development`, `staging`, `production`) remain mandatory for Milestone 0 completion. Production must always be selected explicitly and protected. Full mapping lives in `ENVIRONMENTS.md`.
- Consequence: Scripts, Wrangler env keys, GitHub Environments, Supabase projects, and client config suffixes use the mapping table; non-production config must fail if it resolves production identifiers.
- Superseded note: ADR-016 keeps the four-name taxonomy and isolation rules, but Milestone 0 no longer requires live Supabase projects for staging and production.

### ADR-015 — Concrete remote resource names and deploy guards

- Status: Accepted — 2026-08-26 (Supabase staging/production **creation timing** narrowed by ADR-016)
- Decision:
  - Cloudflare base configuration/service name: `ridevector-api`. Per-environment Worker names: `ridevector-api-development`, `ridevector-api-staging`, `ridevector-api-production`. Every remote deployment must specify an environment explicitly.
  - Supabase project names: `ridevector-development`, `ridevector-staging`, `ridevector-production`, all intended for the same region (region chosen at development project creation and recorded in `ENVIRONMENTS.md`).
  - GitHub Environments: `development` has no reviewer; `staging` has no reviewer initially and deploys only from `main`; `production` requires approval from `jmondragontech2023` and deploys only from `main`. Do not enable prevent-self-review while there is only one authorized production reviewer.
- Consequence: Milestone 0 cloud/CI setup must use these exact names and guards; see `ENVIRONMENTS.md`. ADR-016 defers creating live `ridevector-staging` and `ridevector-production` Supabase projects until a later deployment-readiness milestone.

### ADR-016 — Milestone 0 Supabase remote scope (cost deferral)

- Status: Accepted — 2026-08-26
- Context: Free Plan limits active projects (two), and running three live Supabase remotes during Milestone 0 adds unnecessary cost before product tables and staging/production deploy readiness exist. ADR-004 and ADR-010 previously required three live remote Supabase projects as Milestone 0 definition-of-done.
- Decision:
  - Milestone 0 requires: (1) verified local Supabase (`ridevector-local`), (2) one isolated remote Free/Nano project `ridevector-development` in approved region **`us-west-1`**, (3) complete staging/production **naming**, configuration placeholders, deployment guards, and secret conventions for future `ridevector-staging` / `ridevector-production`, and (4) **no** live Supabase staging or production projects yet.
  - Do not create `ridevector-staging` or `ridevector-production` in Milestone 0. Do not store or reference live staging/production Supabase credentials.
  - Cloudflare Workers for development/staging/production may already exist; they must not bind to live staging/production Supabase secrets until those projects are created later.
  - Development config and workflows must fail closed if they resolve future staging/production Supabase identifiers or credentials.
  - Creating `ridevector-development` must use Free Plan / Nano only; stop if the platform requires a paid-plan upgrade or paid add-on.
- Consequence: ADR-004 and the Milestone 0 remote-liveness clauses of ADR-010 are superseded for Supabase project count. Naming in ADR-015 remains; creation of staging/production Supabase projects moves to a later deployment-readiness milestone. `ENVIRONMENTS.md`, `PROJECT_PLAN.md`, and `TASKS.md` record the revised acceptance bar.

### ADR-011 — Supabase schema workflow

- Status: Accepted — 2026-08-26
- Decision: Use Supabase declarative schemas as the source of truth, with generated migrations that are reviewed before apply. Never edit an applied migration.
- Consequence: Milestone 0 establishes the workflow and conventions without product tables.

### ADR-012 — API contract source for Milestone 0

- Status: Accepted — 2026-08-26
- Decision: OpenAPI 3.1 is the contract source under `contracts/`. Milestone 0 contains a health/smoke contract only. Product resource schemas, validation-library usage, and the full error taxonomy belong to Milestone 1.
- Consequence: `apps/web` and `apps/api` may wire contract consumption against the smoke contract only.

### ADR-013 — iOS in Milestone 0

- Status: Accepted — 2026-08-26
- Decision: Keep `ios/` as a verified toolchain placeholder. Do not create an Xcode project in Milestone 0.
- Consequence: Document and verify Swift/Xcode toolchain prerequisites; defer project scaffold to a later milestone.

### ADR-014 — First commit and branch protection

- Status: Accepted — 2026-08-26
- Decision: The first commit is documentation-only (permanent docs, Cursor rules, and Milestone 0 decision/environment docs). After that commit exists on `main`, enable protected `main` and pull-request workflow before scaffold commits land through PRs.
- Consequence: Scaffold and environment work proceeds via reviewed pull requests after the docs commit and protection setup.

### ADR-017 — Time-boxed local route-generation POC

- Status: Accepted — 2026-08-26
- Context: Milestone 0 is merged, but the production sequence postpones a testable route-generation experience until after several foundational milestones. The next product risk is route usefulness, not infrastructure readiness.
- Decision:
  - Run a local-only route-generation experiment on branch `poc/route-generation` before Milestone 1.
  - Reuse `apps/web` and `apps/api`; `poc/` contains experiment documentation only, not a duplicate application.
  - Limit the experience to map-selected start, target distance, broad road/gravel costing, seeded anchor-based loops, up to three alternatives, basic metrics, regeneration, browser-local saving, and local feedback.
  - Keep a thin provider-neutral routing boundary and canonical meters/seconds, but defer the complete domain model, product OpenAPI contract, persistence, authentication, iOS, enrichment, and production ranking.
  - Permit an unauthenticated generation endpoint only in local execution. It must fail closed outside the local environment and must not be deployed through staging or production workflows.
  - Bound each generation attempt to at most 10 provider calls. Keep the routing endpoint configurable and do not commit provider secrets or precise personal-location fixtures.
- Consequence: The POC may knowingly fall short of production acceptance requirements, but those requirements and all earlier ADRs remain preserved. Any POC type or algorithm promoted into Milestone 1 must be reviewed rather than treated as an accidental final contract. The experiment ends with an explicit continue/revise/stop decision.

### ADR-018 — Public hosted Valhalla for POC development

- Status: Accepted — 2026-08-26
- Context: Local Valhalla via Docker requires substantial RAM and tile-build time, blocking POC validation on low-memory developer machines. ADR-017 required a configurable routing endpoint but did not mandate self-hosted Valhalla for the POC.
- Decision:
  - During the route-generation POC, local development may use the public hosted Valhalla demo (`https://valhalla1.openstreetmap.de`) via Worker env `VALHALLA_BASE_URL`.
  - All Valhalla-specific request/response handling remains behind the `RoutingProvider` / Valhalla adapter in `apps/api`. The React app calls RideVector API only.
  - Send `X-Client-Id: RideVector` on upstream POC requests; do not implement aggressive retries or high concurrency against the public demo.
  - Post-POC intent: migrate to a RideVector-controlled Valhalla deployment after product validation and workload/cost benchmarking. Cloudflare Containers or a conventional Linux VM remain options; do not preselect production hosting here.
- Consequence: POC developers can run `pnpm dev` without Docker Valhalla. Production/staging Workers still must not expose POC routing endpoints until Milestone 2+ hosting decisions are made.

## Proposed; validate during later milestones

### ADR-P01 — Initial platform stack

React/TypeScript web, Swift/SwiftUI iOS, Cloudflare Workers API, Supabase/PostgreSQL/Auth, and Valhalla/OSM routing remain the intended stack. Milestone 0 validates toolchain and environment fit for web/Worker/Supabase; Valhalla and native iOS project fit remain later.

### ADR-P02 — Canonical domain units

Use meters, seconds, UTC instants, explicit timezone context for wall-clock deadlines, WGS84 coordinates, and provider-neutral geometry. Final API/database types are decided with Milestone 1/schema work.

### ADR-P03 — Deterministic multi-stage generation

Normalize → generate many → enrich → reject hard violations → score → deduplicate/select personalities → explain. Use configurable/versioned values and reproducible seeds rather than MVP machine learning.

### ADR-P04 — Initial traffic candidate

TomTom is a candidate only. Selection depends on bicycle-route applicability, predicted/historical traffic, licensing/retention/caching, coverage, latency, reliability, and cost. Weather/map/geocoding providers are unselected.

## Open decisions by milestone

Milestone 0 (remaining execution): Free/Nano `ridevector-development` created in **`us-west-1`** (ref recorded in `ENVIRONMENTS.md`); GitHub `development` Environment non-secret vars + platform-native secrets configured. Do **not** create live Supabase staging/production remotes. Remaining before merge: PR review stop, independent security/configuration review, then merge to `main` and confirm Cloudflare staging/production Worker smoke (no Supabase staging/production). Health endpoint is `/api/health`. Toolchain pins: pnpm **11.24.0**, Supabase CLI **2.115.0**, Wrangler **4.126.0**.

Milestone 1: exact domain/API types, validation library, full error taxonomy, units/timezone semantics, configuration/versioning, product OpenAPI resource schemas, whether `GET /api/routes/:id` identifies a route request or a generated alternative, introduction of `packages/domain` (or equivalent), and authentication product UX (while any user-owned API must validate sessions before implementation).

Milestone 2+: Valhalla hosting/coverage/graph builds, candidate algorithm, concurrency/job model, similarity threshold, provider selection, scoring weights, route retention, integration-token storage, iOS Xcode project creation, and geometry storage format/ownership timing (encoded polyline versus PostGIS or equivalent, decided before the first route-geometry migration).

## Authentication boundary (clarification)

Authentication product UX (sign-in methods, client flows, account recovery) is undecided and is not a Milestone 0 deliverable. Milestone 0 may establish Worker session-validation wiring or configuration scaffolding only. User-owned APIs must validate sessions at the Worker (and rely on RLS at the database) before those APIs are implemented in later milestones.

## Repository inspection record — 2026-08-26

At documentation creation, the repository contained only `RIDEVECTOR_HANDOFF.md` and was not yet a Git working tree.

**Updated inspection (documentation correction pass):** Git is initialized on `main`. `origin` points to `https://github.com/jmondragontech2023/RideVector.git`. There are no commits. All project files are untracked. No `.gitignore` exists. There is no application code, dependency manifest, migration, test suite, CI workflow, environment file, or existing architecture to preserve. Permanent documentation and `.cursor/rules` are the only project content.

**Milestone 0 decision lock (planning):** Layout, toolchain, CI, secrets, environment taxonomy, concrete Cloudflare/Supabase/GitHub names and deploy guards (ADR-015), Supabase workflow, OpenAPI smoke-contract approach, iOS placeholder, and first-commit policy are accepted. Implementation must not begin until the final ordered Milestone 0 execution plan receives explicit approval.
