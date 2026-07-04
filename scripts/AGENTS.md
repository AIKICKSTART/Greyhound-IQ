# Purpose

- Owns operational TypeScript and Node scripts for local database control, TheDogs imports/backfills, audits, reports, maintenance, environment checks, asset uploads, and smoke tests.

# Ownership

- Import, backfill, supervise, audit, status, and report scripts own their named operational workflows.
- `load-env.ts` and `load-import-env.ts` own script environment loading.
- `check-docs.mjs` owns documentation verification.
- `local-database.ts` owns local database lifecycle commands.

# Local Contracts

- Use codebase-memory MCP before changing shared helpers or scripts with callers.
- Scripts must fail clearly and avoid silent partial success.
- Keep imports/backfills idempotent where practical and avoid destructive behavior unless the command name and docs make it explicit.
- Never print secrets, tokens, full database URLs, Supabase service-role keys, or local credential paths.
- Preserve current npm script names unless the user asks for a workflow rename.

# Work Guidance

- Prefer extending existing script helpers over creating one-off environment/database code.
- Keep command flags and output boring, explicit, and automation-friendly.
- For large data workflows, make operator-attention conditions visible instead of hiding them behind success messages.

# Verification

- Run the specific npm script or `tsx scripts/<name>.ts` path for the changed workflow when safe.
- Run `npm run typecheck` for TypeScript script changes.
- Run `npm run docs:check` after changing docs verification behavior.

# Child DOX Index

- This subtree has no child AGENTS.md files yet.
