# RideVector

RideVector is an intelligent bicycle-ride generator. A rider describes the distance or time available, required stops, preferred surfaces, elevation, traffic tolerance, and departure constraints; RideVector generates several distinct, explainable rides.

The initial product flow is **Plan → Generate → Compare → Save → Export**. RideVector complements recording and navigation products rather than replacing them. Route-generation quality is the product priority.

## Repository status

Milestone 0 scaffold is in progress on the approved layout. Permanent documentation and decisions live in the files below. Application behavior is limited to empty/smoke packages and a health contract.

GitHub remote: `https://github.com/jmondragontech2023/RideVector.git`

Approved Milestone 0 layout:

```text
apps/web
apps/api
ios/          # toolchain placeholder only in M0
supabase/
contracts/    # OpenAPI 3.1 health/smoke only in M0
```

No `packages/domain` until Milestone 1.

## Toolchain

- Node.js **24.19.0** and pnpm **11.24.0** via [mise](https://mise.jdx.dev/) (`mise.toml`)
- pnpm workspace with root scripts (no Turbo/Nx)

```bash
curl -fsSL https://mise.run | sh
cd RideVector
mise install
pnpm install
pnpm run check
```

Verified locally during Milestone 0 scaffold: `pnpm run check` (format, lint, typecheck, test, build, env-isolation).

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

`RIDEVECTOR_HANDOFF.md` is historical planning input only.

## Environments and secrets

Never place secrets in committed files. Use platform-native secrets only. See [ENVIRONMENTS.md](ENVIRONMENTS.md).

- Cloudflare base Worker: `ridevector-api` → `ridevector-api-{development,staging,production}`
- Supabase projects: `ridevector-{development,staging,production}` (same region)
- Every remote Cloudflare deploy must pass an explicit `--env`
- Production deploys only from `main` with GitHub Environment approval by `jmondragontech2023`

## Working agreement

Work one approved milestone at a time. Keep `TASKS.md` limited to Milestone 0 until acceptance criteria are met.
