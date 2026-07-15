# Data classification register

Status: **Partially verified — column-level mapping incomplete**  
Evidence date: 2026-07-13  
Authoritative source: `security/data-classification.ts`

| ID | Classification | Personal | Sensitive | Permitted logging | Retention | Status |
|---|---|---:|---:|---|---|---|
| `PUBLIC` | Intentionally public content | No | No | Request metadata; no credentials/private content | Not verified | Not verified |
| `INTERNAL` | Operational/service metadata | No | No | Sanitised operational metadata only | Not verified | Not verified |
| `SYNTHETIC_PRIVATE` | Synthetic private fixture data | No | No | Reserved `demo-*` identifiers, fixture counts and deterministic hashes; never database credentials or provider payloads | Delete with the isolated Design Lab database; never promote or copy these rows into production | Partially verified |
| `PERSONAL` | Identified or reasonably identifiable person data | Yes | No | Identifiers only where necessary; no content values | Not verified | Not verified |
| `AUTHENTICATION` | Session/callback/identity/recovery security data | Yes | Yes | Outcome, safe reason, correlation ID; never tokens/payload | Not verified | Partially verified |
| `FINANCIAL` | Billing, invoice, payment and entitlement data | Yes | Yes | Provider event ID/safe status; never card/signature | Not verified | Partially verified |
| `PRIVATE_COMMUNICATION` | Messages, conversation/call membership and relationship controls | Yes | Yes | Opaque IDs/outcomes; no bodies/private media | Not verified | Not verified |
| `USER_MEDIA` | Uploaded and derived media/metadata | Yes | Yes | Opaque media/storage coordinate only; never bytes/URLs/tokens | Not verified | Partially verified |
| `AUDIT_SECURITY` | Audit and security telemetry | Yes | Yes | Actor/target/action/outcome and sanitised metadata | Not verified | Partially verified |

## Synthetic private fixtures

`SYNTHETIC_PRIVATE` rows use reserved `demo-*` identifiers, `.test` email
addresses and an approved, byte-hashed asset manifest. Fictional portrait
provenance explicitly declares that the image is generated and is not based on
a real person. The fixture seeder validates every approved image hash and byte
length before opening its write transaction, so replacing an approved path with
different bytes fails closed. These rows model private product behaviour but are
not personal information and must never be promoted or copied into production.

## Datastore scope

The Prisma schema contains 107 models. Public racing candidates include Dog, Trainer, Track, Meeting, Race, RaceVideo, Runner, Result and FormEntry, but publication status and source terms still govern visibility. Identity/account/support/team models, including the payload-free SignupOutbox user reference, are PERSONAL, AUTHENTICATION or INTERNAL. BillingCustomer, Subscription, WebhookEvent, invoice/payment/refund/credit-note/billing/usage models are FINANCIAL. Conversation, Message, delivery/read/reaction/presence/block and Call models are PRIVATE_COMMUNICATION. MediaAsset and all media-link models are USER_MEDIA. AgentRun, MemoryEntry and ConversationContext can contain PERSONAL or PRIVATE_COMMUNICATION data and require explicit AI-use classification. AuditLog, AdminAction, JobRun, RateLimit and security/report records are AUDIT_SECURITY/INTERNAL.

This is a class-level register, not the required per-table/per-column privacy inventory. Purpose, collection basis, owner, residency, encryption, retention, deletion/de-identification, backup expiry, export eligibility, search/log/analytics/AI eligibility and third-party disclosure remain unverified for most fields. Privacy owner: GreyhoundIQ privacy lead; reason: legal/operational decisions and live provider configuration were not supplied. APP 11/NDB mapping and release approval remain blocked until the personal-information inventory is approved and tested.
