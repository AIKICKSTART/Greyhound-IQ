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
- Keep social-actor and Realtime RLS helpers `SECURITY DEFINER` with an empty search path and explicit runtime-role grants.
- Keep FORCE-RLS own-table visibility policies row-local. `SocialActor` and `FeedPost` policies must not invoke helpers that query the same table; child-table policies may use those helpers only after the own-table policy is recursion-safe.
- `Profile` and `CustomPage` contact columns are server-runtime data; direct `anon`/`authenticated` reads use `giq_public_social_actor_profiles` only.
- `SocialActor` is the canonical visible identity for members and managed pages. Keep legacy profile/page author fields dual-written until a separately reviewed contraction migration is safe to deploy.
- Conversations are unique per accountable profile pair plus actor pair. Keep `ACTOR_CONVERSATION_MULTIPLEX_ENABLED=false` until old app revisions retire, then enable distinct personal/page inboxes.
- User media is private by default and must move through the `pending -> scanning -> processing -> ready|failed` contract before protected delivery.
- Social, media, messaging, and realtime migrations must preserve viewer-context RLS and accountable-human ownership checks.
- Managed-page media backfills and writes must validate `MediaAsset.uploaderId` against the actor owner before populating `ActorGalleryMedia`.
- `SignupOutbox` is a system-only, one-row-per-user acceptance record. Keep it free of email/provider payloads, permit only the normalized request correlation ID, preserve atomic creation with the initial user/profile transaction, and require an expiring ownership token for every `processing` lease.
- `UsageOutbox` is the delivery queue for the immutable local `UsageEvent` ledger. Preserve one row per idempotency key, nullable forward-compatible lease fields, fenced settlement by lease token, bounded terminal dead-letter state, and indexes for both due retries and expired-lease recovery.
- Keep the `User(isBanned, deletionRequestedAt, id)` index aligned with the bounded oldest-first account-deletion candidate selector; build replacements concurrently so maintenance hardening does not block production writes.
- Member-authored `SupportMessage` inserts must bind both `userId` and the referenced `SupportTicket.userId` to the request-context user; moderator and system contexts retain their explicit policy access.
- Pedigree source identities, assertions, import runs, and merge decisions are evidence records: preserve artifact/page/line hashes, allow only system-context writes, expose only verified linked identity/assertion rows publicly, keep the merge ledger append-only, and never resolve an identity from a name alone.

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
