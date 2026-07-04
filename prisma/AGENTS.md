# Purpose

- Owns Prisma schema, migrations, generated client contracts, and seed data for GreyhoundIQ.

# Ownership

- `schema.prisma` owns the database model contract.
- `migrations/` owns forward-only schema history.
- `seed.ts` owns development/demo seed data.

# Local Contracts

- Any migration must be forward-only and reviewed for destructive operations before use.
- Do not edit old applied migrations unless explicitly asked for local repair. Add a new migration for schema changes.
- Never put secrets, production URLs, or local credentials in schema, seed, or migration files.
- Keep Supabase production reserved for launch; use staging or local databases for preview and development workflows.
- Use codebase-memory MCP and Prisma validation before changing models used by app services.

# Work Guidance

- Keep model changes minimal and name fields for the domain, not implementation convenience.
- Update seed data only when it supports current product behavior or local verification.
- Consider data backfill and nullable/default behavior before adding required fields.

# Verification

- Run `npx prisma validate` after schema changes.
- For migration changes, run the relevant local migration command before shipping when a database is available.
- For seed changes, run `npm run db:seed` against a safe local/staging database when relevant.

# Child DOX Index

- This subtree has no child AGENTS.md files yet.
