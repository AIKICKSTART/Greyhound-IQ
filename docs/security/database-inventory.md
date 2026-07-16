# Database inventory

Status: **Source inventory frozen; fail-closed local catalog lane implemented; production parity Not verified — release blocked**  
Evidence date: 2026-07-14  
Owner: GreyhoundIQ database security owner

## Frozen repository evidence

Run `npm run check:database-inventory`. The check reads only repository files and
fails when an unreviewed Prisma schema or migration change alters the frozen
counts or digests.

| Source set                                                               | SHA-256                                                            |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Normalized `prisma/schema.prisma`                                        | `44a523c98f05cec632c3733c0c2b8cdeb802bf666e9766f07e2e5665320fbeab` |
| Sorted `prisma/migrations/*/migration.sql` paths and normalized contents | `89cac59f3cfd35f7a6478a18489d8df21516a52e21ac31bc6e1f5e24247c3646` |

Line endings are normalized to LF before hashing. The migration digest includes
each repository-relative path and file content in bytewise path order, separated
by null bytes, so renames and ordering changes are visible.

| Object                                 |   Count | Source/evidence                                                                                                   |
| -------------------------------------- | ------: | ----------------------------------------------------------------------------------------------------------------- |
| Prisma models/tables                   |     107 | `prisma/schema.prisma`                                                                                            |
| Migration files                        |      93 | `prisma/migrations/*/migration.sql`                                                                               |
| Declared extensions                    |       1 | `pg_trgm` in migration source                                                                                     |
| Unique SQL function identifiers        |      54 | Migration source scan; includes one `pg_temp` migration helper                                                    |
| Unique trigger identifiers             |      15 | Migration source scan                                                                                             |
| Unique RLS/storage policy identifiers  |     252 | Migration source scan; later migrations can replace earlier definitions                                           |
| Materialized views                     |       5 | `giq_box_bias`, `giq_sire_leaderboard`, `giq_track_records`, `giq_trainer_leaderboard`, `giq_trainer_performance` |
| Ordinary views                         |       1 | `public.giq_public_social_actor_profiles`                                                                         |
| Unique SQL index identifiers           |     424 | `CREATE [UNIQUE] INDEX` migration source                                                                          |
| Explicit created role identifiers      |       1 | `greyhoundiq_runtime` (conditional)                                                                               |
| Prisma index declarations              |     325 | `@@index` declarations; supplementary, not part of the frozen SQL-object count                                    |
| Compound/field uniqueness declarations | 33 / 41 | `@@unique` / `@unique` declarations                                                                               |
| Prisma relations                       |     246 | `@relation` declarations                                                                                          |

The SQL counts are unique normalized identifiers found in `CREATE` statements
after SQL comments are removed. They are a compatibility source inventory, not
an assertion that every historical or conditional definition exists in a
deployed database. Replaced definitions and failed/skipped migrations can make
the effective catalog different.

The frozen 93-migration source set includes three reviewed forward-only runtime
hardening migrations. They remove direct application access to Prisma migration
metadata, remove runtime DML from current public views and materialized views,
reduce the migration executor's future-table runtime default grant to `SELECT`,
revoke implicit `PUBLIC EXECUTE` for future public routines created by that
executor, reset direct runtime `EXECUTE` grants on current `public.giq_*`
routines to the source allowlist, and revoke database `TEMPORARY` from `PUBLIC`
and the runtime role while retaining `CONNECT`. This is source and local-loopback
evidence only. Existing inherited privileges, conditional Supabase routines,
deployment ownership, role existence, and staging/production grants remain
unverified.

The 107 models are:

```text
Dog, DogProfileForm, DogProfileArchive, RaceDayArchive, Trainer, Track, Meeting, Race, RaceVideo, Runner, Result, FormEntry, User, SignupOutbox, TermsAcceptance, ConsentEvent, MarketingPreference, Notification, Organization, Membership, OrganizationInvitation, SupportTicket, SupportMessage, Feedback, BugReport, RetentionPolicy, DeletionJob, ExportArtifact, Plan, PriceCatalog, PlanEntitlement, BillingCustomer, Subscription, EntitlementSnapshot, WebhookEvent, InvoiceRecord, PaymentRecord, RefundRecord, CreditNoteRecord, BillingEvent, UsageEvent, UsageOutbox, UsageAggregate, Profile, CustomPage, SocialActor, RealtimeTopicGrant, ActorFollow, ActorTopicFollow, ActorMute, ActorGalleryMedia, SavedFeedPost, FeedMention, FeedShare, Friendship, DogOwnership, ForumCategory, Thread, Post, Listing, MarketplaceCategory, ListingLocation, ListingAttribute, ListingStatusHistory, SavedListing, ListingEnquiry, ListingReport, ListingModerationAction, ListingView, ListingSearchIndex, TrustSafetyFlag, BannedPhrase, Message, MediaAsset, MessageMedia, ListingMedia, Conversation, ConversationParticipant, MessageDeliveryReceipt, MessageReadReceipt, MessageReaction, UserPresence, UserBlock, MessageModerationAction, FeedTopic, FeedPost, FeedPostMedia, FeedComment, FeedReaction, CallRoom, CallParticipant, CallInvite, CallEvent, CallReport, CallPermission, AgentRun, AgentRunUsage, MemoryEntry, ConversationContext, AuditLog, AdminAction, JobRun, DataSourceHealth, Report, RateLimit, PlatformSetting, CustomDesignRequest
```

Key security functions establish request identity/tier/role/system context, ownership/visibility/block relationships, organisation membership, media ownership, realtime grants, entitlement write guards, call identity and safe materialized-view refresh. Triggers enforce tier writes and social/conversation/call identity. Their definitions are authoritative in migrations, not in this summary.

## Live and effective catalog evidence

`npm run audit:local-postgres-catalog` is the read-only local evidence lane for
`PREPROD.DB.PRISMA_SCHEMA_PARITY`. It requires `LOCAL_DATABASE_URL` explicitly,
refuses `DATABASE_URL`, DNS names and every non-loopback host, and adds
`default_transaction_read_only=on` before opening a single-connection Prisma
session. The report never stores or prints a connection URL, username/password
pair, token or secret. Its canonical artifact is
`output/database-audit/local-postgres-catalog.json`; generate that artifact only
after the candidate source has settled, then run
`npm run check:local-postgres-catalog-evidence`.

The lane captures and source-binds:

- PostgreSQL full version, numeric version and major;
- database collation, ctype, encoding and timezone;
- installed extension name/version/schema;
- safe `pg_roles` attributes, memberships and database/schema/table/sequence/
  routine grants, without password hashes;
- every source and `_prisma_migrations` name/checksum/status;
- normalized schema/migration source digests;
- every public table's RLS, FORCE RLS and policy counts; and
- a read-only Prisma datamodel comparison plus an explicit unsupported-catalog
  comparison state.

### Current local diagnostic observation

A non-canonical review capture against the recovered literal-loopback target on
14 July 2026 recorded the following before the three runtime-hardening migrations
were added. This is retained historical diagnostic evidence, not current source
parity or production approval; the broad candidate fingerprint can become stale
while other lanes are still writing.

| Observation                 | Result                                                                               | Gate interpretation                                                                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL                  | 15.18; configured local major 15                                                     | Local image/server major matches; production major remains unknown                                                                                                                                             |
| Locale/time                 | `en_US.utf8` collation and ctype; UTF8; UTC                                          | Captured locally; no approved production comparison exists                                                                                                                                                     |
| Extensions                  | `pg_trgm`, `plpgsql`                                                                 | Captured locally; production extension policy remains unverified                                                                                                                                               |
| Migrations                  | 90 source and 90 successful applied rows                                             | Two source/applied checksum mismatches remain: `20260710133000_free_personal_feed_writes` and `20260710134000_add_social_actor_media_foundation`; one resolved rolled-back history row is retained as evidence |
| Prisma datamodel comparison | Differences detected                                                                 | Supplemental migration-managed indexes/defaults require attribution; the diff alone is not mislabeled as catalog drift                                                                                         |
| Application-table RLS       | 107 of 107 application tables enable and FORCE RLS; 232 policies                     | Counts captured; semantic policy parity still requires isolated source replay                                                                                                                                  |
| Prisma metadata RLS         | `_prisma_migrations` is the sole 108th public table and does not enable or FORCE RLS | Reported separately from the application-table denominator; it is migration metadata, not an application data table                                                                                            |
| Current connection role     | `postgres` (superuser/BYPASSRLS)                                                     | **Blocking mismatch**: it cannot prove ordinary application isolation                                                                                                                                          |
| Intended runtime role       | `greyhoundiq_runtime` exists as NOLOGIN, non-superuser, NOBYPASSRLS                  | The observed session did not assume it; its effective application connection path remains unproven                                                                                                             |
| Runtime grants              | 1 schema, 436 table, 1 sequence and 22 routine grant rows                            | Inventory captured; least-privilege necessity review remains open                                                                                                                                              |

The `postgres` versus `greyhoundiq_runtime` mismatch is intentionally a blocking
finding. The audit does not change role membership, grants, schemas or migration
state to make itself pass.

The migration mismatch is also a hard reproducibility blocker and must not be
"fixed" by rewriting history or changing `_prisma_migrations` checksums:

- `20260710134000_add_social_actor_media_foundation`: the applied checksum
  `400ca48529c6a6db9468b447eb1981e60a54dfe4f0a19f119f0b760251244b4b`
  exactly matches commit `8ac7c8fe`; commit `ba5c5872` later changed the checked-in
  file to checksum
  `ef7eac5770405851d1d185c30d175015f2d69b067354d5c996689b48b0827104`.
  This proves an already-applied migration was edited after application.
- `20260710133000_free_personal_feed_writes`: the applied checksum
  `598864395dfca7e0e1bdf9092bc07303ea9f73f995327333f0fd5f9c8da8ad8a`
  matches neither the current/only committed raw checksum
  `383850b696cdfd9149a23652a235e5f66a5c501538551bd1d3bdc57159eba05e`
  nor tested CRLF/no-final-newline variants. This indicates an uncommitted or
  otherwise unavailable migration variant was applied.

Until an owner attributes both histories and demonstrates a fresh isolated
replay from immutable migration sources, the checkout cannot be assumed to
reproduce the observed schema. The safe remediation is a reviewed forward-only
reconciliation migration or a deliberately baselined replacement environment;
historical SQL and applied checksums remain evidence and are not mutated.

Functions, triggers, grants, extensions and policies are not fully represented
by the Prisma datamodel. Replaying migrations in a shadow database on the same
cluster would be unsafe because role DDL is cluster-global. Therefore the lane
records `unsupportedCatalog: observed-only-not-source-replayed` and refuses to
claim zero drift. A future comparison must use an isolated disposable PostgreSQL
cluster, then independently verify the resulting catalog digest.

Still not verified: the production database name/version/locale/extensions;
actual production principals, ownership and grants; TLS; pool sizing/reset
behaviour; topology, replicas and lag; encryption; backups/PITR/retention;
restore evidence; and promotion/reconnect behaviour.

Columns also lack a complete approved owner/classification/retention/deletion
inventory. `security/database-operations.ts` maps only fourteen operations and
does not capture generated SQL or query plans. These are external evidence gaps
owned by database/cloud security and remain production release blockers.
