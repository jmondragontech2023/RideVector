# Test plan

## Quality policy

Tests protect domain correctness, security boundaries, environment isolation, provider contracts, and geographic route quality. CI uses deterministic fixtures and mocks; live-provider checks run separately with explicit non-production credentials. A passing claim requires an actually executed command.

Prefer permanent documents named in `README.md` over `RIDEVECTOR_HANDOFF.md`.

## Milestone 0 gates

- Formatting, lint, strict type checks, unit tests, and builds for every created workspace.
- Repository `.gitignore` and secret-ignore conventions exist before scaffold secrets or env files are introduced.
- Secret-scan baseline fails on committed secrets and verifies ignored secret paths; client-bundle inspection prevents privileged credentials from shipping.
- Configuration tests prove development/staging cannot resolve production Supabase IDs/URLs, Cloudflare routes/bindings, or secrets per `ENVIRONMENTS.md`.
- Separate development, staging, and production resources are part of Milestone 0 definition of done; create in order local → development → staging → production; isolation checks cover all three remote environments once they exist.
- Production deployment is protected, explicit, and depends on all required checks.
- Setup commands are verified from a clean checkout/environment as practical.

## Unit tests

Priorities from Milestone 1 onward:

- Request validation and normalization, coordinate/timezone boundaries, and invalid combinations.
- Distance min/target/max tolerance and unit conversions.
- Preferred/max duration, deadline safety buffer, daylight-saving transitions, and finish estimates.
- Surface partition percentages, unknown/missing metadata, and numeric tolerances.
- Rider-speed segment aggregation and fallback behavior.
- Score factor normalization, weights, monotonicity, missing inputs, deterministic tie-breaking, and explanations.
- Near-duplicate detection and personality diversity selection.
- Authorization helpers and safe error mapping.

Property-based tests are appropriate for range invariants, percentage partitions, ordering, and scoring monotonicity after the chosen toolchain supports them.

## Integration and contract tests

- Worker request/auth/validation/error contracts.
- Worker ↔ Supabase persistence and transaction/failure behavior against a disposable local/test database.
- RLS for anonymous, owner, different user, ownership reassignment, and privileged backend paths.
- Worker ↔ routing adapter with recorded/synthetic fixtures plus separately scheduled live Valhalla smoke tests.
- Traffic/weather adapter mapping, timeouts, partial results, retries, quotas, and malformed payloads.
- API schema compatibility and generated TypeScript/Swift model conformance once selected.
- GPX schema/semantic validation in Milestone 10.

External APIs are mocked in ordinary CI. Recorded fixtures must be license-safe, scrubbed of secrets/personal data, versioned, and deliberately refreshable.

## Geographic route-quality regression suite

Maintain stable, documented test regions for urban, suburban, mountain, road/gravel, mostly gravel, ordered-waypoint, short time-constrained, and long-distance loops. Prefer synthetic/public landmarks rather than a contributor's home.

For each fixture, record request, routing graph/config version, expected hard invariants, acceptable metric bands, forbidden conditions, minimum alternative count where feasible, and diversity threshold. Avoid brittle equality to an entire provider polyline. Baseline changes require reviewed evidence, not automatic snapshot replacement.

## Security tests

- Cross-user/BOLA attempts for every user-owned resource and opaque ID.
- Invalid/expired sessions, token handling, rate limits, body/waypoint limits, and injection/malformed geometry.
- RLS/grant/view/function audits and database advisors.
- No service-role, database, traffic/weather, or signing secret in web/iOS bundles, logs, test artifacts, or errors.
- Precise coordinates and integration tokens follow redaction and retention policy.
- Dependency and configuration scanning with pinned dependencies/lockfiles.
- Git-ignore and secret-scan baseline from Milestone 0 onward.

## Performance and resilience

Measure end-to-end generation and stages: routing, enrichment providers, scoring/persistence, candidates generated/rejected, and rejection reasons. Product targets are preferred under 5 seconds and acceptable MVP under 10 seconds, but load/concurrency budgets require Milestone 2 measurement.

Test upstream timeout, rate limit, partial failure, stale data, disconnected routing, no valid candidates, cancellation, and safe retries/idempotency. Do not run load tests against third-party production APIs without approval.

## Client tests

React: component/interaction accessibility, contract adapters, map presentation boundaries, loading/error/empty states, and end-to-end critical flow. SwiftUI: model decoding, state/view-model behavior, map adapters, accessibility, and UI tests for the supported critical flow. Shared behavioral fixtures should keep client semantics aligned.

## Release evidence

Each milestone records commands and results, environment used, skipped checks with reason, known limitations, migration/deployment evidence when applicable, and final diff/review findings. Production release requires smoke checks and a documented rollback or forward-fix path.
