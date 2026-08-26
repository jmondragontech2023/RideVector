# Environments

Canonical environment documentation for RideVector. Prefer this file and `DECISIONS.md` over `RIDEVECTOR_HANDOFF.md`.

## Taxonomy

| Canonical name | Kind | Creation order | Default target? |
| --- | --- | --- | --- |
| `local` | Developer machine + local emulators/CLIs | 1 | Yes for day-to-day local commands |
| `development` | First remote non-production environment | 2 | Never for remote Cloudflare deploys (must be explicit); may be the documented default only for non-deploy remote helper scripts that cannot imply production |
| `staging` | Pre-production remote environment | 3 | Never implicit; select explicitly |
| `production` | Live remote environment | 4 | Never implicit; always explicit and protected |

Milestone 0 is incomplete until separate remote `development`, `staging`, and `production` resources exist for both Supabase and Cloudflare and isolation is demonstrated. Resources are created in order: **local → development → staging → production**.

## Platform name mapping

| Canonical | GitHub Actions Environment | Cloudflare Worker name | Wrangler env key | Supabase project name | Committed example config | Real secrets / env files |
| --- | --- | --- | --- | --- | --- | --- |
| `local` | _(none; local only)_ | _(local Wrangler session only)_ | local/dev session; never remote `production` | Supabase local stack | `.env.example`, `apps/*/.env.example` | `.env`, `.env.local`, and platform local secret stores (gitignored) |
| `development` | `development` | `ridevector-api-development` | `development` | `ridevector-development` | `.env.development.example` | GitHub `development` secrets; Cloudflare development secrets; Supabase development project secrets |
| `staging` | `staging` | `ridevector-api-staging` | `staging` | `ridevector-staging` | `.env.staging.example` | GitHub `staging` secrets; Cloudflare staging secrets; Supabase staging project secrets |
| `production` | `production` | `ridevector-api-production` | `production` | `ridevector-production` | `.env.production.example` | GitHub `production` secrets; Cloudflare production secrets; Supabase production project secrets |

### Cloudflare

- Base Wrangler configuration / Worker service name: `ridevector-api`.
- Per-environment Worker names: `ridevector-api-development`, `ridevector-api-staging`, `ridevector-api-production`.
- Every remote deployment must specify an environment explicitly (`development`, `staging`, or `production`). No remote deploy command may omit the environment or default to production.

### Supabase

- Project names: `ridevector-development`, `ridevector-staging`, `ridevector-production`.
- All three remote projects use the **same region**. Choose the region when creating `ridevector-development` and reuse it for staging and production; record the chosen region here after creation (no secrets).

### GitHub Actions Environments

| Environment | Required reviewers | Deployment branches | Notes |
| --- | --- | --- | --- |
| `development` | None | Unrestricted beyond normal workflow design (CI may deploy development from allowed workflows) | No approval gate |
| `staging` | None initially | **Only `main`** | No reviewer gate initially; branch restriction required |
| `production` | **`jmondragontech2023`** | **Only `main`** | Explicit approval required; production always explicit |

Do **not** enable prevent-self-review while `jmondragontech2023` is the only authorized production reviewer.

Notes:

- Canonical names are lowercase and identical across docs, scripts, and CI inputs unless a platform API forces a different key; if so, map it here explicitly rather than inventing aliases ad hoc.
- Client publishable URLs/keys are environment-specific. Service-role and other privileged secrets never enter web or iOS bundles.
- Non-production builds and config must fail closed if they resolve production project IDs, hosts, routes, Worker names (`ridevector-api-production`), or credentials.
- No default deploy command may target `production`. Production deploys require explicit environment selection plus GitHub Environment protection.

## Secrets policy

Platform-native secrets only (ADR-009):

- GitHub Actions repository and Environment secrets
- Cloudflare Workers / Wrangler secrets per environment
- Supabase project-native secret mechanisms

Do not commit secret values. Document ownership and rotation without recording values. Example files contain placeholders only.

## Safe defaults

1. Local commands default to `local`.
2. Every remote Cloudflare deployment must pass an explicit environment (`development`, `staging`, or `production`).
3. Staging and production are always explicit; production additionally requires GitHub Environment approval by `jmondragontech2023`.
4. CI pull-request jobs use mocks/fixtures and must not require production credentials.
5. Staging and production deploy workflows may run only from `main`.

## Milestone 0 verification expectations

- `.gitignore` covers real env and secret files.
- Automated assertion: non-production config cannot reference production identifiers, including `ridevector-api-production` and `ridevector-production`.
- Separate Supabase projects `ridevector-development`, `ridevector-staging`, and `ridevector-production` exist in the same region.
- Cloudflare Workers `ridevector-api-development`, `ridevector-api-staging`, and `ridevector-api-production` exist under base config `ridevector-api`.
- GitHub Environments match the protection table above.
- Setup docs record the mapping table, chosen Supabase region, and commands actually verified.
