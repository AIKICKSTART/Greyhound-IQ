# Database role matrix

Status: **Not verified at runtime — release blocked**  
Evidence date: 2026-07-13  
Owner: database security and cloud platform owner

| Identity/context | Repository evidence | Intended privilege | Verified state |
|---|---|---|---|
| `greyhoundiq_runtime` | Created conditionally as `NOLOGIN NOBYPASSRLS`; schema usage and table DML granted in `20260706223000_add_rls_entitlement_policies` | Ordinary application DML constrained by FORCE RLS and request GUCs | Not verified that it exists or is the `DATABASE_URL` principal; role creation may be skipped on insufficient privilege |
| Application request context | `withDbRequestContext` sets user, profile, actor, tier, role and `app.system=false` in a 30s Prisma transaction | Request-scoped application/RLS identity | Partially source verified; pool/runtime isolation tests incomplete |
| Anonymous context | `withDbAnonymousContext` clears identities and sets free/member/system false | Public database reads only where policy permits | Source present; runtime negative tests missing |
| System context | `withDbSystemContext` sets `app.system=true`, system tier/role | Jobs/provider reductions requiring system policy | Source present, but uses the same database principal; least privilege and entry-point authorization are not verified |
| Migration principal | `DIRECT_URL`/migration workflow and 86 migrations | DDL, roles, grants, functions and policies | Principal name/scope/rotation and production binding not verified |
| `anon` / `authenticated` | Conditional Supabase storage/realtime grants in migrations | Direct Supabase clients with RLS-constrained projection/topic access | Provider roles and deployed grants not verified |
| `greyhoundiq_app` | Referenced conditionally in several migrations | Legacy/alternate runtime compatibility | No creation contract found in inspected migrations; deployment use is unknown and must be removed or documented by database security |
| Backup/reporting/monitoring/incident roles | Required by master prompt | Separate read-only or operational privilege | No repository or live evidence; control missing, owner: database/cloud security |

`FORCE ROW LEVEL SECURITY` is applied by a migration to close table-owner bypass, but superusers still bypass RLS. `scripts/check-rls-policies.ts` contains expected grants/policies; the current release report records that passing live role/TLS/grant/pool evidence is absent. The ordinary application, system worker and migrations must not silently share a superuser or BYPASSRLS principal.

Release evidence must show `pg_roles`, role membership, grants, ownership, FORCE RLS, connection strings mapped to non-secret principal names, TLS, pool context reset and negative tests for ordinary/system/anonymous/background identities. No role is approved from migration text alone.

