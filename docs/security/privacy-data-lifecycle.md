# Privacy and data lifecycle

Status: **Partially verified — blocked from release**
Evidence date: 2026-07-13
Owner: GreyhoundIQ privacy lead

This is an engineering privacy map, not legal advice. Applicability, collection notices, lawful/operational purposes and retention must be approved by the privacy owner before production.

## Australian baseline

[APP 11](https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-11-app-11-security-of-personal-information) requires reasonable technical and organisational steps to protect personal information from misuse, interference, loss, and unauthorised access, modification or disclosure. When information is no longer needed for a permitted purpose, reasonable steps must be taken to destroy or de-identify it unless an applicable law or court/tribunal order requires retention. This includes copies held by service providers and, where reasonable, archived or backup copies; a provider instruction should be verified.

The [NDB quick-reference guidance](https://www.oaic.gov.au/privacy/notifiable-data-breaches/quick-reference-guide-for-responding-to-data-breaches) requires reasonable steps to complete assessment of a suspected eligible breach within 30 calendar days after awareness of the grounds for suspicion. If an eligible breach is established and serious harm has not been prevented by remedial action, affected individuals and the OAIC must be notified as soon as practicable, subject to applicable exceptions. Thirty days is a maximum assessment period, not a notification waiting period.

## Personal-information inventory

| Data class | Examples and source | Purpose / user visibility | Storage and disclosures | Lifecycle evidence | Status |
|---|---|---|---|---|---|
| Identity/contact | WorkOS subject, email, name, verification state | Sign-in, account, support; user/admin | PostgreSQL; WorkOS | Local deletion scrubs identity/social actor after 30-day grace; remote identifiers are retained for reconciliation | WorkOS cancellation/deletion and session revocation Not verified; `SEC-H-002` |
| Profile/social graph | Display name, avatar, role, visibility, friend/follow/block | Community identity and privacy | PostgreSQL; public/member views; Supabase media | Profile record retained/anonymised on deletion path | Complete purpose/retention Not verified |
| Greyhound ownership | Dog/profile link, evidence/verification | Ownership and marketplace trust | PostgreSQL, media storage, moderators | Review and deletion rules not fully mapped | Not verified |
| Community content | Posts, comments, threads, reactions, reports | Publishing and moderation | PostgreSQL, notifications, public/private views | Author content scrubbed in deletion maintenance | Counterparty/share/cache lifecycle Not verified |
| Private messages | Conversation, body, recipients, receipts, reactions | Participant communications | PostgreSQL, Supabase Realtime, notifications | Deletion now tombstones only rows where the deleting profile is `senderId`; focused test protects counterparty-authored bodies | Full lifecycle/runtime retest pending under `SEC-H-002` |
| Call metadata | Room, participants, invites, lifecycle events | Voice/video connection and safety | PostgreSQL and LiveKit | Media content recording not observed | Provider retention Not verified |
| Media | Filename, MIME, size, hash, object key, attachment link | Profile/listing/message files | PostgreSQL and Supabase/GCS; scanner | DB media is tombstoned and durable per-user private/public prefix jobs delete at most 500 objects per batch after exact bucket/prefix validation, with lease recovery and success/failure audit | Live storage execution, derived copies and backup expiry remain Not verified; `SEC-H-002` |
| Marketplace | Listing, seller, price, location, enquiry, saved state | Sale discovery and contact | PostgreSQL, public listing/media | Listing archive fields exist | Retention and enquiry deletion Not verified |
| Support/feedback/bugs | Ticket, message/body, category/priority | Customer support and product improvement | PostgreSQL; support/admin | No approved schedule identified | Not verified |
| Billing metadata | Stripe/Lago customer/subscription/invoice/payment IDs, tier | Billing and entitlement | PostgreSQL plus providers; owner/billing/admin | Browser card data not handled in reviewed code | Provider/legal retention Not verified |
| Consent/compliance | Terms acceptance, consent events, marketing preference | Compliance and preference record | PostgreSQL; account/admin | Models exist | Required retention/legal basis Not verified |
| Usage/telemetry | Usage events, quotas, request/IP/user-agent in selected audits | Billing, abuse, operations | PostgreSQL and Cloud logs | No approved retention identified | Not verified |
| AI data | Prompt/input, output, memory, context, tool invocation and error | AI assistance and continuity | PostgreSQL and any configured AI provider | Deletion scrubs memory/context/run fields locally | Provider retention and sensitive-value policy Not verified |
| Racing source data | Public provider records, source/raw payloads, replay URLs | Racing intelligence/provenance | PostgreSQL/raw archives/providers | Primarily public/operational; may contain trainer/owner names | Classification and retention Not verified |
| Audit/security logs | Actor, target, reason, IP, user-agent, metadata, error | Security, compliance, incident response | PostgreSQL and Cloud Logging | No approved retention/integrity proof | Not verified; correlation gap `SEC-H-010` |
| Webhook payloads | Stripe/Lago event JSON and safe headers | Billing reconciliation | PostgreSQL plus provider | Full raw payload currently retained | Minimisation/retention Control missing |
| Export artifacts | Explicitly selected account data, size/status/expiry | User access/export | Private `no-store` JSON response plus `ExportArtifact` metadata | Collections cap at 500, nested media at 20, response at 8 MiB; unsafe provider/storage/raw-agent fields are excluded and forbidden keys fail closed | Focused test and 108-test source suite pass; runtime BOLA, managed large export and GET-side-effect review pending under `SEC-H-003` |

## Retention register

| Record | Implemented value | Required decision/evidence |
|---|---|---|
| Account deletion grace | 30 days in `src/lib/account-service.ts` | Confirm notice, recovery, re-auth and legal basis |
| User export artifact metadata | Seven-day `expiresAt` in `src/app/api/users/me/export/route.ts` | Prove cleanup and any generated object deletion |
| Realtime auth/grant | Five-minute token and ten-minute grant in `src/lib/realtime-service.ts` | Prove revocation/expiry in staging |
| LiveKit participant token | Ten minutes in `src/lib/call-token.ts` | Confirm provider room/token policy |
| Media entitlement retention display | 30/365/730-day tier defaults in `src/lib/billing/entitlements.ts` | Define whether this is product availability or legal deletion; implement jobs |
| Posts/comments/messages/listings/support | No approved schedule found | Privacy/product/legal owner decision and enforced job |
| Audit/security logs | No approved schedule found | Balance incident/legal needs with minimisation |
| Webhook raw payloads | No approved schedule found | Minimise fields and set deletion job |
| Billing/invoices | No approved schedule found | Finance/legal/provider requirements |
| Racing raw archives | No approved schedule found | Provider licence and provenance requirements |
| AI prompt/output/memory | No approved schedule found | Product purpose, user controls and provider terms |
| Backups | Backup bucket exists by deployment plan; no approved retention | Define encrypted retention, access, deletion and restore testing |

## Deletion contract

Deletion must be a tracked, idempotent lifecycle rather than a single database update:

1. Verify the requester and apply any required re-authentication.
2. Record the request, scope, grace period and legal-retention exceptions.
3. Revoke sessions and new processing while recovery is pending.
4. At finalisation, delete or de-identify only the deleting user's content without changing another person's authored record.
5. Delete or de-identify database rows, search indexes, caches, Realtime grants and notifications.
6. Delete storage objects and derived variants, not only `MediaAsset` rows.
7. Issue and verify deletion with WorkOS, Stripe/Lago where allowed, LiveKit, storage, analytics and AI providers.
8. Mark backup copies beyond use until normal expiry and prevent restoration from reactivating deleted data.
9. Record an audit-safe deletion ledger without retaining the deleted content.
10. Report partial failure to an operational queue and retry idempotently.

`runAccountDeletionMaintenance` now implements step 4 for sender-authored messages and a durable, bounded, exact-prefix form of step 6. Storage jobs audit success/failure and recover expired leases. All 108 source unit tests, typecheck, lint and build passed after the change. Steps 3, 7 and 8 remain incomplete: WorkOS/Stripe remote records are deliberately not deleted or cancelled, their identifiers remain server-side for reconciliation, provider session revocation is not evidenced, managed-page last-owner transfer is unresolved, and backup expiry is not verified. Product/admin output truthfully records `reference_retained_remote_record_not_deleted`. `SEC-H-002` remains release-blocking pending those controls and authorised staging lifecycle evidence.

## User promises

Product copy must not promise immediate permanent deletion while the 30-day recovery window, legal retention, provider processing or backup expiry applies. Export copy must state the real scope, format, expiry and processing status. No AI provider use or retention may be implied as private/local without verified configuration.
