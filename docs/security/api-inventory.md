# API inventory

Status: **Not verified — release blocked**  
Evidence date: 2026-07-14  
Owner: GreyhoundIQ security lead; endpoint owners remain unassigned unless an entry says otherwise

The authoritative source is `security/endpoints.ts`. `api-inventory.json` is the complete, secret-free export generated from that registry. The inventory is source-derived; it is not evidence that the same surface is deployed or that a discovered control works at runtime.

## Source inventory

| Measure | Count | Verification |
|---|---:|---|
| Route-handler files | 83 | Static discovery |
| HTTP methods | 104 | Static discovery |
| Server actions | 73 | Static discovery |
| Total endpoint records | 177 | Registry structure only |
| Partially verified | 13 | Focused source/test evidence; no staging attestation |
| Not verified | 164 | Release-blocking |
| Authentication unknown | 163 | Release-blocking |
| Authentication required | 10 | Metadata present, not complete runtime proof |
| Public | 2 | `/callback`, `/sign-in` |
| Provider signature | 1 | Stripe webhook |
| Internal secret | 1 | Account-deletion worker |

The 13 partially verified entries are account-deletion request/worker/server action, user export, conversation block server action/route, conversation delivery acknowledgement route, media read/update/delete, callback, sign-in and Stripe webhook. Their exact methods, source files, policies, schemas, database IDs, tests and known gaps are in `api-inventory.json`.

## Coverage judgment

- The source OpenAPI document covers the same 83 paths and 104 HTTP methods, but no deployed route list, gateway/CDN configuration, WebSocket event registry, queue consumer registry or runtime traffic comparison was supplied. Deployed-surface parity is **Not verified**; owner: platform security; reason: authorised environment evidence is unavailable in this review.
- No endpoint is marked deprecated, but 176 of 177 deprecation statuses are `unknown`. This is not proof that legacy APIs are absent; owner: API governance.
- Only 13 entries name an authorization policy, 9 link a database operation and 11 link a test in the current export. Missing metadata is release-blocking, not an accepted exclusion.
- The registry validator proves source files/handlers exist and IDs are unique. It does not prove authentication, BOLA/BFLA, CSRF, CORS, rate limits, output minimisation, idempotency or safe failure.

## Required closure evidence

For each of the 177 records, the responsible product-area owner must supply authentication, server policy, object/property/tenant policy, request/output schema, resource budget, idempotency, datastore/provider links, audit/log events and negative tests. Platform security must then compare this source inventory with one immutable staging candidate and all deployed gateway, webhook, worker and realtime entry points. Until both steps pass, the API inventory remains **Not verified** and production promotion remains blocked.
