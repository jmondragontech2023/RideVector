# Supabase foundation (Milestone 0)

## Workflow (ADR-011)

1. Edit declarative SQL under `supabase/schemas/`.
2. Generate a migration: `supabase db diff -f <descriptive_name>`.
3. Review the generated SQL in `supabase/migrations/` before apply.
4. Apply locally: `supabase migration up` (or `supabase db reset` during early local work).
5. Never edit an applied migration; add a forward migration instead.

Product tables are out of scope for Milestone 0.

## Local

```bash
# After installing the pinned supabase CLI via the workspace/toolchain:
supabase start
```

Link and push only to the mapped remote project for the explicit environment (`ridevector-development`, `ridevector-staging`, or `ridevector-production`). See `ENVIRONMENTS.md`.
