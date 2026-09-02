# RideVector

RideVector is an intelligent bicycle-ride generator. A rider describes the distance or time available, required stops, preferred surfaces, elevation, traffic tolerance, and departure constraints; RideVector generates several distinct, explainable rides.

The initial product flow is **Plan → Generate → Compare → Save → Export**. RideVector complements recording and navigation products rather than replacing them. Route-generation quality is the product priority.

## Repository status

Milestone 0 is merged. The active branch is `poc/route-generation`, a local-only experiment intended to get real bicycle-loop generation in front of the owner quickly. The experiment is specified in [`poc/README.md`](poc/README.md) and ADR-017. It preserves the production roadmap while temporarily bypassing persistence, authentication, deployment, iOS, and advanced ranking.

GitHub remote: `https://github.com/jmondragontech2023/RideVector.git`

Approved Milestone 0 layout:

```text
apps/web
apps/api
ios/          # toolchain placeholder only in M0
supabase/
contracts/    # OpenAPI 3.1 health/smoke only in M0
```

The POC reuses `apps/web` and `apps/api`; it does not create a second application under `poc/`. No `packages/domain` is created until Milestone 1.

## Prerequisites

- [mise](https://mise.jdx.dev/) (toolchain)
- macOS/Linux shell; pnpm via mise (do not rely on a global floating pnpm)
- Network access to the configured Valhalla routing endpoint (POC defaults to a public hosted demo)
- Docker-compatible runtime for local Supabase only (optional; not required for route-generation POC)

## Toolchain

- Node.js **24.19.0** and pnpm **11.24.0** via mise (`mise.toml`)
- Supabase CLI **2.115.0** via mise
- Wrangler **4.126.0** (pinned in `apps/api`)
- pnpm workspace with root scripts (no Turbo/Nx)

```bash
curl -fsSL https://mise.run | sh
cd RideVector
mise install
pnpm install
pnpm run check
```

`pnpm run check` runs format, lint, typecheck, unit tests, builds, structured env-isolation (+ negative fixtures), client-bundle secret scan, and Wrangler binding-type freshness.

## Local development (verified commands)

### Route-generation POC (no local Valhalla Docker)

The POC Worker calls a **configurable Valhalla-compatible endpoint** through an internal adapter. The web app talks only to the RideVector API.

During the POC phase, local development defaults to the public hosted demo at `https://valhalla1.openstreetmap.de`. This is temporary infrastructure so low-memory machines can validate routing without building OSM tiles locally. Override with `VALHALLA_BASE_URL` in `apps/api/.dev.vars` when pointing at self-hosted Valhalla later.

```bash
mise install
pnpm install
pnpm dev
```

That starts the local Worker (`http://127.0.0.1:8787`) and web app (`http://localhost:5173`) in parallel.

#### Phone / LAN testing (“Use my location”)

Browsers only allow the Geolocation API on **HTTPS** or **localhost**. Opening the planner as plain `http://192.168.x.x:5173` on a phone will fail with a secure-origin error.

For same-Wi‑Fi / Tailscale phone tests (HTTPS only):

```bash
pnpm run dev:mobile
```

1. On your computer, note the Vite **Network** URL that starts with `https://` (LAN IP + port).
2. Open that URL on the phone (same Wi‑Fi / Tailscale as the computer).
3. Accept the self-signed certificate warning once (Advanced → proceed / visit anyway).
4. Tap **Use my location** and allow location permission when prompted.
5. Generate routes as usual; `/api` still proxies to the local Worker.

Desktop testing can stay on `pnpm dev` and `http://localhost:5173` — localhost already counts as a secure context for geolocation.

To run **HTTP and HTTPS at the same time** (one Worker, two Vite processes):

```bash
pnpm run dev:both
```

- Desktop: `http://localhost:5173`
- Phone / Tailscale: `https://<lan-or-tailscale-ip>:5174` (accept the self-signed cert once)

A single Vite process cannot serve both protocols; `dev:both` starts HTTP on **5173** and HTTPS on **5174**, both proxying `/api` to the Worker on **8787**.

Smoke the routing spike:

```bash
curl -s http://127.0.0.1:8787/api/health
curl -s http://127.0.0.1:8787/api/poc/routes/route \
  -H 'content-type: application/json' \
  -d '{"start":{"lat":33.0,"lon":-117.0},"destination":{"lat":33.1,"lon":-117.1}}'
```

Loop and start-to-end generation (map UI) uses `POST /api/poc/routes/generate`. Both POC routes are available only when `ENVIRONMENT=local`. Start-and-end mode is the ADR-020 Phase 1 extension; ordered stops and return routing are not implemented yet.

Optional overrides:

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars
# VALHALLA_BASE_URL=https://valhalla1.openstreetmap.de
# Optional motor-traffic enrichment (TomTom Flow Segment Data):
# TOMTOM_API_KEY=replace-with-local-tomtom-key
```

Experimental scoring/enrichment (distance fit, loop quality, diversity, elevation, traffic, weather) is documented in [`poc/SCORING_AND_ENRICHMENT.md`](poc/SCORING_AND_ENRICHMENT.md). Provider keys stay Worker-side; the browser never receives provider URLs, payloads, or credentials.

#### Garmin GPX field-test export (POC-4)

After generating (or reopening a locally saved) route:

1. Open the **Details** tab for the selected accepted alternative.
2. Click **Export to Garmin** (or **Download GPX**) — client-side only, no API endpoint and no direct Garmin sync.
3. In Garmin Connect: **Training & Planning → Courses → Import**, then sync the course to a compatible Garmin device.
4. Record results in [`poc/EVALUATION.md`](poc/EVALUATION.md).

Current POC GPX limitations: no elevation, timestamps, course points, guaranteed turn prompts, or direct Garmin/Strava account publishing. The file is a planned track of the exact selected geometry. Filenames use start area + distance + seed (for example `RideVector-Encinitas-12.0mi-seed-42.gpx`); start area comes from reverse geocoding or the loaded fixture label, with `Local` as fallback.

POC docs: [`poc/README.md`](poc/README.md). Owner evaluation worksheet: [`poc/EVALUATION.md`](poc/EVALUATION.md) (results remain pending until the owner fills them). Scoring experiment: [`poc/SCORING_AND_ENRICHMENT.md`](poc/SCORING_AND_ENRICHMENT.md).

### Other local commands

```bash
# Web smoke / POC planner
pnpm --filter @ridevector/web dev

# API Worker — base local config (ENVIRONMENT=local). Do NOT use --env development for ordinary local work.
pnpm --filter @ridevector/api dev
# then: curl -s http://127.0.0.1:8787/api/health

# Regenerate Worker Env types after wrangler.jsonc changes
pnpm --filter @ridevector/api run types

# Local Supabase (Docker required)
supabase start
supabase status
supabase db reset
supabase stop
```

Remote deploys are always explicit:

```bash
pnpm --filter @ridevector/api run deploy:development
pnpm --filter @ridevector/api run deploy:staging
pnpm --filter @ridevector/api run deploy:production   # prefer GitHub Actions + Environment approval
```

Staging deploys from `main` via `.github/workflows/deploy-staging.yml`. Production is manual `workflow_dispatch` on `.github/workflows/deploy-production.yml` with GitHub Environment approval by `jmondragontech2023`.

See [ENVIRONMENTS.md](ENVIRONMENTS.md) for rollback/forward-fix, isolation rules, and Supabase region (`us-west-1`).

## Source-of-truth documents

Use these permanent documents as shared memory. Prefer them over `RIDEVECTOR_HANDOFF.md` whenever the handoff conflicts or is less specific.

- [ARCHITECTURE.md](ARCHITECTURE.md): system boundaries and dependency direction
- [ENVIRONMENTS.md](ENVIRONMENTS.md): environment taxonomy and platform name mapping
- [PROJECT_PLAN.md](PROJECT_PLAN.md): milestones and acceptance criteria
- [TASKS.md](TASKS.md): actionable work for the current milestone only
- [DATABASE.md](DATABASE.md): planned data ownership, schema, and RLS model
- [API.md](API.md): API conventions and conceptual contracts
- [ROUTING.md](ROUTING.md): route pipeline, constraints, scoring, and personalities
- [TEST_PLAN.md](TEST_PLAN.md): verification strategy
- [DECISIONS.md](DECISIONS.md): accepted, proposed, and deferred decisions
- [AGENTS.md](AGENTS.md): repository-wide contributor instructions
- [poc/README.md](poc/README.md): time-boxed route-generation POC scope, sequence, and guardrails
- [poc/SCORING_AND_ENRICHMENT.md](poc/SCORING_AND_ENRICHMENT.md): provisional POC scoring and enrichment experiment
- [poc/EVALUATION.md](poc/EVALUATION.md): owner field-test worksheet (results pending)
- [supabase/README.md](supabase/README.md): declarative schema / local Supabase workflow

`RIDEVECTOR_HANDOFF.md` is historical planning input only.

## Environments and secrets

Never place secrets in committed files. Use platform-native secrets only. See [ENVIRONMENTS.md](ENVIRONMENTS.md).

- Cloudflare base Worker: `ridevector-api` → `ridevector-api-{development,staging,production}`
- Supabase: live `ridevector-development` in **`us-west-1`** (ref `hsokwavqmqlkbtnftoqw`; ADR-016); `ridevector-staging` / `ridevector-production` named but not created yet
- Every remote Cloudflare deploy must pass an explicit `--env`
- Production deploys only from `main` with GitHub Environment approval by `jmondragontech2023`

## Working agreement

Work one bounded POC slice at a time in the order recorded in `TASKS.md`. POC shortcuts do not silently supersede the production decisions or Milestones 1–11.

## Common failures

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `supabase start` fails | Docker not running / socket denied | Start Docker Desktop (or compatible runtime); re-run |
| `wrangler deploy` without `--env` | Unsafe / unnamed remote deploy | Use `deploy:development\|staging\|production` only |
| Env isolation CI fails | Production marker in non-prod config | Fix config; see `scripts/check-env-isolation.mjs` |
| Binding types stale | `wrangler.jsonc` changed | `pnpm --filter @ridevector/api run types` |
| Staging health smoke 403/empty | Worker not deployed / token missing / WAF | Check Actions secrets `CLOUDFLARE_*`; redeploy from `main` |
