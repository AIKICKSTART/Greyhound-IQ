# Application surface discovery

Status: **Partially verified — 45/45 categories decided; production release blocked**  
Evidence date: 2026-07-14  
Authoritative sources: `security/application-surface-inventory.ts`, tested page and endpoint registries, and reviewed scheduler configuration

A completed category proves only exhaustive source-static discovery inside its named boundary. It does not prove deployed parity, authentication, authorization, runtime behavior, provider configuration, or production safety.

## Summary

| Decision | Count |
|---|---:|
| Verified inventory boundary | 37 |
| Not applicable with tested justification | 8 |
| Open | 0 |
| Total immutable requirements | 45 |

The tested inventories bind 103 page routes, 111 route-handler methods, 82 server actions and 7 unique scheduled internal destinations.

## Requirement decisions

| Requirement ID | Decision | Members | Boundary, justification, or known gap |
|---|---|---:|---|
| `security.architecture-application-surface.public-route` | Verified | 70 | Every Next.js page and route-handler method that permits an anonymous request according to the tested page and OpenAPI authentication registries. |
| `security.architecture-application-surface.authenticated-route` | Verified | 144 | Every Next.js page and route-handler method that requires a user, provider, internal, or signed-query identity according to the tested registries. |
| `security.architecture-application-surface.dynamic-route` | Verified | 71 | Every registered page or route-handler path with a dynamic segment. |
| `security.architecture-application-surface.administration-route` | Verified | 32 | Every registered administrator page route. Administrator server actions remain separately covered by server-action discovery. |
| `security.architecture-application-surface.api-route` | Verified | 109 | Every exported HTTP method below /api/. |
| `security.architecture-application-surface.route-handler` | Verified | 111 | Every exported HTTP method in src/app/**/route.ts, including non-API authentication handlers. |
| `security.architecture-application-surface.server-action` | Verified | 82 | Every exported or inline Next.js server action discovered outside route-handler folders. |
| `security.architecture-application-surface.rpc` | Verified | 2 | Every outbound Supabase RPC callsite in production application source. Database routine definitions are inventoried separately; runtime provider parity remains unverified. |
| `security.architecture-application-surface.graphql-query` | Not applicable with justification | 0 | No GraphQL runtime dependency, handler, or application endpoint exists in the tested source inventory. |
| `security.architecture-application-surface.graphql-mutation` | Not applicable with justification | 0 | No GraphQL runtime dependency, handler, or application endpoint exists in the tested source inventory. |
| `security.architecture-application-surface.graphql-subscription` | Not applicable with justification | 0 | No GraphQL runtime dependency, handler, or application endpoint exists in the tested source inventory. |
| `security.architecture-application-surface.trpc` | Not applicable with justification | 0 | No tRPC runtime dependency or application endpoint exists in the tested source inventory. |
| `security.architecture-application-surface.rest` | Verified | 111 | Every source-discovered HTTP route-handler method. |
| `security.architecture-application-surface.websocket` | Verified | 7 | Every Supabase Realtime channel construction, direct WebSocket construction, and LiveKit browser Room/connect call in production source. Runtime provider and deployed connection parity remain unverified. |
| `security.architecture-application-surface.websocket-event` | Verified | 68 | Every source-discovered Supabase publication/subscription event, RealtimeRefresh configured event, LiveKit RoomEvent handler, and LiveKit webhook event branch. Runtime delivery remains unverified. |
| `security.architecture-application-surface.sse` | Not applicable with justification | 0 | The tested source inventory found no text/event-stream response or EventSource runtime client. |
| `security.architecture-application-surface.upload` | Verified | 2 | Application-controlled direct-upload negotiation and finalization entry points. |
| `security.architecture-application-surface.signed-upload` | Verified | 1 | The server endpoint that creates a constrained signed upload target. |
| `security.architecture-application-surface.download` | Verified | 4 | Private media, replay, and account-export response endpoints. |
| `security.architecture-application-surface.auth-callback` | Verified | 1 | Authentication provider callback handlers. |
| `security.architecture-application-surface.payment-return` | Verified | 3 | Stripe Checkout, bespoke Checkout, and billing-portal browser return pages. |
| `security.architecture-application-surface.payment-webhook` | Verified | 2 | Billing-provider webhook receivers. |
| `security.architecture-application-surface.provider-webhook` | Verified | 1 | Non-payment provider webhook receivers. |
| `security.architecture-application-surface.internal-service` | Verified | 12 | Every source-discovered internal HTTP service entry point. |
| `security.architecture-application-surface.scheduled-task` | Verified | 7 | Every unique internal HTTP destination declared by the reviewed Cloud Scheduler configurations. |
| `security.architecture-application-surface.cron` | Verified | 7 | Every unique internal HTTP destination declared by the reviewed cron and Cloud Scheduler configurations. |
| `security.architecture-application-surface.queue-publisher` | Verified | 10 | Every durable database queue, outbox, notification, and webhook-event create/createMany/upsert operation in production application source. |
| `security.architecture-application-surface.queue-consumer` | Verified | 6 | Every source-implemented durable database queue/event consumer entry function. UsageEvent and UsageOutbox remain explicitly unwired implementation gaps, not undiscovered consumers. |
| `security.architecture-application-surface.worker` | Verified | 17 | Every exported background maintenance, cleanup, sync, or batch-worker entry function in src/lib. Runtime scheduling and deployment wiring remain separately gated. |
| `security.architecture-application-surface.database-trigger` | Verified | 22 | Every active PostgreSQL trigger after ordered CREATE/DROP replay of the tracked Prisma migration set. |
| `security.architecture-application-surface.database-function` | Verified | 62 | Every PostgreSQL function or procedure defined by tracked Prisma migrations and reviewed Supabase policy SQL, with application, migration-temporary, and Supabase Realtime database scopes kept distinct. |
| `security.architecture-application-surface.search-index` | Verified | 87 | Every tracked PostgreSQL full-text, trigram, prefix, ListingSearchIndex, and aggregate materialized-index operation in application, migration, seed, and benchmark sources. No external search runtime is declared. |
| `security.architecture-application-surface.cache` | Verified | 288 | Every tracked process-cache call, Next cache invalidation/directive, route cache mode, fetch cache mode, and HTTP/browser Cache-Control operation. Deployed CDN configuration remains a separate runtime gate. |
| `security.architecture-application-surface.ai-tool` | Verified | 7 | Agent execution, history, cancellation, and AI image-generation entry points. |
| `security.architecture-application-surface.admin-cli` | Verified | 76 | Every package-exposed or directly executable script with source-static database, cloud, container, storage, worker, or HTTP state-change signals. Authorization and runtime side effects remain separately gated. |
| `security.architecture-application-surface.design-lab-simulation` | Verified | 4 | Every registered page in the Design Lab route tree; simulations reuse these product pages with isolated fixtures rather than dedicated HTTP endpoints. |
| `security.architecture-application-surface.legacy` | Not applicable with justification | 0 | Every source-inventoried endpoint is unversioned and no /api/vN route exists. |
| `security.architecture-application-surface.deprecated` | Not applicable with justification | 0 | No API version exists in the exhaustive source route inventory, so no deprecated API version can be enumerated. |
| `security.architecture-application-surface.debug` | Not applicable with justification | 0 | No /debug or /diagnostics page or HTTP endpoint exists in the exhaustive source route inventories. |
| `security.architecture-application-surface.source-search` | Verified | 6 | Source page, endpoint, server-action, and scheduler definitions. |
| `security.architecture-application-surface.framework-search` | Verified | 3 | Framework, package, and deployment route configuration. |
| `security.architecture-application-surface.test-search` | Verified | 5 | Tests and API documentation that fail on route or operation drift. |
| `security.architecture-application-surface.client-search` | Verified | 4 | Generated API client and native iOS/iPadOS/Android project discovery scoped strictly to the E:/greyhoundiq repository workspace. Separately owned native repositories are outside this proof. |
| `security.architecture-application-surface.email-worker-search` | Verified | 5 | Every source-controlled mailto link, email SDK import, email sender call, and email worker declaration, including explicit scoped absence decisions. Provider-managed delivery is outside this proof. |
| `security.architecture-application-surface.not-route-folder-only` | Verified | 4 | Discovery sources outside src/app route folders. |

## Open boundary

All 45 application-surface categories now have source-static decisions. Separately owned native repositories, runtime provider/deployment parity, deployed connections, email-provider delivery, and administrative authorization remain outside this proof. Source inventory completion does not close the explicit unwired UsageEvent/UsageOutbox delivery implementation gap or any runtime/deployment gate.

## Release boundary

These decisions are working-tree source evidence. Authorised immutable-candidate and deployed-surface comparisons remain release-blocking, and source-static completion must not be interpreted as a secure or production-ready application.
