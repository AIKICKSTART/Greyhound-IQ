# Purpose

- Owns shared application logic: database clients, auth, validation, account/listing/media/conversation/report services, live data helpers, storage paths, API errors, and utilities.

# Ownership

- `db.ts`, `database-url.ts`, and query/service modules own database access patterns.
- `*-validation.ts` files own input validation contracts.
- Auth and internal auth helpers own trust boundaries and identity assumptions.
- Storage and media helpers own Supabase storage paths and upload rules.
- `live/` owns live race data helpers.

# Local Contracts

- Use codebase-memory MCP `trace_path` before changing exported services or validators.
- Keep validation at trust boundaries with the existing validation style.
- Do not leak database internals, stack traces, secrets, service-role keys, or local paths to users or clients.
- Keep modules side-effect-light. Avoid work at import time unless the existing pattern already requires it.
- Prefer central fixes in shared services over patching every caller.
- Realtime channel names are HMAC capabilities derived from `REALTIME_CHANNEL_SECRET`; treat the channel name itself as the access token.
- Realtime broadcast payloads must stay content-free: ids and flags only, never message bodies or user data.
- Supabase private channels with RLS authorization are the deferred upgrade for realtime access control.

# Work Guidance

- Reuse existing error helpers and validation schemas.
- Keep data transformations typed and explicit.
- Do not create service abstractions for one route or one component.

# Verification

- Run `npm run typecheck`, `npm run lint`, and targeted scripts or route checks that exercise changed services when available.

# Child DOX Index

- This subtree has no child AGENTS.md files yet.
