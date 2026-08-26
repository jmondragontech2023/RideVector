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
- Docker-compatible runtime for local Supabase
- macOS/Linux shell; pnpm via mise (do not rely on a global floating pnpm)

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

```bash
# Web smoke app
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
