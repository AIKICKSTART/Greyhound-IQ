# GreyhoundIQ API surface inventory

Status: 24 of 25 surface decisions verified or explicitly not applicable  
Scope: inventory completeness only; individual authentication, authorization, runtime, and deployment evidence remains separately gated  
Owner: Security engineering

The machine authority is `security/api-surface-inventory.ts`. Its test first proves that `security/endpoints.ts` contains every exported HTTP route method and every Next.js server action, then verifies each narrower classification and every not-applicable decision. A category is left open when the repository contains the technology but does not yet have an exhaustive entry-point inventory.

| Surface | Decision | Inventory boundary or reason |
| --- | --- | --- |
| REST/HTTP | Verified | Every exported method from every `src/app/**/route.ts` file |
| GraphQL | Not applicable | No GraphQL handler or runtime dependency |
| tRPC/RPC | Not applicable | No tRPC dependency or `/rpc` endpoint |
| Server actions | Verified | Every exported and inline Next.js server action |
| Server-component data | Verified | Conservative source inventory of every server-page call rooted in an imported binding, direct datastore/provider callback client, or `fetch` |
| WebSocket | Open | LiveKit and Supabase Realtime are used; connections and events are not yet exhaustively classified |
| Server-sent events | Not applicable | No SSE response or EventSource runtime client |
| Authentication callback | Verified | WorkOS `/callback` handler |
| OAuth/OIDC | Verified | WorkOS `/sign-in` and `/callback` handlers |
| Webhooks | Verified | LiveKit, Lago, and Stripe receivers |
| Upload | Verified | Signed direct-upload negotiation and media finalization |
| Media transformation | Not applicable | No resize/transcode/transform endpoint; caption metadata and AI generation are separate surfaces |
| Download | Verified | Private media, signed replay, and account-export responses |
| Export | Verified | Member export response and administrator export creation action |
| Internal | Verified | Every `/api/internal/*` method in the endpoint registry |
| Administration | Verified | Every server action in `src/app/admin/mutations.ts` |
| Worker | Verified | Every exported background maintenance, cleanup, sync, or batch-worker entry function in `src/lib`; runtime wiring remains separately gated |
| Cron | Verified | Cloud Scheduler and scheduled-workflow destinations are bound to live POST routes |
| Queue consumer | Verified | Every source-implemented durable database queue/event consumer; the missing UsageEvent/UsageOutbox delivery consumer remains an explicit implementation gap |
| AI tool | Verified | Agent context, history, execution, cancellation, and dog-card generation |
| Legacy version | Not applicable | All endpoints are unversioned; no `/api/vN` route |
| Development-only | Not applicable | No endpoint is limited to development; Design Lab page controls are separate |
| Health | Verified | `/api/health`, billing, feeds, and readiness |
| Diagnostics | Not applicable | No `/debug` or `/diagnostics` endpoint |
| Metrics exposition | Not applicable | No `/metrics` endpoint; managed observability receives metrics out of band |

## Acceptance boundary

“Verified” here means the surface is exhaustively represented by the current source-discovery rules and its members are tested against the endpoint registry. It does not mean every member is production-ready. Endpoint-level gaps remain visible in the security registry, OpenAPI contract, rate-limit registry, trace registry, database-operation registry, and release-security report.

The WebSocket category remains open until its complete connection and event member sets, source owners, trust boundaries, and fail-closed drift tests are present. Source completion does not promote runtime wiring, deployed parity, or the explicitly unwired UsageEvent/UsageOutbox delivery path.
