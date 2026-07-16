# Database query map

Status: **Partially verified — release blocked**  
Evidence date: 2026-07-14  
Authoritative source: `security/database-operations.ts`

| Query ID | Source operation | Tables | Bound/maximum | Security predicate or policy | Status |
|---|---|---|---|---|---|
| `DB.BILLING.STRIPE_WEBHOOK_EVENT.INSERT` | `ingestStripeWebhook` / `tx.webhookEvent.create` | WebhookEvent | One row | `giq_webhook_event_system`; unique provider ID/hash | Partially verified |
| `DB.PULSE.CONVERSATION.ACCESS.SELECT` | `getConversationForProfile` / `findFirst` | Conversation | 0–1 | ID plus participant predicate; `giq_conversation_select` | Partially verified |
| `DB.PULSE.CONVERSATION.BLOCK.UPDATE` | `setConversationBlock` / `update` | Conversation | Exactly 1 | prior object access; `giq_conversation_update` | Test coverage missing |
| `DB.PULSE.USER_BLOCK.UPSERT` | `setConversationBlock` / `upsert` | UserBlock | Exactly 1 | actor/blocked profile relation; `giq_user_block_access` | Test coverage missing |
| `DB.PULSE.REALTIME_GRANT.REVOKE` | `revokeConversationRealtimeGrants` / Supabase delete | RealtimeTopicGrant | Bounded by two participant profiles | topic/profile/extension predicate; `giq_realtime_topic_grant_system` | Partially verified |
| `DB.MEDIA.ASSET.STATUS.SELECT` | `getMediaStatusForCurrentUser` / `findFirst` | MediaAsset | 0–1 | ID/uploader/not-deleted; `giq_media_select` | Partially verified |
| `DB.MEDIA.ASSET.DELETE.TOMBSTONE` | `deleteMediaForCurrentUser` / `updateMany` | MediaAsset and media-link tables | Exactly one root row | ID/uploader/not-deleted; `giq_media_update` | Partially verified |
| `DB.ACCOUNT.DELETION.REQUEST.TRANSACTION` | `requestAccountDeletion` / request transaction | Profile, User, AuditLog | One user | current user plus last-owner/admin checks and RLS | Partially verified |
| `DB.ACCOUNT.DELETION.PENDING.SELECT` | maintenance / `user.findMany` | User, Profile | At most 25 | system context and due status | Partially verified |
| `DB.ACCOUNT.DELETION.FINALIZE.TRANSACTION` | maintenance / bounded per-user transaction | User, Profile, SocialActor, Message, Post, Thread, Listing, MediaAsset, AI/context, DeletionJob, AuditLog | One candidate per transaction | system policies; sender-only message tombstone | Partially verified |
| `DB.ACCOUNT.DELETION.STORAGE_JOBS.PROCESS` | storage worker / bounded job claim-update | DeletionJob, AuditLog | At most 10 jobs, 500 keys/job step | system context and exact user prefixes | Partially verified |
| `DB.ACCOUNT.DATA_EXPORT.READ` | export POST / explicit owner-scoped selects | User, Profile, DogOwnership/Dog, Thread/Post, Listing/Media, Conversation/Message, MemoryEntry, AgentRun | Root collections capped at 500; nested media 20 | current user and relevant RLS policies | Partially verified |
| `DB.ACCOUNT.DATA_EXPORT.AUDIT.INSERT` | export POST / `createAuditLog` | AuditLog | One row | `giq_audit_log_insert` | Partially verified |
| `DB.ACCOUNT.DATA_EXPORT.ARTIFACT.INSERT` | export POST / `exportArtifact.create` | ExportArtifact | One row | owner insert/write policies | Partially verified |

All fourteen records declare parameterized Prisma/Supabase operations and bounded expected cardinality. `output/database-audit/demo-fixture-idempotency.json` now binds the conversation-access and media-status reads to an isolated literal-loopback port-55734 replay as the exact `greyhoundiq_runtime` role in `greyhoundiq/public`. It proves participant/owner success, non-participant/other-owner denial, missing-object denial, zero controlled-row deltas and exact-ID cleanup. That is local runtime evidence for only those two operations, not staging or production proof. The runtime database name, schema/search path and principal remain uncaptured for every other record. No record contains safely captured generated SQL or EXPLAIN-plan evidence. Default Prisma/PostgreSQL isolation is not independently confirmed, and several concurrency strategies are unverified.

## Coverage decision

Fourteen operations are a seed, not the actual query surface of 177 endpoints, 73 server actions and 107 Prisma models. Database security owner must capture normalized SQL with named placeholders, actual role, selected/written columns, tenant/ownership/visibility predicates, bounds, transaction/locks, constraints, timeouts and representative plans in authorised staging. Values, credentials and private query logs must not be copied. Until every trace has linked query IDs and negative/rollback tests, query coverage is **Not verified** and release remains blocked.
