<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# GreyhoundIQ Project Rules

- Treat this AGENTS.md as the startup core for every agent in this repo. `CLAUDE.md` delegates here, and child `AGENTS.md` files add local contracts.
- Treat this as an AI Kick Start production app for Australian greyhound racing intelligence.
- Never commit secrets, tokens, API keys, Supabase service-role keys, Google Cloud credentials, local `.env` files, or local credential paths.
- Keep GitHub and Google Cloud deployment credentials in GitHub Actions secrets and Google Secret Manager only.
- Use Supabase staging for staging/preview validation and reserve Supabase production for launch.
- Run `npm run typecheck`, `npm run lint`, and `npm run build` before shipping code changes.
- Any Prisma migration must be forward-only and reviewed for destructive operations.
- PR reviews should prioritize security, data loss, auth, deployment, and user-facing regressions over style-only comments.

# Agent Startup Core

Run this core before coding or reviewing code:

1. Confirm `codebase-memory-mcp` is available for this repo. Use project `E-greyhoundiq` when working in `E:/greyhoundiq`.
2. If the project is not indexed or the index is stale for the files being changed, run `index_repository` before coding.
3. Use codebase-memory MCP first for code discovery and impact checks: `search_graph`, `search_code`, `trace_path`, `get_code_snippet`, `query_graph`, and `get_graph_schema`.
4. Fall back to `rg` or file reads only for literals, non-code files, config, generated assets, or when MCP results are insufficient.
5. Read this root file and every child `AGENTS.md` on the path to each file you expect to touch.
6. Apply Ponytail: prefer the smallest correct change, reuse existing code, avoid speculative abstractions, and add no dependency unless installed tools cannot reasonably solve the task.
7. Treat Anthropic Cybersecurity Skills as the always-available security layer. The global install path is `C:/Users/verri/.agents/skills`.
8. For any task touching auth, authorization, data access, user input, API routes, server actions, secrets, dependencies, CI/CD, deployment, storage, payments, webhooks, logs, infrastructure, agent tools, MCP, or production operations, load the most relevant cybersecurity skill `SKILL.md` before planning or editing.
9. Use cybersecurity skills only for authorized defensive review, hardening, testing, incident response, compliance, and secure delivery. Do not run offensive or dual-use procedures unless Daniel explicitly confirms lawful authorization and scope.
10. For Next.js code, read the relevant guide in `node_modules/next/dist/docs/` before using App Router, metadata, route handlers, caching, or other version-sensitive APIs.

# DOX Operating Layer

- `AGENTS.md` files are binding contracts for their subtrees.
- The closer `AGENTS.md` wins for local work details, but no child file may weaken the root security, MCP, Ponytail, Next.js, Prisma, or verification rules.
- Before editing, walk the DOX chain from this root to the target path and use the nearest file as the local contract.
- After meaningful changes, update the nearest owning `AGENTS.md` only when the change alters durable purpose, ownership, workflows, contracts, verification, side effects, or child index contents.
- Do not create diary-style docs. Keep AGENTS files short, operational, and current.
- Remove stale or contradictory local rules instead of explaining history.

# Child DOX Index

- `src/AGENTS.md` - application source rules and child index for app, components, and lib.
- `prisma/AGENTS.md` - Prisma schema, migrations, and seed data contracts.
- `scripts/AGENTS.md` - operational scripts, imports, audits, maintenance, and environment checks.
- `docs/AGENTS.md` - product, architecture, deployment, and design documentation contracts.
- `infra/terraform/AGENTS.md` - source-only Google Cloud Terraform staging baseline and safety contract.
- `infra/terraform-production/AGENTS.md` - source-only Google Cloud Terraform production foundation and approval contract.
- `public/AGENTS.md` - static asset and public file contracts.
