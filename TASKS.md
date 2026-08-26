# Current tasks — Milestone 0 only

## Status

**Milestone 0 decisions are accepted. Awaiting final approval of the ordered execution plan before any install, scaffold, cloud-resource creation, commit, or push.**

Authoritative decisions: `DECISIONS.md` (ADR-006–ADR-015) and `ENVIRONMENTS.md`. Prefer permanent docs over `RIDEVECTOR_HANDOFF.md`.

## 0.1 Baseline and decisions

- [x] Approve the permanent documentation and Cursor rules as the source of truth over `RIDEVECTOR_HANDOFF.md`.
- [x] Record first-commit policy: documentation-only first commit, then protected `main` and pull-request workflow (ADR-014).
- [x] Record toolchain: Node 24.19.0 via mise, stable pnpm 11 (exact patch pinned at scaffold), pnpm workspace with root scripts, no Turbo/Nx (ADR-007).
- [x] Record layout: `apps/web`, `apps/api`, `ios`, `supabase`, `contracts`; no `packages/domain` until Milestone 1 (ADR-006).
- [x] Record CI: GitHub Actions with protected deployments (ADR-008).
- [x] Record secrets: platform-native only (ADR-009).
- [x] Record environment taxonomy and mappings in `ENVIRONMENTS.md` (ADR-010); production always explicit.
- [x] Record concrete remote names and deploy guards (ADR-015): Cloudflare `ridevector-api` / `ridevector-api-{development,staging,production}`; Supabase `ridevector-{development,staging,production}` same region; GitHub Environment protections as in `ENVIRONMENTS.md`.
- [x] Record Supabase declarative schemas + generated reviewed migrations (ADR-011).
- [x] Record OpenAPI 3.1 under `contracts/` with health/smoke only in M0 (ADR-012).
- [x] Record iOS as verified toolchain placeholder; no Xcode project in M0 (ADR-013).
- [x] Narrow Cursor rule globs to approved paths so React rules do not govern `apps/api`.
- [ ] After execution-plan approval: add repository `.gitignore` and secret-ignore conventions before scaffold or env files.
- [ ] After execution-plan approval: perform documentation-only first commit, then enable protected `main` and PR workflow before scaffold PRs.

## 0.2 Minimal repository scaffold

Prerequisite: execution-plan approval; `.gitignore` present; docs first commit and branch protection per ADR-014 as applicable to the step order in the plan.

- [ ] Create empty/smoke `apps/web` and `apps/api` only (no product behavior).
- [ ] Create `contracts/` with OpenAPI 3.1 health/smoke contract only.
- [ ] Create `supabase/` foundation config for declarative schema workflow without product tables.
- [ ] Create `ios/` verified toolchain placeholder only (no Xcode project).
- [ ] Do not create `packages/domain` or any route domain models, product schemas, product API resources, auth UX, planner UI, routing, providers, scoring, persistence, or GPX behavior.
- [ ] Pin direct dependencies and CLIs exactly; commit lockfiles.
- [ ] Add format, lint, TypeScript strict type-check, unit-test, and build commands with non-placeholder smoke tests only.
- [ ] Add root pnpm scripts that run required checks consistently across the workspace.

## 0.3 Environment isolation and secrets

Create in order: **local → development → staging → production**. All three remote environments remain mandatory for completion.

- [ ] Apply `ENVIRONMENTS.md` mapping across GitHub, Cloudflare, Supabase, and client config.
- [ ] Establish local Supabase and local Worker workflows.
- [ ] Create/verify Supabase projects `ridevector-development`, then `ridevector-staging`, then `ridevector-production` in the same region; record the region in `ENVIRONMENTS.md`.
- [ ] Create/verify Cloudflare Workers `ridevector-api-development`, then `ridevector-api-staging`, then `ridevector-api-production` under base config `ridevector-api`; every remote deploy must pass an explicit environment.
- [ ] Configure GitHub Environments: `development` (no reviewer); `staging` (no reviewer initially, deploy only from `main`); `production` (approval by `jmondragontech2023`, deploy only from `main`); do not enable prevent-self-review while there is only one authorized reviewer.
- [ ] Add safe example environment files; ignore all real secret files.
- [ ] Make `local` / `development` the safe defaults per `ENVIRONMENTS.md`; require explicit protected production targeting.
- [ ] Add an automated assertion that non-production builds/config cannot reference production project IDs, hosts, routes, or credentials.

## 0.4 CI and deployment safety

- [ ] Configure GitHub Actions to run formatting check, lint, type checks, unit tests, and builds on pull requests.
- [ ] Mock external services in CI; do not require production credentials.
- [ ] Define staging deployment gates and smoke checks.
- [ ] Define production deployment as an explicit protected workflow gated on all required checks and environment approval.
- [ ] Add dependency/secret scanning, including baseline coverage for `.gitignore` secret paths.

## 0.5 Supabase foundation

- [ ] Implement declarative-schema source plus generated reviewed migration conventions using current Supabase guidance and verified CLI behavior.
- [ ] Add local configuration only after verifying installed CLI behavior with `--help` and current docs.
- [ ] Establish migration, seed-test-data, RLS-test, type-generation, and database-advisor conventions without product tables.
- [ ] Verify that no service-role/secret key can enter a client bundle.
- [ ] Session-validation wiring/configuration only if needed for scaffold; no authentication product UX or user-owned product APIs.

## 0.6 Cloudflare foundation

- [ ] Verify current Workers/Wrangler configuration schema, compatibility settings, environment behavior, local secret handling, and observability defaults against `apps/api`.
- [ ] Add minimal health/smoke surface aligned to the OpenAPI smoke contract; no RideVector feature logic; no user-owned resources.
- [ ] Define typed binding validation; production bindings cannot be selected by default.
- [ ] Keep any session-validation scaffolding as configuration/wiring only.

## 0.7 Documentation and acceptance

- [ ] Replace provisional setup sections with commands actually run successfully on a clean checkout.
- [ ] Document local startup, testing, environment selection, secret setup, staging deploy, production recovery/rollback, and common failures.
- [ ] Keep `ENVIRONMENTS.md` synchronized with real project/environment names (no secret values).
- [ ] Run every required local/CI-equivalent check and record actual results.
- [ ] Inspect the complete diff and conduct an independent security/configuration review.
- [ ] Demonstrate all Milestone 0 acceptance criteria from `PROJECT_PLAN.md`, including separate development, staging, and production resources.

## Explicitly not in this milestone

No `packages/domain`, route domain models, product database tables, product API resource schemas, full error taxonomy, validation-library product usage, authentication UI/product UX, planner UI, routing calls, provider integrations, scoring, persistence features, GPX behavior, or Xcode project.
