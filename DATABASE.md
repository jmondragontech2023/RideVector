# Database and data security

## Status

This is a conceptual Supabase/PostgreSQL design, not an executable schema. No database project or migration workflow exists yet. Milestone 0 uses **declarative schemas as source of truth with generated migrations that are reviewed before apply** (ADR-011). Product tables are implemented only in their approved milestones.

Prefer permanent documents named in `README.md` over `RIDEVECTOR_HANDOFF.md`.

## Principles

- PostgreSQL is the durable source for application state; provider caches and routing graphs live elsewhere.
- Use `uuid` primary keys, `timestamptz` timestamps, canonical metric units, explicit constraints, and indexed foreign keys unless measured requirements justify otherwise.
- Store user ownership explicitly and preserve request/result snapshots needed to explain historical routes.
- Prefer normalized relational columns for queried invariants and `jsonb` only for evolving snapshots or provider-neutral details with a documented shape.
- Enable RLS on every table in an exposed schema. RLS supplements, not replaces, Worker authorization.
- Migrations are append-only after application. Schema changes, indexes, policies, views, functions, grants, and rollback/forward-fix plans are reviewed together.

## Conceptual entities

Names and columns below are proposed and may change before migrations.

### `profiles`

One row per `auth.users` identity. Proposed fields: `id` (also owner identity), display preferences such as locale/timezone, and timestamps. Do not duplicate authentication secrets or authorization roles in user-editable metadata.

### `rider_preferences`

One current preference set per user: default distance/duration, paved/gravel ranges, traffic and elevation preferences, and later speed-profile references. Validate percentage ranges and min/target/max ordering.

### `route_requests`

Immutable or versioned normalized request snapshots owned by a user: start/end coordinates, return-to-start, metric distance bounds, duration bounds, departure/deadline timestamps, timezone context, surface ranges, elevation/traffic preference, generation status, algorithm/config versions, and timestamps.

Precise coordinates are sensitive location data. Define retention, deletion/export, log redaction, and access policy before production.

### `route_waypoints`

Ordered required waypoints for a request: request ID, stable ordinal, coordinate, and optional user label. Enforce unique `(route_request_id, ordinal)` and ownership through the parent request.

### `generated_routes`

Generated alternatives belonging to a request: personality, score, metric distance/duration/elevation, surface percentages, traffic exposure/level, estimated finish, provider-neutral geometry, explanation snapshot, rejection-free validation snapshot, and routing/scoring/config versions.

Geometry representation is unresolved. Evaluate encoded polyline versus PostGIS geometry based on API size, spatial queries, indexing, precision, and portability. Decide geometry storage format and ownership timing before the first route-geometry migration during the routing/persistence milestones (not Milestone 0); record the choice in `DECISIONS.md`.

### `saved_routes`

A user's explicit save of a generated route. Prefer a reference plus immutable snapshot/version semantics so later regeneration or algorithm changes do not silently alter the saved ride. Enforce uniqueness consistent with product behavior.

### `route_feedback`

User-owned feedback tied to a route: rating, surface-accurate response, would-ride-again response, and timestamps. Later section-level reports require a separate model and moderation/privacy decision.

### `external_connections`

Integration metadata owned by a user: provider identity, provider account reference, scopes/status, and token lifecycle metadata. Tokens must be encrypted/managed using an approved secret strategy and never returned by ordinary table/API reads. Final storage may belong outside exposed schemas.

## Relationships

```text
auth.users 1─1 profiles
auth.users 1─1 rider_preferences
auth.users 1─* route_requests 1─* route_waypoints
                         └──── 1─* generated_routes
auth.users 1─* saved_routes ─1 generated_routes
auth.users 1─* route_feedback ─1 generated_routes
auth.users 1─* external_connections
```

Denormalized `user_id` on child rows may be justified for clear RLS/performance, but only with constraints or controlled writes that prevent parent/child ownership divergence.

## RLS policy model

- Default deny. Grant only required operations to explicit roles.
- User-owned reads use an ownership predicate such as `(select auth.uid()) = user_id`, not merely `TO authenticated`.
- Inserts use `WITH CHECK`; updates use both `USING` and `WITH CHECK`; updates also require an appropriate SELECT policy.
- Child access must prove ownership efficiently through a safe denormalized owner column or indexed parent relationship.
- Clients should not directly write server-computed generated-route, score, status, integration-secret, or audit fields.
- Never use user-editable `user_metadata` for authorization. If claims are used, understand refresh staleness and use trusted app metadata.
- Views exposed to clients require security-invoker behavior where supported or must be protected/unexposed. Avoid `SECURITY DEFINER`; if truly required, keep it in an unexposed schema, fix `search_path`, revoke default execute, authorize inside it, and test it.
- Test cross-user isolation, anonymous denial, ownership reassignment, deleted parents, and privileged service behavior.

## Data API and backend access

Exposure grants and RLS are separate. Public clients receive only the approved publishable key and user session; they never receive service-role/secret keys. Decide per table whether clients access Supabase directly or only through the Worker. Initial bias is Worker-mediated writes for orchestration/server-computed data, with any direct reads narrowly justified and covered by RLS tests.

## Index and performance plan

Create indexes from actual access paths, including foreign-key/ownership columns and common user/time/status lookups. RLS predicates must be index-supported. Use `EXPLAIN (ANALYZE, BUFFERS)` in a non-production representative dataset before speculative indexes; consider partial indexes for selective status queries. Run database/security advisors before accepting migrations.

## Migration and environment rules

Milestone 0 uses Supabase declarative schemas plus generated reviewed migrations based on the scaffold and current official guidance. Do not mix casually with hand-edited imperative-only workflows. Never edit an applied migration; add a forward migration. Development, staging, and production have separate projects and migration verification. Seed data is synthetic and cannot contain copied production coordinates or identities. See `ENVIRONMENTS.md`.

## Open decisions

Direct-client versus Worker-only data access; geometry storage format and ownership timing (encoded polyline versus PostGIS or equivalent, decided before the first route-geometry migration); route snapshot retention; deletion/export semantics; integration-token storage; generation status/idempotency model; algorithm/config version schema; authentication product UX; and aggregation/privacy thresholds for future community intelligence.
