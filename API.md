# API contracts

## Status

This document defines API direction, not a frozen product OpenAPI contract. Milestone 0 uses **OpenAPI 3.1** under `contracts/` with a **health/smoke contract only** (ADR-012). Exact product resource schemas, validation-library usage, identifiers, pagination, and the full error taxonomy are Milestone 1 decisions.

Agents must treat this file and the other permanent documents named in `README.md` as authoritative over `RIDEVECTOR_HANDOFF.md`.

## Conventions

- HTTPS JSON API under `/api`; introduce explicit contract versioning before incompatible public changes.
- Authenticate bearer sessions at the Worker and authorize every resource by authenticated user identity.
- Authentication product UX is undecided. Milestone 0 may establish session-validation wiring or configuration only. User-owned APIs must validate sessions before they are implemented.
- Treat all client values as untrusted; validate structure, ranges, relationships, timestamps, coordinate bounds, and body size.
- Canonical numeric units are meters and seconds. Timestamps use ISO 8601/RFC 3339 with offset; responses use UTC timestamps where possible and include timezone context when wall-clock constraints require it.
- Coordinates use provider-neutral WGS84 `{ latitude, longitude }` values.
- Use stable machine-readable error codes, safe human messages, request/correlation IDs, and field-level validation details. Never expose provider secrets, SQL details, stack traces, or raw upstream responses.
- Define idempotency and retry behavior for costly mutations before production. Set explicit timeouts, bounded retries with jitter only for safe operations, and provider circuit/rate controls.

## Milestone boundaries for contracts

| Concern | Milestone |
| --- | --- |
| OpenAPI 3.1 under `contracts/`; health/smoke contract only | 0 |
| Package wiring in `apps/web` and `apps/api` against smoke contract | 0 |
| Product resource schemas and examples as contract truth | 1 |
| Validation-library usage for product requests | 1 |
| Full error taxonomy and stable public codes | 1 |
| Whether `GET /api/routes/:id` identifies a request or an alternative | 1 (open) |

## Conceptual resources

### Generate routes

`POST /api/routes/generate`

Accepts a route request with start, optional end, return-to-start, ordered required waypoints, optional distance/time constraints, surface ranges, elevation/traffic preference, and departure time. At least one meaningful distance or time constraint is expected; Milestone 1 finalizes valid combinations.

A successful response returns a request identifier and materially distinct alternatives. Each result includes personality, provider-neutral geometry, metric statistics, surface breakdown, traffic analysis when available, estimated finish, score/explanation data, warnings, and version/provenance metadata needed for interpretation.

Generation is conceptually synchronous for the MVP latency target. If measurements require asynchronous execution, replace this with a documented `202` job/status contract rather than holding requests unpredictably.

### Retrieve and list routes

- `GET /api/routes/:id` retrieves one authorized generated route or request representation. **Open Milestone 1 decision:** whether `:id` identifies a route request, a generated alternative, or another versioned resource shape.
- `GET /api/routes` lists the current user's routes with cursor pagination, deterministic ordering, bounded page size, and filters defined by the final contract.

Resource identifiers are opaque. Ownership is checked even when a valid identifier is supplied.

### Save and feedback

- `POST /api/routes/:id/save` creates an idempotent or explicitly duplicate-safe saved-route record.
- `POST /api/routes/:id/feedback` records validated lightweight feedback for a route the user may access.

Exact update/delete semantics and repeat-feedback behavior remain open.

### Preferences

- `GET /api/preferences` returns authorized rider defaults.
- `PUT /api/preferences` validates and replaces/upserts the supported preference representation with concurrency semantics defined before implementation.

## Conceptual error envelope

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The route request is invalid.",
    "requestId": "opaque-id",
    "details": [{ "field": "distance.maxMeters", "reason": "must be greater than or equal to minMeters" }]
  }
}
```

Suggested categories, subject to Milestone 1 finalization: authentication required, forbidden/resource hidden, validation failed, conflict/idempotency conflict, rate limited, upstream unavailable/timeout, generation has no valid candidates, and internal error.

## Trust and provider boundaries

Clients never submit authoritative scores, ownership, generated statistics, provider names/IDs, or generation status. Provider errors and payloads are mapped to internal result/error types. The public contract cannot depend on Valhalla, TomTom, a map SDK, or Supabase response shapes.

## Observability and privacy

Record request ID, status, aggregate timing, stage/provider class, candidate counts, rejection categories, and safe algorithm versions. Do not log tokens, raw authorization headers, full provider payloads, or precise start/end/waypoint coordinates by default. Define coordinate redaction/aggregation and retention before beta.

## Future endpoints

POC GPX download is **client-side only** in the web app and creates no API endpoint (ADR-019). Production GPX export contracts, Garmin Courses API / Strava authorization and direct publishing, and related OAuth callbacks remain later milestones. OAuth callbacks require state/PKCE as applicable, encrypted credential handling, least scopes, revocation, provider-policy review, and separate threat modeling before contracts are accepted.

## Contract workflow

When Milestone 0 proceeds, maintain OpenAPI 3.1 health/smoke under `contracts/` and wire `apps/web` / `apps/api` to it only. When product API work begins in Milestone 1, extend the machine-readable contract, derive or verify TypeScript and Swift models, add request/response schema tests, and document compatibility/deprecation rules. Examples in this file must be generated from or tested against the actual contract once product paths exist.
