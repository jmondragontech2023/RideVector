# Current tasks — Milestone 0 only

## Status

**Milestone 0 completion in progress** on branch `milestone-0/completion` (PR #4). Decisions: `DECISIONS.md` (ADR-006–ADR-016) and `ENVIRONMENTS.md`. Do **not** mark Milestone 0 complete until revised acceptance criteria in `PROJECT_PLAN.md` / ADR-016 are evidenced. Do **not** begin Milestone 1. Do **not** merge PR #4 until review stop.

## 0.1 Baseline and decisions

- [x] Approve the permanent documentation and Cursor rules as the source of truth over `RIDEVECTOR_HANDOFF.md`.
- [x] Record first-commit policy: documentation-only first commit, then protected `main` and pull-request workflow (ADR-014).
- [x] Record toolchain: Node 24.19.0 via mise, pnpm 11.24.0, pnpm workspace with root scripts, no Turbo/Nx (ADR-007).
- [x] Record layout: `apps/web`, `apps/api`, `ios`, `supabase`, `contracts`; no `packages/domain` until Milestone 1 (ADR-006).
- [x] Record CI: GitHub Actions with protected deployments (ADR-008).
- [x] Record secrets: platform-native only (ADR-009).
- [x] Record environment taxonomy and mappings in `ENVIRONMENTS.md` (ADR-010; Supabase remote liveness narrowed by ADR-016).
- [x] Record concrete remote names and deploy guards (ADR-015): Cloudflare `ridevector-api` / `ridevector-api-{development,staging,production}`; Supabase names `ridevector-{development,staging,production}` region `us-west-1`; GitHub Environment protections as in `ENVIRONMENTS.md`.
- [x] Record ADR-016: Milestone 0 Supabase scope = local + live `ridevector-development` only; staging/production Supabase deferred (cost).
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

Create live resources in order: **local → development**. Staging/production Supabase remotes are **not** created in Milestone 0 (ADR-016). Cloudflare staging/production Workers may already exist.

- [x] Apply `ENVIRONMENTS.md` mapping across GitHub, Cloudflare, Supabase naming, and client config _(Cloudflare live; Supabase staging/production names only)_.
- [x] Establish local Supabase and local Worker workflows. _(Local Worker health verified earlier; Docker `supabase start` / `status` / `db reset` verified 2026-08-26.)_
- [ ] Create/verify Free/Nano Supabase project `ridevector-development` in **`us-west-1`**; record non-secret ref/URL in `ENVIRONMENTS.md`. Stop if paid upgrade required. Do **not** create `ridevector-staging` or `ridevector-production`.
- [x] Create/verify Cloudflare Workers `ridevector-api-development`, then `ridevector-api-staging`, then `ridevector-api-production` under base config `ridevector-api`; every remote deploy must pass an explicit environment.
- [x] Configure GitHub Environments: `development` (no reviewer); `staging` (no reviewer initially, deploy only from `main`); `production` (approval by `jmondragontech2023`, deploy only from `main`); do not enable prevent-self-review while there is only one authorized reviewer.
- [ ] Configure development-only GitHub Environment values/secrets for the live development Supabase project (platform-native; no secrets in git). Do not set live staging/production Supabase credentials.
- [x] Add safe example environment files; ignore all real secret files.
- [x] Make `local` / `development` the safe defaults per `ENVIRONMENTS.md`; require explicit protected production targeting. _(Ordinary API `dev` uses base local Wrangler config.)_
- [x] Add an automated assertion that non-production builds/config cannot reference production project IDs, hosts, routes, or credentials _(structured wrangler assertions + negative fixtures + client-bundle secret scan)_.
- [ ] Demonstrate development cannot reference future staging/production Supabase resources (isolation evidence after development project exists).

## 0.4 CI and deployment safety

- [x] Configure GitHub Actions to run formatting check, lint, type checks, unit tests, and builds on pull requests.
- [x] Mock external services in CI; do not require production credentials. _(CI uses fixtures/local checks only; no production secrets required for `pnpm run check`.)_
- [x] Define staging deployment gates and smoke checks. _(workflow updated; live protected staging verify pending merge to main)_
- [x] Define production deployment as an explicit protected workflow gated on all required checks and environment approval. _(workflow updated; live production deploy requires explicit Environment approval — do not bypass)_
- [x] Add dependency/secret scanning, including baseline coverage for `.gitignore` secret paths.

## 0.5 Supabase foundation

- [x] Implement declarative-schema source plus generated reviewed migration conventions using current Supabase guidance and verified CLI behavior. _(CLI pin 2.115.0; conventions in `supabase/README.md`; no product tables)_
- [x] Add local configuration only after verifying installed CLI behavior with `--help` and current docs.
- [x] Establish migration, seed-test-data, RLS-test, type-generation, and database-advisor conventions without product tables.
- [x] Verify declarative-schema and migration workflow locally without product tables (`db reset` applied empty migration set).
- [x] Verify that no service-role/secret key can enter a client bundle. _(script + build scan; smoke app has none)_
- [x] Session-validation wiring/configuration only if needed for scaffold; no authentication product UX or user-owned product APIs. _(Inapplicable — not needed for health-only Worker; no session wiring added.)_

## 0.6 Cloudflare foundation

- [x] Verify current Workers/Wrangler configuration schema, compatibility settings, environment behavior, local secret handling, and observability defaults against `apps/api`.
- [x] Add minimal health/smoke surface aligned to the OpenAPI smoke contract; no RideVector feature logic; no user-owned resources.
- [x] Define typed binding validation; production bindings cannot be selected by default. _(generated `wrangler types`; local default is base config)_
- [x] Keep any session-validation scaffolding as configuration/wiring only. _(Inapplicable — none required for M0 health endpoint.)_

## 0.7 Documentation and acceptance

- [x] Replace provisional setup sections with commands actually run successfully on a clean checkout _(local Supabase Docker path verified; remote development create still blocked on CLI auth)_.
- [x] Document local startup, testing, environment selection, secret setup, staging deploy, production recovery/rollback, and common failures.
- [x] Keep `ENVIRONMENTS.md` synchronized with real project/environment names (no secret values). _(Region `us-west-1` recorded; development ref pending create.)_
- [ ] Run every required local/CI-equivalent check and record actual results. _(see Verification log)_
- [ ] Inspect the complete diff and conduct an independent security/configuration review. _(pending PR review stop)_
- [ ] Demonstrate all revised Milestone 0 acceptance criteria from `PROJECT_PLAN.md` / ADR-016. _(blocked on remote development create + GH development secrets)_

## Explicitly not in this milestone

No `packages/domain`, route domain models, product database tables, product API resource schemas, full error taxonomy, validation-library product usage, authentication UI/product UX, planner UI, routing calls, provider integrations, scoring, persistence features, GPX behavior, or Xcode project.

No live Supabase `ridevector-staging` or `ridevector-production` projects (ADR-016).

## Remaining user actions (block Milestone 0 complete)

1. **Provide Supabase CLI auth** for this agent session: run `supabase login` in a TTY, or set `SUPABASE_ACCESS_TOKEN` (do not paste the token into chat/git). Needed to list Free Plan slots and create `ridevector-development`.
2. After create: confirm GitHub Environment `development` secrets/vars were set (or set publishable URL / anon key via `gh secret set --env development` yourself if preferred).
3. **Merge completion PR to `main` only after review stop** — then confirm staging protected Worker workflow + `/api/health` smoke (Cloudflare; no Supabase staging required).
4. **Explicitly approve** GitHub Environment production deployment when ready (do not bypass reviewer gate); confirm production health smoke.
5. **Independent security/configuration review** of the PR diff.

## Verification log (agent session 2026-08-26, continued)

| Check | Command / action | Outcome |
| --- | --- | --- |
| Branch sync | `milestone-0/completion` tracks `origin/milestone-0/completion` @ prior tip | Pass |
| ADR-016 docs | Supersede ADR-004 / ADR-010 Supabase liveness; update ENVIRONMENTS/PROJECT_PLAN/TASKS/README/TEST_PLAN/rules | In progress |
| Supabase CLI pin | mise `2.115.0` | Pass |
| `supabase projects create --help` | Flags verified (`--region`, `--org-id`, `--size`, `--high-availability`) | Pass — Free/Nano: omit `--size` / `--high-availability` |
| Free Plan slot / create | `supabase projects list` / `create` | **Blocked** — no CLI access token in non-TTY agent (`SUPABASE_ACCESS_TOKEN` unset; `supabase login` requires TTY) |
| Docker / `supabase start` | After starting Docker Desktop | **Pass** (image pull rate-limited briefly, then started) |
| `supabase status` | Keys present (values not logged) | **Pass** |
| `supabase db reset` | Empty migration set (`.gitkeep` skipped) | **Pass** |
| MCP Supabase | Authenticated; linked to unrelated budget project — **not** used as RideVector | Do not reuse |
| `gh` / PR #4 | Open; CI `check` pass | Pass |
| Staging/production Worker HTTP from agent | Earlier `curl` 403 from this environment | Unchanged |
| Production deploy | **Not run** — requires explicit Environment approval | |

### Staging deploy failure diagnosis (prior workflows)

Previous `deploy-staging.yml` used `actions/checkout@v4`, no quality gate, and no post-deploy health smoke. Failures in that shape commonly come from missing `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` Environment secrets, outdated action versions, or deploying without verifying `pnpm run check`. The replacement workflow checks out `main`, runs full `pnpm run check` + gitleaks, deploys with explicit `--env staging`, and smokes `/api/health`.
