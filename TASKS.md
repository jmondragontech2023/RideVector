# Current tasks — Milestone 0 only

## Status

**Milestone 0 completion in progress** on branch `milestone-0/completion`. Decisions: `DECISIONS.md` (ADR-006–ADR-015) and `ENVIRONMENTS.md`. Do **not** mark Milestone 0 complete until remaining user actions below are done and acceptance criteria in `PROJECT_PLAN.md` are evidenced.

## 0.1 Baseline and decisions

- [x] Approve the permanent documentation and Cursor rules as the source of truth over `RIDEVECTOR_HANDOFF.md`.
- [x] Record first-commit policy: documentation-only first commit, then protected `main` and pull-request workflow (ADR-014).
- [x] Record toolchain: Node 24.19.0 via mise, pnpm 11.24.0, pnpm workspace with root scripts, no Turbo/Nx (ADR-007).
- [x] Record layout: `apps/web`, `apps/api`, `ios`, `supabase`, `contracts`; no `packages/domain` until Milestone 1 (ADR-006).
- [x] Record CI: GitHub Actions with protected deployments (ADR-008).
- [x] Record secrets: platform-native only (ADR-009).
- [x] Record environment taxonomy and mappings in `ENVIRONMENTS.md` (ADR-010); production always explicit.
- [x] Record concrete remote names and deploy guards (ADR-015): Cloudflare `ridevector-api` / `ridevector-api-{development,staging,production}`; Supabase `ridevector-{development,staging,production}` same region; GitHub Environment protections as in `ENVIRONMENTS.md`.
- [x] Record Supabase declarative schemas + generated reviewed migrations (ADR-011).
- [x] Record OpenAPI 3.1 under `contracts/` with health/smoke only in M0 (ADR-012).
- [x] Record iOS as verified toolchain placeholder; no Xcode project in M0 (ADR-013).
- [x] Narrow Cursor rule globs to approved paths so React rules do not govern `apps/api`.
- [x] Add repository `.gitignore` and secret-ignore conventions.
- [x] Enable protected `main` and PR workflow; configure GitHub Environments per ADR-015.

## 0.2 Minimal repository scaffold

- [x] Create empty/smoke `apps/web` and `apps/api` only (no product behavior).
- [x] Create `contracts/` with OpenAPI 3.1 health/smoke contract only.
- [x] Create `supabase/` foundation config for declarative schema workflow without product tables.
- [x] Create `ios/` verified toolchain placeholder only (no Xcode project).
- [x] Do not create `packages/domain` or any route domain models, product schemas, product API resources, auth UX, planner UI, routing, providers, scoring, persistence, or GPX behavior. _(Inapplicable as a “done feature”; enforced by absence — no `packages/domain`.)_
- [x] Pin direct dependencies and CLIs exactly; commit lockfiles.
- [x] Add format, lint, TypeScript strict type-check, unit-test, and build commands with non-placeholder smoke tests only.
- [x] Add root pnpm scripts that run required checks consistently across the workspace.

## 0.3 Environment isolation and secrets

Create in order: **local → development → staging → production**. All three remote environments remain mandatory for completion.

- [x] Apply `ENVIRONMENTS.md` mapping across GitHub, Cloudflare, Supabase, and client config _(mapping + Cloudflare done; Supabase remotes pending approval/create)_.
- [ ] Establish local Supabase and local Worker workflows. _(Worker local workflow implemented; Supabase local start/reset blocked in agent environment — Docker socket denied; needs user machine verification.)_
- [ ] Create/verify Supabase projects `ridevector-development`, then `ridevector-staging`, then `ridevector-production` in the same region; record the region in `ENVIRONMENTS.md`. _(STOP — requires explicit region/cost approval before create. Proposed region: `us-west-1`.)_
- [x] Create/verify Cloudflare Workers `ridevector-api-development`, then `ridevector-api-staging`, then `ridevector-api-production` under base config `ridevector-api`; every remote deploy must pass an explicit environment.
- [x] Configure GitHub Environments: `development` (no reviewer); `staging` (no reviewer initially, deploy only from `main`); `production` (approval by `jmondragontech2023`, deploy only from `main`); do not enable prevent-self-review while there is only one authorized reviewer.
- [x] Add safe example environment files; ignore all real secret files.
- [x] Make `local` / `development` the safe defaults per `ENVIRONMENTS.md`; require explicit protected production targeting. _(Ordinary API `dev` uses base local Wrangler config.)_
- [x] Add an automated assertion that non-production builds/config cannot reference production project IDs, hosts, routes, or credentials _(structured wrangler assertions + negative fixtures + client-bundle secret scan)_.

## 0.4 CI and deployment safety

- [x] Configure GitHub Actions to run formatting check, lint, type checks, unit tests, and builds on pull requests.
- [x] Mock external services in CI; do not require production credentials. _(CI uses fixtures/local checks only; no production secrets required for `pnpm run check`.)_
- [x] Define staging deployment gates and smoke checks. _(workflow updated; live protected staging verify pending GH auth / merge to main)_
- [x] Define production deployment as an explicit protected workflow gated on all required checks and environment approval. _(workflow updated; live production deploy requires explicit Environment approval — do not bypass)_
- [x] Add dependency/secret scanning, including baseline coverage for `.gitignore` secret paths.

## 0.5 Supabase foundation

- [x] Implement declarative-schema source plus generated reviewed migration conventions using current Supabase guidance and verified CLI behavior. _(CLI pin 2.115.0; conventions in `supabase/README.md`; no product tables)_
- [x] Add local configuration only after verifying installed CLI behavior with `--help` and current docs.
- [x] Establish migration, seed-test-data, RLS-test, type-generation, and database-advisor conventions without product tables.
- [x] Verify that no service-role/secret key can enter a client bundle. _(script + build scan; smoke app has none)_
- [x] Session-validation wiring/configuration only if needed for scaffold; no authentication product UX or user-owned product APIs. _(Inapplicable — not needed for health-only Worker; no session wiring added.)_

## 0.6 Cloudflare foundation

- [x] Verify current Workers/Wrangler configuration schema, compatibility settings, environment behavior, local secret handling, and observability defaults against `apps/api`.
- [x] Add minimal health/smoke surface aligned to the OpenAPI smoke contract; no RideVector feature logic; no user-owned resources.
- [x] Define typed binding validation; production bindings cannot be selected by default. _(generated `wrangler types`; local default is base config)_
- [x] Keep any session-validation scaffolding as configuration/wiring only. _(Inapplicable — none required for M0 health endpoint.)_

## 0.7 Documentation and acceptance

- [x] Replace provisional setup sections with commands actually run successfully on a clean checkout _(as far as agent environment allowed; Docker/Supabase remotes/GH deploy noted as remaining)_.
- [x] Document local startup, testing, environment selection, secret setup, staging deploy, production recovery/rollback, and common failures.
- [x] Keep `ENVIRONMENTS.md` synchronized with real project/environment names (no secret values). _(Supabase region/refs pending)_
- [ ] Run every required local/CI-equivalent check and record actual results. _(see Verification log; some blocked)_
- [ ] Inspect the complete diff and conduct an independent security/configuration review. _(pending PR + review)_
- [ ] Demonstrate all Milestone 0 acceptance criteria from `PROJECT_PLAN.md`, including separate development, staging, and production resources. _(Supabase remotes + protected deploy evidence incomplete)_

## Explicitly not in this milestone

No `packages/domain`, route domain models, product database tables, product API resource schemas, full error taxonomy, validation-library product usage, authentication UI/product UX, planner UI, routing calls, provider integrations, scoring, persistence features, GPX behavior, or Xcode project.

## Remaining user actions (block Milestone 0 complete)

1. **Re-authenticate GitHub CLI** (`gh auth login`) — agent tokens invalid; needed to open/verify PR checks and trigger protected deploys.
2. **Approve Supabase region + cost** to create `ridevector-development`, then staging, then production (proposed: `us-west-1`); then record region + non-secret refs in `ENVIRONMENTS.md`.
3. **Ensure Docker is usable** for `supabase start` / `db reset` / `status` on a developer machine; record outcomes.
4. **Merge completion PR to `main`**, then confirm staging protected workflow + `/api/health` smoke.
5. **Explicitly approve** GitHub Environment production deployment (do not bypass reviewer gate); confirm production health smoke.
6. **Independent security/configuration review** of the PR diff.

## Verification log (agent session 2026-08-26)

| Check | Command / action | Outcome |
| --- | --- | --- |
| Sync main | `git pull` → `833d25b` | Pass |
| Branch | `milestone-0/completion` | Created |
| Supabase CLI pin | Official latest stable **2.115.0** vs old **2.34.3** | Updated in `mise.toml` (contributor `mise install`); workspace binary verified `--version` → 2.115.0 |
| `supabase db diff --help` / advisors / gen types | Via 2.115.0 binary | Help verified (telemetry write needs non-sandbox or `HOME` writable) |
| Docker / `supabase start` | | **Blocked** — Docker daemon not running / socket unavailable to agent |
| `supabase projects list` | | **Blocked** — no login / access token; **do not create remotes without region approval** |
| Wrangler pin | npm latest **4.126.0** | Updated; types generated |
| `pnpm run check` | format, lint, typecheck, test, build, env-isolation (+ fixtures), client-bundle secrets, wrangler types | **Pass** |
| Local Worker health | `wrangler dev` (no `--env`) + `GET /api/health` | **Pass** `{"status":"ok","service":"ridevector-api"}` (`ENVIRONMENT=local`) |
| `gh` API / Actions | | **Blocked** — invalid GH token in keyring (needs `gh auth login`) |
| Staging/production Worker HTTP from agent | `curl …/api/health` | **403** from this environment (cannot confirm live Workers here) |
| Staging protected workflow verify | | Pending merge to `main` + GH auth |
| Production deploy | | **Not run** — requires explicit Environment approval |

### Staging deploy failure diagnosis (prior workflows)

Previous `deploy-staging.yml` used `actions/checkout@v4`, no quality gate, and no post-deploy health smoke. Failures in that shape commonly come from missing `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` Environment secrets, outdated action versions, or deploying without verifying `pnpm run check`. The replacement workflow checks out `main`, runs full `pnpm run check` + gitleaks, deploys with explicit `--env staging`, and smokes `/api/health`.
