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
- LiveKit keeps the complete single-cell environment compatible by default. Regional mode requires complete, distinct Sydney and Melbourne cells with matching secure public origins, and may select a cell only from an explicitly persisted room-home region.
- Private Realtime topics retain HMAC-derived names, but access also requires a short-lived `SUPABASE_JWT_SECRET` token and an exact, unexpired grant in the self-hosted Supabase engine database accepted by `realtime.messages` RLS. Keep events content-free and Feed public-only.
- Realtime broadcast payloads must stay content-free: ids and flags only, never message bodies or user data.
- Managed-page media must be uploader-owned, synchronized to `ActorGalleryMedia`, and delivered only when the actor audience permits the viewer and neither profile has blocked the other.
- Live provider source snapshots must pass the provider/entity allowlist before storage; unknown providers and unapproved fields are not retained.
- Keep live result ingestion separate from the hourly aggregate materialized-view refresh route so provider sync stays within its scheduler deadline.
- Server-side link preview requests must connect only through the public DNS addresses validated for that request and repeat validation/pinning for every redirect.
- ClamAV maintenance refreshes due signatures as the non-root runtime user and must fail closed when installed definitions exceed the configured maximum age.

# Work Guidance

- Reuse existing error helpers and validation schemas.
- Keep data transformations typed and explicit.
- Do not create service abstractions for one route or one component.

# Verification

- Run `npm run typecheck`, `npm run lint`, and targeted scripts or route checks that exercise changed services when available.

# Child DOX Index

- This subtree has no child AGENTS.md files yet.
