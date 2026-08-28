# Current tasks — Route-generation POC

## Active status

**POC scoring/enrichment + POC-4 GPX field-test export implemented on branch `poc/garmin-gpx-export`**, except owner field-test answers in `poc/EVALUATION.md` (must remain pending). Milestone 0 remains merged. ADR-017 / ADR-019 and `poc/README.md` govern the temporary POC exceptions; all prior production decisions and the Milestones 1–11 roadmap remain preserved.

## POC-0 — Pivot and baseline

- [x] Start from merged Milestone 0 `main`.
- [x] Create branch `poc/route-generation`.
- [x] Preserve the production roadmap and record the POC as a time-boxed detour.
- [x] Run the merged Milestone 0 `pnpm run check` baseline. _(Pass 2026-08-26 using the pinned mise toolchain; Wrangler emitted a sandbox log-file warning but its dry-run build completed and the root command exited successfully.)_
- [x] Verify the local web and Worker start commands. _(Documented `pnpm dev` startup in `README.md`; defaults to public hosted `VALHALLA_BASE_URL` — no local Docker Valhalla required.)_

## POC-1 — One real loop

- [x] Add an interactive web map with attribution and a start-point selector.
- [x] Add target-distance input with one documented display-unit conversion to canonical meters.
- [x] Define the smallest provisional generate request/result types; keep map and Valhalla payloads outside them.
- [x] Add a thin routing-provider interface and one configurable Valhalla-compatible adapter in `apps/api`.
- [x] Generate one seeded anchor-based bicycle loop with explicit timeout and request limits.
- [x] Draw returned geometry and show actual distance and provider-estimated duration.
- [x] Cover input validation, provider mapping, and failure states with focused tests.

Acceptance: selecting a start and entering a distance displays one real locally generated bicycle loop.

## POC-2 — Alternatives

- [x] Generate 6–10 candidates using separated bearing families.
- [x] Enforce a centralized provisional ±20% target-distance tolerance.
- [x] Reject malformed, failed, and out-of-tolerance candidates with aggregate reason counts.
- [x] Apply a lightweight, documented directional/geometry diversity check.
- [x] Return up to three alternatives without invented personality labels.
- [x] Add route comparison cards, selection, highlighting, loading, empty, and partial-result states.

Acceptance: ordinary fixtures normally return at least two visibly distinct routes, or explain why they do not.

## POC-3 — Personal test loop

- [x] Add broad Road/Gravel costing modes with an explicit surface-accuracy disclaimer.
- [x] Add deterministic regenerate behavior using a visible/copyable seed.
- [x] Save selected candidates in browser `localStorage`; do not introduce database persistence.
- [x] Capture local generation duration, attempted/accepted counts, selection, regeneration reason, and “would ride” feedback.
- [x] Add at least five non-sensitive geographic fixtures and record evaluation findings. _(Fixtures + `poc/EVALUATION.md` template committed; owner field-test answers remain pending.)_
- [ ] Decide to continue, revise the generator, or stop before resuming the production milestones. _(Owner decision after filling `poc/EVALUATION.md`.)_

## POC-4 — Garmin GPX field-test export

- [x] Add client-side GPX 1.1 serialization from the selected accepted alternative’s provider-neutral GeoJSON LineString (`apps/web/src/poc/gpx.ts`).
- [x] Add a browser download boundary with sanitized `.gpx` filenames and reliable object-URL cleanup.
- [x] Wire **Download GPX** into selected-route actions (generated selection and reopened local saves); never export rejected-preview geometry.
- [x] Cover serialization, sanitization, invalid-geometry failure, download cleanup, and UI wiring with focused Vitest coverage.
- [x] Document the manual Garmin Connect import path and amend deferred-scope language (ADR-019).
- [ ] Owner imports an exported course into Garmin Connect, syncs to a compatible device, rides it, and records results in `poc/EVALUATION.md`.

## POC scoring and enrichment iteration

- [x] Create `poc/SCORING_AND_ENRICHMENT.md` (`poc-scoring-v1` weights, thresholds, provider limits).
- [x] Independent experimental feature toggles + presets; enrichment vs scoring separation; preference persistence.
- [x] Deterministic distance-fit, loop-quality, and diversity scoring with factual category badges.
- [x] Elevation enrichment via Valhalla `/height` + preference scoring.
- [x] Departure time + Open-Meteo weather forecast enrichment + optional weather scoring.
- [x] TomTom motor-traffic enrichment + exposure proxy scoring with coverage gates.
- [x] Combined POC fit ranking, expandable score UI, comparison panel.
- [x] Provider failure isolation; rejected candidates never enriched.
- [x] Expand `poc/EVALUATION.md` mode matrix; keep owner results pending.
- [ ] Owner completes evaluation matrix in `poc/EVALUATION.md`.

## POC guardrails

- No Supabase product schema, authentication, RLS, remote deployment, iOS, production export infrastructure, direct Garmin/Strava publishing, or production analytics.
- Manual client-side GPX download for field testing is allowed (POC-4); do not add Worker export endpoints or OAuth.
- No `packages/domain` during the POC.
- No “Best Overall,” “Quietest,” or “Adventure” labels. Use **POC fit** and “lowest estimated motor-traffic exposure.”
- Maximum 10 routing-provider calls per generation attempt; traffic enrichment ≤15 TomTom calls.
- Do not send precise personal locations to logs, fixtures, or committed files.
- Do not deploy POC feature behavior through staging or production workflows.

## Verification log (POC-4 GPX field-test export)

| Check | Command / action | Outcome |
| --- | --- | --- |
| Branch | `poc/garmin-gpx-export` from `poc/route-generation` | Pass |
| Unit / UI tests | `pnpm --filter @ridevector/web exec vitest run src/poc/gpx.test.ts src/poc/gpx-ui.test.tsx` | Pass (14) |
| Full gate | `pnpm run check` | Pass (api 83, web 126) |
| Env isolation / client secrets / wrangler types | via `pnpm run check` | Pass |
| Garmin Connect / device import | owner manual | Pending owner |
| Merge / deploy | — | Not done (owner review) |

## Verification log (scoring/enrichment iteration)

| Check | Command / action | Outcome |
| --- | --- | --- |
| Branch | `poc/route-generation` from latest `main` | Pass |
| Baseline | `pnpm run check` before changes | Pass |
| Unit / mocked tests | `pnpm -r run test` (api 81, web 69) | Pass |
| Full gate | `pnpm run check` | Pass |
| Live Valhalla generate + scoring | `POST /api/poc/routes/generate` | Pass (3 alts, `poc-scoring-v1`) |
| Live Valhalla `/height` enrichment | via Worker | Pass (`status: ok`, gain/loss present) |
| Live Open-Meteo weather enrichment | via Worker | Pass (`status: ok`) |
| Live TomTom traffic | requires `TOMTOM_API_KEY` | Skipped (key not configured) |
| BugBot | branch review + fixes | Actionable findings fixed |
| Owner field tests | `poc/EVALUATION.md` | Pending owner |
| Merge / deploy | — | Not done (owner review) |

## Verification log (POC implementation, 2026-08-26)

| Check | Command / action | Outcome |
| --- | --- | --- |
| Branch | `poc/route-generation` synced with origin | Pass |
| Unit / mocked tests | `pnpm -r run test` (api 31, web 10) | Pass |
| Full gate | `pnpm run check` | Pass |
| Local Worker health | `curl http://127.0.0.1:8787/api/health` | Pass |
| Local POC validation path | invalid POST → `VALIDATION_FAILED` | Pass |
| Public Valhalla route spike | `POST /api/poc/routes/route` via Worker → hosted Valhalla | Pass (200, geometry + distance + duration) |
| Public Valhalla loop generate | `POST /api/poc/routes/generate` (SoCal fixture, 8 km) | Pass (200, 2 alternatives accepted) |
| Direct Valhalla curl | `https://valhalla1.openstreetmap.de/route` | Pass |
| Owner field tests | `poc/EVALUATION.md` | Pending owner |
| Merge / deploy | — | Not done (owner review) |

---

# Historical Milestone 0 completion record

## Historical status

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
- [x] Create/verify Free/Nano Supabase project `ridevector-development` in **`us-west-1`**; record non-secret ref/URL in `ENVIRONMENTS.md`. Stop if paid upgrade required. Do **not** create `ridevector-staging` or `ridevector-production`. _(Created Free/Nano; ref `hsokwavqmqlkbtnftoqw`; no payment/upgrade.)_
- [x] Create/verify Cloudflare Workers `ridevector-api-development`, then `ridevector-api-staging`, then `ridevector-api-production` under base config `ridevector-api`; every remote deploy must pass an explicit environment.
- [x] Configure GitHub Environments: `development` (no reviewer); `staging` (no reviewer initially, deploy only from `main`); `production` (approval by `jmondragontech2023`, deploy only from `main`); do not enable prevent-self-review while there is only one authorized reviewer.
- [x] Configure development-only GitHub Environment values/secrets for the live development Supabase project (platform-native; no secrets in git). Do not set live staging/production Supabase credentials. _(Vars: URL/ref/region/name/status; secret: `SUPABASE_ANON_KEY` only. `SUPABASE_SERVICE_ROLE_KEY` is intentionally absent — Milestone 0 does not consume it. Staging/production Environments have no Supabase secrets.)_
- [x] Add safe example environment files; ignore all real secret files.
- [x] Make `local` / `development` the safe defaults per `ENVIRONMENTS.md`; require explicit protected production targeting. _(Ordinary API `dev` uses base local Wrangler config.)_
- [x] Add an automated assertion that non-production builds/config cannot reference production project IDs, hosts, routes, or credentials _(structured wrangler assertions + negative fixtures + client-bundle secret scan)_.
- [x] Demonstrate development cannot reference future staging/production Supabase resources (isolation evidence after development project exists). _(Live development URL wired; isolation check requires that URL and forbids deferred staging/production markers; negative fixtures green.)_

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
- [x] Verify remote development link + empty migration push (`migration list` / `db push --dry-run` / `db push` — up to date; no product tables).
- [x] Verify that no service-role/secret key can enter a client bundle. _(script + build scan; smoke app has none)_
- [x] Session-validation wiring/configuration only if needed for scaffold; no authentication product UX or user-owned product APIs. _(Inapplicable — not needed for health-only Worker; no session wiring added.)_

## 0.6 Cloudflare foundation

- [x] Verify current Workers/Wrangler configuration schema, compatibility settings, environment behavior, local secret handling, and observability defaults against `apps/api`.
- [x] Add minimal health/smoke surface aligned to the OpenAPI smoke contract; no RideVector feature logic; no user-owned resources.
- [x] Define typed binding validation; production bindings cannot be selected by default. _(generated `wrangler types`; local default is base config)_
- [x] Keep any session-validation scaffolding as configuration/wiring only. _(Inapplicable — none required for M0 health endpoint.)_

## 0.7 Documentation and acceptance

- [x] Replace provisional setup sections with commands actually run successfully on a clean checkout _(local Supabase Docker + remote development create/link/push verified)_
- [x] Document local startup, testing, environment selection, secret setup, staging deploy, production recovery/rollback, and common failures.
- [x] Keep `ENVIRONMENTS.md` synchronized with real project/environment names (no secret values). _(Development ref/URL recorded; staging/production still deferred.)_
- [x] Run every required local/CI-equivalent check and record actual results. _(`pnpm run check` Pass 2026-08-26 after development create)_
- [ ] Inspect the complete diff and conduct an independent security/configuration review. _(pending PR review stop)_
- [ ] Demonstrate all revised Milestone 0 acceptance criteria from `PROJECT_PLAN.md` / ADR-016. _(pending PR review stop + post-merge Cloudflare staging/production smoke)_

## Explicitly not in this milestone

No `packages/domain`, route domain models, product database tables, product API resource schemas, full error taxonomy, validation-library product usage, authentication UI/product UX, planner UI, routing calls, provider integrations, scoring, persistence features, GPX behavior, or Xcode project.

No live Supabase `ridevector-staging` or `ridevector-production` projects (ADR-016).

## Remaining user actions (block Milestone 0 complete)

1. **Review stop on PR #4** — do not merge until independent security/configuration review.
2. **Merge completion PR to `main` only after review stop** — then confirm staging protected Worker workflow + `/api/health` smoke (Cloudflare; no Supabase staging required).
3. **Explicitly approve** GitHub Environment production deployment when ready (do not bypass reviewer gate); confirm production health smoke.
4. Optional: set Cloudflare Worker development secrets if/when the Worker needs Supabase (M0 health endpoint does not).

## Verification log (pre-merge hardening, 2026-08-26)

| Check | Command / action | Outcome |
| --- | --- | --- |
| Branch sync | `git pull --ff-only origin milestone-0/completion` | Pass (up to date) |
| Deploy checkout immutability | quality + deploy jobs use `ref: ${{ github.sha }}` (not moving `main`) | Pass (workflows updated) |
| Action SHA pins | `actions/checkout@8e8c483…` (v6.0.1), `jdx/mise-action@bfb9fa0…` (v2.4.0), `gitleaks/gitleaks-action@e0c47f4…` (v3.0.0) | Pass |
| GitHub `development` secrets | `gh secret list --env development` | `SUPABASE_ANON_KEY` only; no `SUPABASE_SERVICE_ROLE_KEY` (intentional) |
| Docs drift | `TASKS.md` + `ENVIRONMENTS.md` no longer claim service-role GitHub secret | Pass |
| `pnpm run check` | format/lint/typecheck/test/build/env-isolation(+fixtures)/bundle/types | **Pass** |
| Merge PR #4 | **Stopped for review** | |

## Verification log (agent session 2026-08-26, continued)

| Check | Command / action | Outcome |
| --- | --- | --- |
| Branch sync | `milestone-0/completion` up to date with origin | Pass |
| Free Plan slot | Org had 1 ACTIVE + 1 INACTIVE; create omitted `--size`/`--high-availability` | Pass (no payment/upgrade) |
| Create `ridevector-development` | Free/Nano, `us-west-1`, ACTIVE_HEALTHY | Pass — ref `hsokwavqmqlkbtnftoqw` |
| Record non-secret ref/URL | `ENVIRONMENTS.md` + wrangler development `SUPABASE_URL` | Pass (no secrets committed) |
| GitHub `development` vars | `SUPABASE_URL`, `SUPABASE_PROJECT_REF`, region/name/status | Pass |
| GitHub `development` secrets | `SUPABASE_ANON_KEY` only (names only); `SUPABASE_SERVICE_ROLE_KEY` intentionally not set (M0 unused) | Pass |
| Staging/production Supabase secrets | `gh secret list --env staging\|production` | Empty (none set) |
| Link + remote DB | `supabase link`; `migration list --linked`; `db push --linked --dry-run`; `db push --linked` | Pass — up to date, no product migrations |
| Isolation evidence | Live development URL required; deferred staging/production markers forbidden | Pass |
| `pnpm run check` | format/lint/typecheck/test/build/env-isolation(+5 fixtures)/bundle/types | **Pass** |
| Staging/production Worker HTTP from agent | Earlier `curl` 403 from this environment | Unchanged |
| Production deploy | **Not run** — requires explicit Environment approval | |
| Merge PR #4 | **Stopped for review** | |

### Staging deploy failure diagnosis (prior workflows)

Previous `deploy-staging.yml` used `actions/checkout@v4`, no quality gate, and no post-deploy health smoke. Failures in that shape commonly come from missing `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` Environment secrets, outdated action versions, or deploying without verifying `pnpm run check`. The replacement workflow checks out the immutable workflow-triggering commit (`github.sha`) for both quality and deploy jobs (so Environment wait cannot pick up a newer `main`), runs full `pnpm run check` + gitleaks, deploys with explicit `--env staging`, and smokes `/api/health`.
