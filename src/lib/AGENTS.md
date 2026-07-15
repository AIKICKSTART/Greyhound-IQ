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
- Runtime logs must use `logger.ts`, keep request-only correlation non-null, mark requestless execution explicitly, and sanitize sensitive key names and textual credential patterns before emission.
- Keep modules side-effect-light. Avoid work at import time unless the existing pattern already requires it.
- Prefer central fixes in shared services over patching every caller.
- LiveKit keeps the complete single-cell environment compatible by default. Regional mode requires complete, distinct Sydney and Melbourne cells with matching secure public origins, and may select a cell only from an explicitly persisted room-home region.
- API routes using `checkRateLimit` must return denials through `rate-limit-response.ts`; raw route-level 429 responses and headerless `rate_limit.exceeded` throws are rejected by the route contract test.
- Private Realtime topics retain HMAC-derived names, but access also requires a short-lived `SUPABASE_JWT_SECRET` token and an exact, unexpired grant in the self-hosted Supabase engine database accepted by `realtime.messages` RLS. Keep events content-free and Feed public-only.
- Conversation Realtime grants require current server-side membership and no block; applying a block must revoke the conversation topic for both participants and token issuance must revalidate after cross-database grant replacement.
- Realtime broadcast payloads must stay content-free: ids and flags only, never message bodies or user data.
- Moderator or administrator status alone never grants private-media delivery or deletion; privileged review/removal requires a separate scoped, reasoned, audited workflow.
- Managed-page media must be uploader-owned, synchronized to `ActorGalleryMedia`, and delivered only when the actor audience permits the viewer and neither profile has blocked the other.
- Live provider source snapshots must pass the provider/entity allowlist before storage; unknown providers and unapproved fields are not retained.
- Live provider HTTP reads must have a fixed deadline, streamed byte ceiling and content-type allowlist. JSON adapters require runtime envelope/record schemas; HTML adapters must cap parsed collections and text and may retain only provider-origin URLs.
- Keep live result ingestion separate from the hourly aggregate materialized-view refresh route so provider sync stays within its scheduler deadline.
- The hourly aggregate maintenance path prunes expired rate-limit rows only through indexed, capped batches; cleanup failure or backlog must be returned explicitly without blocking materialized-view refreshes.
- Server-side link preview requests must connect only through the public DNS addresses validated for that request and repeat validation/pinning for every redirect.
- ClamAV maintenance refreshes due signatures as the non-root runtime user and must fail closed when installed definitions exceed the configured maximum age.
- Account deletion scrubs only the deleting profile's authored message content and preserves counterpart-authored messages. Maintenance selects at most 25 oldest eligible users, locks and revalidates each candidate, advances eight ownership tables in audited 100-row `SKIP LOCKED` batches, and finalizes only after every batch drains. Storage deletion remains bounded and audited; the production worker defaults to the real Supabase batch function, while disposable evidence may inject a provider-free handler without weakening that default. Remote WorkOS and Stripe records require a separately verified provider lifecycle.
- User-data export database reads belong in `user-export-service.ts`, not the HTTP route. They must use explicit fields, server-derived owner predicates, 501-row top-level sentinels and 21-row per-parent database LATERAL sentinels; the 501st/21st row fails closed for a managed export. Provider references, storage coordinates/hashes, raw-agent internals and memory source references remain excluded. Every route outcome is private/no-store, and successful completion commits the audit plus artifact atomically in member context.
- Public race and track detail queries must cap every to-many relation, including current runners, videos, recent meetings, meeting races, and race runners; multi-parent dog-form and previous-video reads use parameterized LATERAL subqueries so per-parent limits exist in generated SQL rather than only in Prisma result shaping.
- Public dog detail must keep form entries, profile forms, recent runners and approved ownership rows capped at 64/20/20/16 with explicit presentation-only projections. Career totals use separate bounded aggregates, and pedigree input is clamped to at most five generations.
- Current-day and race-explorer bundles must cap meetings, races, runner-count groups and replay rows at the SQL boundary; replay projection keeps only the latest selected video per race.
- Race-explorer metadata caps distinct states at 16 and recent dates at 90; the default replay rail returns at most eight races with presentation-only race/meeting/track fields, while ranked search keeps its 120/80/48 limits.
- New-user auth sync must commit the user, profile, personal actor, and one deduplicated `SignupOutbox` row in the same system-context transaction; optional signup side effects never run in the callback.
- Signup outbox workers claim with `SKIP LOCKED`, bounded expiring lease tokens and attempt caps, then release the database transaction before invoking an injected idempotent handler. A stale lease may never settle a newer claim, and raw provider errors or payloads may never be persisted.
- Usage delivery must keep `UsageEvent` and `UsageOutbox` atomic at enqueue, claim only due rows with bounded `SKIP LOCKED` leases, recheck the current user/subscription relation before calling Lago, use the durable idempotency key as Lago `transaction_id`, and persist only normalized outcome codes. Free/inactive accounts are terminal ignored outcomes; transient provider failures use bounded jittered retries and attempt exhaustion dead-letters.
- Stripe mutating SDK calls must carry explicit idempotency keys, paid entitlement must derive from allowlisted Price IDs plus local customer/subscription ownership rather than provider metadata, and retried notification webhooks must reuse the notification ID as their downstream idempotency key.
- Keep every background-worker scan and downstream queue fan-out explicitly capped; adding a durable queue model, publisher, consumer, or worker requires refreshing the source inventory and queue-control regression test.
- Every `/api/internal/*` scheduled route must authenticate before calling `executeScheduledTask`; keep its task ID exact with `scheduled-task-policy.ts`, retain the PostgreSQL advisory-lock overlap guard, and emit the shared start/completion/failure/overlap events inside the configured deadline.

# Work Guidance

- Reuse existing error helpers and validation schemas.
- Keep data transformations typed and explicit.
- Do not create service abstractions for one route or one component.

# Verification

- Run `npm run typecheck`, `npm run lint`, and targeted scripts or route checks that exercise changed services when available.

# Child DOX Index

- This subtree has no child AGENTS.md files yet.
