# Environments

Canonical environment documentation for RideVector. Prefer this file and `DECISIONS.md` over `RIDEVECTOR_HANDOFF.md`.

## Taxonomy

| Canonical name | Kind | Creation order | Default target? |
| --- | --- | --- | --- |
| `local` | Developer machine + local emulators/CLIs | 1 | Yes for day-to-day local commands |
| `development` | First remote non-production environment | 2 | Never for remote Cloudflare deploys (must be explicit); may be the documented default only for non-deploy remote helper scripts that cannot imply production |
| `staging` | Pre-production remote environment | 3 | Never implicit; select explicitly |
| `production` | Live remote environment | 4 | Never implicit; always explicit and protected |

Milestone 0 (ADR-016) requires verified local Supabase, one live remote Supabase project (`ridevector-development`), and Cloudflare Workers for development/staging/production with isolation demonstrated. Live Supabase projects `ridevector-staging` and `ridevector-production` are **deferred** to a later deployment-readiness milestone (cost). Staging/production Supabase **names**, config placeholders, GitHub Environment guards, and secret conventions must still be complete in Milestone 0. Create live Supabase remotes only in order **local → development** during Milestone 0; do not create staging/production Supabase remotes yet.

## Platform name mapping

| Canonical | GitHub Actions Environment | Cloudflare Worker name | Wrangler env key | Supabase project name | Committed example config | Real secrets / env files |
| --- | --- | --- | --- | --- | --- | --- |
| `local` | _(none; local only)_ | _(local Wrangler session only)_ | base config / `wrangler dev` (no `--env`) | Supabase local stack (`ridevector-local`) | `.env.example`, `apps/api/.dev.vars.example` | `.env`, `.env.local`, `.dev.vars` (gitignored) |
| `development` | `development` | `ridevector-api-development` | `development` | `ridevector-development` | `.env.development.example` | GitHub `development` secrets; Cloudflare development secrets; Supabase development project secrets |
| `staging` | `staging` | `ridevector-api-staging` | `staging` | `ridevector-staging` | `.env.staging.example` | GitHub `staging` secrets; Cloudflare staging secrets; Supabase staging project secrets |
| `production` | `production` | `ridevector-api-production` | `production` | `ridevector-production` | `.env.production.example` | GitHub `production` secrets; Cloudflare production secrets; Supabase production project secrets |

### Cloudflare

- Base Wrangler configuration / Worker service name: `ridevector-api`.
- Per-environment Worker names: `ridevector-api-development`, `ridevector-api-staging`, `ridevector-api-production`.
- Every remote deployment must specify an environment explicitly (`development`, `staging`, or `production`). No remote deploy command may omit the environment or default to production.
- Local API: `pnpm --filter @ridevector/api dev` → `wrangler dev` against **base** config (`ENVIRONMENT=local`). Do **not** pass `--env development` for ordinary local work.
- Remote deploy scripts only: `deploy:development`, `deploy:staging`, `deploy:production`.
- Workers deployed (Milestone 0):
  - development: `https://ridevector-api-development.jmondragontech.workers.dev`
  - staging: `https://ridevector-api-staging.jmondragontech.workers.dev`
  - production: `https://ridevector-api-production.jmondragontech.workers.dev`
- Smoke health path: `GET /api/health`
- Binding types: generated with `pnpm --filter @ridevector/api run types` → `apps/api/worker-configuration.d.ts` (CI checks freshness).

### Supabase

- Project names (ADR-015): `ridevector-development`, `ridevector-staging`, `ridevector-production`.
- Approved region for all RideVector Supabase remotes: **`us-west-1` (West US / North California)** (ADR-016).
- **Live in Milestone 0:** `ridevector-development` only (Free/Nano). Staging and production Supabase projects are named and guarded in config but **not created** yet (cost deferral).
- Non-secret project refs / API URLs:
  - `ridevector-development`: ref `hsokwavqmqlkbtnftoqw`; public URL `https://hsokwavqmqlkbtnftoqw.supabase.co` (never commit secrets)
  - `ridevector-staging` / `ridevector-production`: _not created — no live refs or credentials_
- Local stack: `supabase start` with Docker; see `supabase/README.md`. Verified on developer Docker: `start` / `status` / `db reset`.
- Wrangler `vars.SUPABASE_URL`: development uses the live development public URL; staging/production keep `REPLACE_ME_*_REF` placeholders until those remotes exist. Isolation checks forbid production (and deferred staging live) identifiers in development/local config.

### GitHub Actions Environments

| Environment | Required reviewers | Deployment branches | Notes |
| --- | --- | --- | --- |
| `development` | None | Unrestricted beyond normal workflow design (CI may deploy development from allowed workflows) | No approval gate |
| `staging` | None initially | **Only `main`** | No reviewer gate initially; branch restriction required |
| `production` | **`jmondragontech2023`** | **Only `main`** | Explicit approval required; production always explicit |

Do **not** enable prevent-self-review while `jmondragontech2023` is the only authorized production reviewer.

Notes:

- Canonical names are lowercase and identical across docs, scripts, and CI inputs unless a platform API forces a different key; if so, map it here explicitly rather than inventing aliases ad hoc.
- Client publishable URLs/keys are environment-specific. Service-role and other privileged secrets never enter web or iOS bundles.
- Non-production builds and config must fail closed if they resolve production project IDs, hosts, routes, Worker names (`ridevector-api-production`), or credentials.
- No default deploy command may target `production`. Production deploys require explicit environment selection plus GitHub Environment protection.

## Secrets policy

Platform-native secrets only (ADR-009):

- GitHub Actions repository and Environment secrets
- Cloudflare Workers / Wrangler secrets per environment
- Supabase project-native secret mechanisms

Do not commit secret values. Document ownership and rotation without recording values. Example files contain placeholders only.

## Safe defaults

1. Local commands default to `local` (`wrangler dev` without `--env`; Supabase local stack).
2. Every remote Cloudflare deployment must pass an explicit environment (`development`, `staging`, or `production`).
3. Staging and production are always explicit; production additionally requires GitHub Environment approval by `jmondragontech2023`.
4. CI pull-request jobs use mocks/fixtures and must not require production credentials.
5. Staging and production deploy workflows may run only from `main`.

## Deploy workflows

- **Staging:** `.github/workflows/deploy-staging.yml` — on push to `main` (path-filtered) or `workflow_dispatch`; runs full `pnpm run check` + gitleaks; deploys with `environment: staging`; post-deploy `GET /api/health` smoke.
- **Production:** `.github/workflows/deploy-production.yml` — `workflow_dispatch` only; checks out `main`; runs full quality gate; deploys with `environment: production` (reviewer gate); post-deploy health smoke.

### Rollback / forward-fix (Cloudflare Worker)

Verified command shapes (run only with credentials for the intended env):

```bash
# List recent deployments for the staging Worker
pnpm --filter @ridevector/api exec wrangler deployments list --env staging

# Roll forward: redeploy known-good commit from main after revert/fix PR merge
pnpm --filter @ridevector/api run deploy:staging

# Production equivalent (requires GitHub Environment approval when done via Actions)
pnpm --filter @ridevector/api run deploy:production
```

Prefer forward-fix via a revert or fix PR to `main`, then the protected deploy workflow. Do not bypass the production reviewer gate.

## Milestone 0 verification expectations

- `.gitignore` covers real env and secret files.
- Automated assertion: non-production config cannot reference production identifiers, including `ridevector-api-production` and `ridevector-production` (see `scripts/check-env-isolation.mjs` + negative fixtures). Development/local config also must not resolve deferred live staging Supabase identifiers (`ridevector-staging` as a live host/ref).
- Client bundle/secret scan: `scripts/check-client-bundle-secrets.mjs`.
- Local Supabase verified (`supabase start` / `status` / `db reset`).
- Live remote Supabase in Milestone 0: **`ridevector-development` only** in **`us-west-1`** (ref `hsokwavqmqlkbtnftoqw`). Staging/production Supabase projects are named but not created yet; GitHub `staging`/`production` Environments have no live Supabase secrets.
- Cloudflare Workers `ridevector-api-development`, `ridevector-api-staging`, and `ridevector-api-production` exist under base config `ridevector-api`.
- GitHub Environments match the protection table above.
- Setup docs record the mapping table, chosen Supabase region, and commands actually verified.
