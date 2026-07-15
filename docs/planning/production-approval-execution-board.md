# Production approval execution board

Updated: 16 July 2026 (Sydney)

This is the deduplicated working board for the remaining production-approval work. The machine registry remains the authority for closure; no item is completed by this document.

## Counter reconciliation

| Source | Verified | Total | Pending | Awaiting verification | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| Current local registry (`npm run check:design-lab-sync`) | 3,735 | 4,271 | 536 | — | Authoritative for the checkout; source-bound audit artifacts are stale after direct app changes. |
| Final-list attachment | 3,735 | 4,282 | 547 | 4 | Contains eleven more total checks than the current checkout. Reconcile its registry revision before any final completion claim. |

## Non-overlapping active workstreams

| Workstream | Owner | Exact scope | Completion proof | Boundary |
| --- | --- | --- | --- | --- |
| Local product gates | Product agent | One distinct source-static product requirement at a time | Focused fail-closed test, lint and typecheck | No shared registry/docs edits, cloud work or billing. |
| Local security gates | Security agent | One distinct source-static security requirement at a time | Focused fail-closed test, lint and typecheck | No application/shared registry/docs edits, cloud work or billing. |
| GCP architecture review | Architecture agent | Existing architecture, Terraform and deployment plans for AlloyDB, LiveKit, Sydney/Melbourne resilience, IAM and cost controls | Evidence-backed gap list and corrected plan proposal | No provisioning, DNS, credentials, billing or production changes. |
| Integration and release evidence | Root | Integrate completed isolated gates, run all required checks, refresh only directly affected source-bound audits | Exact source SHA, passing checks and committed artifacts | Preserve unrelated dirty worktree changes. |

## Ordered production-approval backlog

1. Reconcile the 4,271 versus 4,282 registry revision mismatch; import no unseen requirement without its authoritative source.
2. Commit the current local batch, then refresh the five directly stale route/responsive/user-story/hydrated audit artifacts against that commit.
3. Continue local product/security gates in small independent batches; no duplicate gate ownership.
4. Complete the architecture review and publish corrections for Australian GCP topology, AlloyDB, self-hosted LiveKit, WorkOS, Stripe, backups, monitoring, DR and cost limits.
5. Obtain explicit approval before any action that can incur material GCP cost, enable paid billing, alter DNS, start live payment processing, rotate production credentials, delete data or cause downtime.
6. After approval, provision protected staging first, verify the pre-production gates, then prepare production promotion evidence and request a separate cutover approval.

## Production blockers retained from the final list

- Security: authentication/authorization negative coverage, abuse controls, API-top-ten mapping, audit events, CI enforcement, data minimisation and object authorization.
- Product: action understanding and outcome coverage, route registry secondary actions/data dependencies, field sanitisation/error evidence, complete state fixtures and journeys.
- Pre-production: GCP managed-service parity, AlloyDB bootstrap, LiveKit lifecycle, WorkOS and Stripe test-mode verification, storage, observability, operations, promotion evidence and data-feed governance.

Each blocker stays open until the relevant scope is implemented and independently verified; source-only evidence must not be presented as deployed production proof.
