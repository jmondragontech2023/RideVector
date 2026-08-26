# RideVector

RideVector is an intelligent bicycle-ride generator. A rider describes the distance or time available, required stops, preferred surfaces, elevation, traffic tolerance, and departure constraints; RideVector generates several distinct, explainable rides.

The initial product flow is **Plan → Generate → Compare → Save → Export**. RideVector complements recording and navigation products rather than replacing them. Route-generation quality is the product priority.

## Repository status

Milestone 0 decisions are accepted and recorded in `DECISIONS.md` (through ADR-015) and `ENVIRONMENTS.md`. Scaffolding has not started; the repo still contains documentation and agent rules only until the final ordered Milestone 0 execution plan receives explicit approval.

Git is initialized on `main` with `origin` set to the GitHub repository. There are no commits yet; all project files are untracked; no `.gitignore` exists yet. The first commit will be documentation-only, then `main` will be protected and further work will use pull requests.

Approved Milestone 0 layout:

```text
apps/web
apps/api
ios/          # toolchain placeholder only in M0
supabase/
contracts/    # OpenAPI 3.1 health/smoke only in M0
```

No `packages/domain` until Milestone 1.

Intended stack:

- Web: React and TypeScript (`apps/web`)
- API: Cloudflare Workers (`apps/api`)
- Tooling: pnpm workspace (root scripts, no Turbo/Nx), Node 24.19.0 via mise, pnpm 11 (exact patch pinned at scaffold)
- iOS: Swift/SwiftUI later; Milestone 0 verifies toolchain only
- Data and authentication: Supabase/PostgreSQL (declarative schemas + generated reviewed migrations)
- Contracts: OpenAPI 3.1
- Routing (later): separately hosted Valhalla/OSM
- Traffic and weather: provider-neutral integrations; initial traffic candidate is TomTom

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

`RIDEVECTOR_HANDOFF.md` is historical planning input only. It must not be treated as architecture, API, schema, or stack authority after the permanent documents exist.

## Developer setup

There is no runnable project yet. After execution-plan approval, Milestone 0 will add `.gitignore`, the documentation-only first commit, protected `main`, then smoke scaffolds and environment isolation. Do not invent setup commands before that scaffold exists.

Never place secrets in committed files. Use platform-native secrets only. Development, staging, and production must use separate Supabase projects and Cloudflare environments before Milestone 0 is complete. Production must always be an explicit protected target. See `ENVIRONMENTS.md`.

## Working agreement

Work one approved milestone at a time. Read the relevant permanent documents, inspect the repository, propose a bounded plan, obtain review where required, implement with tests, run every claimed check, inspect the diff, and update documentation. Milestone 0 implementation awaits final approval of the ordered execution plan; do not install, scaffold, create cloud resources, commit, or push during planning-only steps.
