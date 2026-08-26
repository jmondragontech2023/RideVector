# RideVector agent instructions

These instructions apply to the entire repository. More-specific `AGENTS.md` files may narrow them later but must not weaken security boundaries.

Prefer the permanent source-of-truth documents named in `README.md` over `RIDEVECTOR_HANDOFF.md`. The handoff is historical planning input only and is not authoritative when it conflicts with permanent documents.

## Before changing code

1. Read `README.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `ENVIRONMENTS.md`, and the documents relevant to the task.
2. Read `PROJECT_PLAN.md` and confirm the active milestone in `TASKS.md`.
3. Inspect existing code, configuration, tests, migrations, and current changes.
4. Identify conflicts between code and documentation explicitly; do not silently pick one.
5. For non-trivial implementation, propose a milestone-scoped plan and wait for requested approval.

## Change discipline

- Implement one milestone or clearly bounded feature at a time.
- Make the smallest coherent change and preserve unrelated work.
- Prefer established abstractions and patterns; do not invent APIs, tables, bindings, environment variables, or package behavior when authoritative sources can answer.
- Keep domain models independent of map SDKs and external provider payloads.
- Put traffic, weather, geocoding, maps, and routing integrations behind internal interfaces.
- Centralize configurable speed, scoring, tolerance, and deadline-buffer values.
- Add or update tests and documentation whenever behavior or architecture changes.
- Never rewrite an applied database migration; add a new migration. Milestone 0 uses declarative schemas with generated reviewed migrations.
- Do not create `packages/domain` until Milestone 1.

## Security and privacy

- Treat React and iOS clients as untrusted.
- Enforce authentication and authorization at the Worker and database boundaries.
- Authentication product UX is undecided; Milestone 0 may establish session-validation wiring only. User-owned APIs must validate sessions before they are implemented.
- Enable and test RLS for all user-owned or exposed Supabase data.
- Never expose Supabase service-role/secret keys, database credentials, provider secrets, or signing secrets to clients.
- Keep development, staging, and production resources and secrets isolated; use platform-native secrets only; production must always be explicit.
- Avoid logging precise route locations, tokens, provider payloads containing personal data, or other sensitive data unless explicitly required and protected.

## Verification

- Run applicable unit/integration tests, lint, type checks, and builds.
- Never claim a check passed unless it was actually run; report skipped or unavailable checks.
- Inspect the final diff for accidental generated files, secrets, unrelated edits, and documentation drift.
- Route-generation changes require geographic regression coverage when the test foundation exists.

## Current repository phase

Milestone 0 decisions are accepted (`DECISIONS.md` ADR-006–ADR-016, `ENVIRONMENTS.md`). Milestone 0 implementation is authorized per the approved execution plan and ADR-016 Supabase scope. Keep `TASKS.md` limited to Milestone 0 until acceptance criteria are met. Prefer pull requests to protected `main`. First commit was documentation-only.
