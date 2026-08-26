# RideVector agent instructions

These instructions apply to the entire repository. More-specific `AGENTS.md` files may narrow them later but must not weaken security boundaries.

Prefer the permanent source-of-truth documents named in `README.md` over `RIDEVECTOR_HANDOFF.md`. The handoff is historical planning input only and is not authoritative when it conflicts with permanent documents.

## Before changing code

1. Read `README.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `ENVIRONMENTS.md`, and the documents relevant to the task.
2. Read `PROJECT_PLAN.md` and confirm the active milestone in `TASKS.md`.
3. Inspect existing code, configuration, tests, migrations, and current changes.
4. Identify conflicts between code and documentation explicitly; do not silently pick one.
5. For non-trivial implementation, propose a milestone-scoped plan and wait for requested approval. **Exception:** the route-generation POC on `poc/route-generation` is already approved end-to-end by ADR-017 and `poc/README.md`. Implement its ordered tasks without intermediate approval stops, then stop once all POC acceptance checks and the final review handoff are prepared.

## Change discipline

- Implement one milestone or clearly bounded feature at a time.
- Make the smallest coherent change and preserve unrelated work.
- Prefer established abstractions and patterns; do not invent APIs, tables, bindings, environment variables, or package behavior when authoritative sources can answer.
- Keep domain models independent of map SDKs and external provider payloads.
- Put traffic, weather, geocoding, maps, and routing integrations behind internal interfaces.
- Centralize configurable speed, scoring, tolerance, and deadline-buffer values.
- Add or update tests and documentation whenever behavior or architecture changes.
- Never rewrite an applied database migration; add a new migration. Milestone 0 uses declarative schemas with generated reviewed migrations.
- Do not create `packages/domain` during the route-generation POC. Milestone 1 remains the point where the production shared domain package is introduced.

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

Milestone 0 is merged. The active phase is the time-boxed local route-generation POC defined in `poc/README.md`, `PROJECT_PLAN.md`, `TASKS.md`, and ADR-017. The POC reuses `apps/web` and `apps/api`; it does not create a parallel application under `poc/`. Existing production decisions remain accepted unless ADR-017 explicitly grants a local-POC exception. Prefer pull requests to protected `main`.

Execute POC-1 through POC-3 continuously. Do not pause for routine design choices, dependency selection, or approval between slices: use the fixed choices and defaults in `poc/README.md`. Pause only for missing credentials/access that cannot be replaced safely, a conflict with a security boundary, or a destructive/external action outside the approved local POC. Keep implementation commits reviewable, but request user review only after the complete POC is implemented and verified.
