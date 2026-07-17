# Purpose

- Owns durable product, architecture, deployment, design, mockup, prompt, and operational documentation for GreyhoundIQ.

# Ownership

- Deployment docs own environment and release guidance.
- Design-system docs own visual language and UI implementation guidance.
- Prompt and mockup docs own source material for generated visuals and design passes.
- Architecture and business docs own durable product context.

# Local Contracts

- Use AI Kick Start as the user-facing business context. Do not introduce Verridian as new public-facing positioning unless explicitly requested.
- Do not document secrets, tokens, service-role keys, local credential paths, or private environment values.
- Keep docs operational and current. Remove stale instructions instead of layering corrections.
- If code changes alter durable workflows, commands, routes, environment variables, deployment steps, or product behavior, update the nearest relevant doc.
- `docs/product/` records the evidence-backed product audit. Keep current inventory counts synchronized with the machine registries and label partial or historical evidence honestly.
- `docs/security/security-trace-registry.md` is the deterministic output of `security/final-traceability.ts`. Regenerate it with `npm run build:security-trace-registry`, verify it with `npm run check:security-trace-registry`, and keep its structure-only, release-blocked boundary; do not hand-edit totals into completeness claims.
- `docs/architecture/pedigree-provenance-foundation.md` owns the source-authority, immutable-evidence, fail-closed identity-resolution, and production-write boundary for pedigree population.

# Work Guidance

- Prefer concise, task-ready docs over broad narrative.
- Keep examples aligned with existing package scripts and environment names.
- Do not copy every source prompt or design note into implementation docs unless it changes a current contract.

# Verification

- Run `npm run docs:check` after docs changes.
- Run additional checks only when docs changes also affect code, scripts, schema, or deployment files.

# Child DOX Index

- This subtree has no child AGENTS.md files yet.
