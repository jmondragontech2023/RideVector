# Supabase foundation (Milestone 0)

Verified against pinned CLI (`mise.toml`: supabase **2.115.0**) and
[declarative database schemas](https://supabase.com/docs/guides/local-development/declarative-database-schemas).

## Prerequisites

- Docker-compatible runtime (Docker Desktop / Colima / compatible engine) running
- `mise install` so the pinned `supabase` binary is on PATH
- No product tables in Milestone 0

## Declarative schema workflow (ADR-011)

1. Edit declarative SQL under `supabase/schemas/` (source of truth).
2. Generate a migration after verifying CLI flags:
   ```bash
   supabase db diff --help
   supabase db diff -f <descriptive_name>
   ```
3. Review the generated SQL in `supabase/migrations/` before apply.
4. Apply locally:
   ```bash
   supabase db reset   # early local work: recreate from migrations + optional seeds
   # or
   supabase migration up
   ```
5. Never edit an applied migration; add a forward migration instead.

`config.toml` sets `schema_paths = ["./schemas/*.sql"]`. Seeds are disabled by
default (`[db.seed] enabled = false`) until synthetic seed files are reviewed.

## Local stack

```bash
mise install
supabase start          # requires Docker
supabase status
supabase db reset       # applies migrations; seeds only if enabled
supabase stop
```

Local project id in `config.toml`: `ridevector-local` (ports API `54321`, DB `54322`, Studio `54323`).

## Synthetic seeds

- Place optional seeds under `supabase/seeds/*.sql` and enable `[db.seed]` only when ready.
- Seeds must be synthetic: no copied production coordinates, identities, or tokens.
- Milestone 0 ships no seed data (seed disabled).

## RLS test conventions

- When product tables exist (later milestones), add pgTAP tests under `supabase/tests/`
  and run `supabase test db` (CLI ≥2.115 fails if zero tests are discovered — do not
  add an empty CI step until tests exist).
- Cover anonymous denial, owner access, other-user denial, ownership reassignment,
  and privileged service-role paths.

## Type generation

```bash
supabase gen types --help
# When a linked project or local DB exists:
supabase gen types typescript --local > supabase/database.types.ts
```

Do not commit service-role keys into generated client helpers. Milestone 0 does not
yet generate committed DB types (no product schema).

## Advisors

```bash
supabase db advisors --help   # requires CLI ≥2.81.3; present in 2.115.0
# Against local or linked project once available:
supabase db advisors
```

Also usable via Supabase MCP `get_advisors` when authenticated to a project.

## Remote projects

Names (ADR-015 / ADR-016): `ridevector-development`, `ridevector-staging`,
`ridevector-production` — intended region **`us-west-1`**.

Milestone 0 creates **only** the Free/Nano remote `ridevector-development`.
Do **not** create staging or production Supabase remotes yet (cost deferral).
Record non-secret development ref/URL and the region in `ENVIRONMENTS.md` only.

```bash
supabase projects list
# Free/Nano only — omit --size and --high-availability; stop if upgrade required
supabase projects create ridevector-development --org-id <org> --region us-west-1 --db-password <generated>
supabase link --project-ref <ref>   # one linked project at a time; switch deliberately
supabase migration list --linked
supabase db push --linked --dry-run
```

Live development (Milestone 0): ref `hsokwavqmqlkbtnftoqw`, region `us-west-1`,
public URL `https://hsokwavqmqlkbtnftoqw.supabase.co`. Linked + empty migration push
verified (no product tables). Do not create staging/production remotes yet.

Never commit access tokens, DB passwords, or service-role keys.
