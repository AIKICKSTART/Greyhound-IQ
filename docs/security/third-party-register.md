# Third-party register

Status: **Source inventory complete; runtime/provider controls remain release-blocking**  
Evidence date: 2026-07-15  
Machine source: `security/third-parties.ts`  
Drift proof: `security/third-party-inventory-evidence.test.ts`

The source-visible inventory contains 18 external boundaries. Each machine record includes purpose, data sent/received, personal information, credential handling, environments, hosts, TLS, timeout, retry, circuit/rate/cost controls, response validation, webhook security, retention/logging/subprocessors, fallback, contact, owner, source files, evidence and verification status.

| Provider or boundary | Primary purpose | Source status | Important remaining proof |
|---|---|---:|---|
| WorkOS AuthKit | Authentication and identity | Partially verified | Live grants, session controls, residency, retention and incident contact |
| Stripe | Checkout, subscriptions and signed billing events | Partially verified | Restricted-key scope, live environment separation, retention and operational limits |
| Supabase Realtime | Private broadcast/presence grants | Partially verified | Deployed RLS/origin behavior, project role, residency and recovery |
| Supabase Storage | Private user media | Partially verified | Deployed bucket policy, credential scope, residency, retention and restore |
| Lago | Usage, invoices and signed billing lifecycle | Partially verified | Provider grants, environment separation, retention and deployed delivery evidence |
| LiveKit | Voice/video rooms and signed lifecycle events | Partially verified | Region, recording policy, origin behavior and provider recovery |
| OpenAI | Optional dog-card image edits and pinned CI review | Partially verified | Model/project scope, provider retention, quota and spend caps |
| TheDogs | Race, result, dog and replay data | Partially verified | Contract/quota, production freshness, retention and incident contact |
| FastTrack / GRV | Credentialed Victorian racing data | Partially verified | API-key grant/rotation, quota and production failure evidence |
| Watchdog / GRV | Public form and replay data | Partially verified | Provider contract, quota, freshness and change management |
| Topaz / GRV | Public OpenAPI racing data | Partially verified | Provider contract, schema/version drift and production availability |
| Racing Queensland | Replay discovery/playback | Partially verified | Provider terms, quota, freshness and incident contact |
| Tasracing | Replay discovery/playback | Partially verified | Provider terms plus S3 retention, availability and change control |
| YouTube | Public replay discovery and privacy-enhanced embed | Partially verified | Playback telemetry, privacy terms, quota and availability |
| Vimeo | Greyhounds WA/public replay discovery and embed | Partially verified | Playback telemetry, privacy terms, quota and availability |
| Google Cloud Platform | AU runtime, deployment, secrets, telemetry and target data services | Partially verified | Deployed IAM/network/residency/backup/DR and quota evidence |
| GitHub | Source, CI/CD, dependency updates and release approvals | Partially verified | Live organization, branch/environment protection, retention and recovery |
| Configured notification webhook | Optional notification delivery | Partially verified | Provider selection, contract, residency, retention and incident contact |

The inventory is deliberately not a provider-readiness claim. No record marked `Partially verified` proves provider contracts, subprocessors, live credentials, deployed regions, retention, support contacts, quotas, availability or incident recovery. The notification webhook source now rejects non-HTTPS/credentialed/query-bearing targets, pins DNS to public addresses and refuses redirects; its provider selection and deployed behavior remain unverified.

No provider response or browser return may grant local role, ownership, tenant, subscription or payment authority. Those decisions remain server-side and require their separate authorization, webhook, database and runtime evidence.
