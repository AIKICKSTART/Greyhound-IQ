# Production Account Cleanup — Inventory, Classification & Deletion

- **Date:** 2026-07-23
- **DB:** `giq_production_stage11_20260718_r2` (Contabo VPS 217.216.76.124, `greyhoundiq-postgres-1`, PostgreSQL 16.14)
- **Operator:** account-cleanup agent (superuser psql, RLS bypassed as expected)
- **Backup:** `/opt/greyhoundiq/backups/account-cleanup-20260723.sql` (VPS) — 35,638 bytes, sha256 `d57117b4a64a0b42c4124f2ddd895879eb5eeb61ee790617cd18d80dd289d6fd`
- **Scope:** DML deletes only. No schema changes, no vacuums, no audit-log inserts (kept strictly within "nothing beyond DML deletes"). Backup + this file are the record of change.

## Starting state
21 users / 21 profiles. The name/email filter plus a full profile listing surfaced every account below (two — "Lachie" / "Lachie Roo" — were **not** in the original brief and were found by listing all profiles).

## Authoritative FK graph used
Deletion order was derived from the live DB `information_schema`/`pg_constraint`, not guessed. Note: the app's own account flow (`src/lib/account-service.ts`) is a **scrub/anonymize**, not a hard delete — so a bespoke hard-delete in FK dependency order was required. Blast radius was proven contained before any delete (no conversation, friendship, message, or call-room row of a delete-target involves a kept account).

## Inventory & classification

### KEPT — real / canonical (6)
| Name | Email | Tier | Auth | Activity | Decision |
|---|---|---|---|---|---|
| Daniel Fleuren | daniel.fleuren@aikickstart.com.au | pro_plus admin | WorkOS + **Stripe** | 39 audits, 5 msgs sent, feed post/comment/reaction, listing, 2 friendships, 5 media, active **today** | **CANONICAL — keep** |
| Jackson Chaker | jacksonchaker8@gmail.com | pro_plus | WorkOS | 3 msgs, 1 convo, 1 friendship, active today | keep (co-founder) |
| Gary Taylor | nickyg-garyt@hotmail.com | free | WorkOS | none yet | keep (real early user) |
| James Wilson | bleachedbro@gmail.com | free | WorkOS | none yet | keep (real early user) |
| Lachie | lachierooo@gmail.com | free **admin** | no-auth | none | **review/keep** — not in brief; role=admin, no auth identity |
| Lachie Roo | lachieroo4@gmail.com | pro_plus **admin** | WorkOS | none | **review/keep** — not in brief; role=admin |

### DELETED (13) — backed up then hard-deleted
| Name | Email | Why |
|---|---|---|
| Daniel Fleuren | daniel.fleuren@verridian.ai | Daniel duplicate: **no auth identity, never signed in (0 audits), zero content** — unambiguous dead sign-up |
| Daniel Fleuren | admin@greyhoundiq.test | Dev **seed persona** (`.test` reserved TLD, no-auth, UUID id, batch-created 2026-06-29 09:34 with the 3 below); content is seed/demo, contained |
| Patricia Pro | pro@greyhoundiq.test | Seed tier-testing persona |
| Quentin Quant | proplus@greyhoundiq.test | Seed tier-testing persona |
| Freddie Free | free@greyhoundiq.test | Seed tier-testing persona |
| Messaging Test ×8 | messaging_roundtrip_*@example.invalid / @probe.greyhoundsiq.com.au | Automated messaging round-trip test accounts (4 a/b pairs). **Note: 8 found, brief said 6.** |

### FLAGGED — left for founder decision (2)
Both are Daniel-named, WorkOS-authenticated, **zero content**, but not safe to delete unilaterally:

| Email | Evidence | Recommendation |
|---|---|---|
| **daniel.fleuren@greyhoundsiq.com.au** | Audit actions `admin.bootstrap_owner`, `admin.bootstrap_owner_full_access`, `auth.login`; **signed in TODAY 09:56** on the production domain. Possibly the production owner/admin login. | **Do NOT delete without explicit confirmation.** Verify it is not the account holding owner/full-access on prod first. |
| **daniel.j.fleuren@gmail.com** | Real personal email (explicitly named in the brief as a *canonical candidate*); WorkOS identity; single `auth.login` 2026-07-19; zero content. | Likely a duplicate sign-up. Recommend delete once founder confirms aikickstart is the sole keeper. One-command follow-up (see below). |

Deleting these two would reduce Daniel accounts in member search to exactly 1 (aikickstart). Both are recoverable from the backup if deleted later.

## Backup contents (restore-ready COPY blocks, parent→child order)
`User` 13, `Profile` 13, `Thread` 10, `Post` 15, `Conversation` 3, `Message` 15, `ConversationParticipant` 2, `CallRoom` 4, `CallEvent` 20, `Listing` 13, `ListingStatusHistory` 13, `DogOwnership` 16, `SocialActor` 14, `CustomPage` 1, `SignupOutbox` 8, `AdminAction` 1, `ExportArtifact` 1.
Restore with: `psql -U postgres -d giq_production_stage11_20260718_r2 -f /opt/greyhoundiq/backups/account-cleanup-20260723.sql`

## Deletion transaction (single tx, ON_ERROR_STOP, dry-run+ROLLBACK first, then COMMIT)
Order (each scoped to the 13 target profile/user ids); CASCADE/SET NULL children resolved automatically:
Message 15 → ConversationParticipant 2 → Conversation 3 → CallRoom 4 → Post 15 → Thread 10 → Listing 13 → DogOwnership 16 → Profile 13 → User 13. Post-delete check: **0 target accounts remain.**

## Final member list (8 users / 8 profiles)
Daniel Fleuren (aikickstart — canonical), Daniel Fleuren (greyhoundsiq.com.au — FLAGGED), Daniel Fleuren (gmail — FLAGGED), Gary Taylor, Jackson Chaker, James Wilson, Lachie, Lachie Roo.

## Open items for the founder
1. Confirm deletion of **daniel.fleuren@greyhoundsiq.com.au** (check it is not the prod owner account first) and **daniel.j.fleuren@gmail.com**. Both backed up; deletable via the same scoped transaction pattern.
2. Confirm **Lachie** / **Lachie Roo** are legitimate (both hold `admin` role; Lachie has no auth identity).
