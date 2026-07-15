# Frontend, server and database map

Status: **Partially verified — nine seed paths only**  
Evidence date: 2026-07-14  
Source: `security/traces.ts`, `security/endpoints.ts`, `security/database-operations.ts`

| Trace | Frontend/entry | Transport | Server authority | Datastore/provider | Response/evidence |
|---|---|---|---|---|---|
| `AUTH.CALLBACK.RECOVER` | `/callback`, `/auth/error`; AuthErrorPage retry/support/home links | GET AuthKit callback | `handleAuth`, `classifyAuthCallbackFailure`, `syncAuthUser`; provider state delegated to SDK | WorkOS; local user-sync SQL not captured | Safe allowlisted recovery redirect; callback recovery tests |
| `AUTH.CALLBACK.COMPLETE` | User browser/WorkOS callback at `/callback`; safe `/auth/error` recovery | GET AuthKit callback; proxy-owned request ID | `handleAuth` → `syncAuthUser` → one system-context transaction → payload-free `SignupOutbox`; later token-leased worker | User/Profile/SocialActor/SignupOutbox; WorkOS; worker sink/invoker not bound | Redirect only after local commit; retry/dead-letter source tests; provider/runtime/RLS/sink delivery unverified |
| `BILLING.WEBHOOK.PROCESS` | Stripe server callback, no browser trigger | POST raw body and Stripe signature | signature check, fail-closed rate limit, event-specific settlement validation | `WebhookEvent` insert; Stripe; reducer queries not fully captured | `{ ok, duplicate }` or safe error; settlement/readiness tests |
| `PULSE.CONVERSATION.BLOCK` | conversation block action/route | POST `/api/conversations/[id]/block` | current profile, participant policy, object predicate, rate limit | Conversation select/update, UserBlock upsert, Realtime grant revoke | Updated conversation; realtime authorization test |
| `MEDIA.ASSET.READ` | media-status polling | GET `/api/media/[id]` | current user plus uploader ownership | MediaAsset status select | Explicit status projection; media-service tests |
| `MEDIA.ASSET.DELETE` | delete media control | DELETE `/api/media/[id]` | current user plus uploader ownership, tombstone predicate | MediaAsset tombstone then Supabase Storage removal | Safe result/audit; durable cleanup retry is missing |
| `DESIGN_LAB.SCREEN.REVIEW` | six Design Lab pages and master checklist | server-rendered route | `requireDesignLabReviewer`; exact production flag plus administrator or isolated demo | Synthetic fixture registries; no production database operation registered | noindex preview; policy/isolation tests |
| `ACCOUNT.DELETION.EXECUTE` | account deletion form and worker | POST `/api/users/me/delete`, POST internal worker | current user, confirmation, last-admin/page-owner checks; worker shared-secret gate | User/Profile/content tombstone transaction, bounded DeletionJob storage cleanup, Supabase Storage | Accepted/pending status and audits; WorkOS/Stripe/page-transfer lifecycle remains blocked |
| `ACCOUNT.DATA_EXPORT.DOWNLOAD` | account export form | POST `/api/users/me/export` | current user only; cross-origin mutation rejection, explicit projections and forbidden-field assertion | 11 bounded owner-scoped reads, AuditLog and ExportArtifact inserts | Private no-store JSON or safe 413; async large export absent |

## Boundary gaps

- Frontend action total and trace-ID instrumentation are **Not verified**. Owner: frontend platform. Reason: no complete action-to-handler scan is in the machine registry.
- Middleware/CDN/gateway execution, CSRF and CORS are **Not verified** for most actions. Owner: platform security. Reason: no authorised deployed configuration/traffic capture was supplied.
- Generated SQL, actual database principals, EXPLAIN plans and database audit evidence are **Not verified**. Owner: database security. Reason: no safe staging SQL capture was performed.
- UI success, reconciliation, focus restoration and recoverable-error behaviour are not runtime verified for these traces. Owner: product-area teams.

This map must be generated from the shared trace IDs as coverage grows; prose alone cannot close the gate.
