# Webhook review

Status: **Partially verified**
Evidence date: 2026-07-15
Owner: Billing and integrations owner

## Inventory

| Provider | Endpoint | Verification | Deduplication | Processing | Status |
|---|---|---|---|---|---|
| Stripe | `POST /api/webhooks/stripe` | `verifyStripeWebhook` uses raw bytes and Stripe SDK signature verification | `WebhookEvent.lagoEventId` stores Stripe event ID; payload-hash fallback; unique constraint | Same DB transaction stores and reduces event | Partially verified |
| Lago | `POST /api/webhooks/lago` | HMAC-SHA256, declared algorithm and timing-safe comparison over raw bytes | Provider unique-key or provider/type/payload hash; fenced lease token; unique receipt-to-billing-event relation | Stored event then fenced `reduceLagoWebhook` transaction | Partially verified |
| LiveKit | `POST /api/livekit/webhook` | `WebhookReceiver.receive` with API key/secret | Handler has selected idempotent state transitions; no provider-event ledger observed | `handleLiveKitWebhookEvent` | Partially verified |

## Stripe

Evidence:

- `src/app/api/webhooks/stripe/route.ts` permits POST only, rate-limits fail-closed and passes `request.arrayBuffer()` to the reducer.
- `src/lib/billing/stripe-webhooks.ts` verifies `stripe-signature`, stores a payload hash and safe header subset, records duplicate deliveries, and updates event status.
- Settlement hardening checks checkout status/payment status/mode, exact user/WorkOS/customer/profile bindings, AUD and expected bespoke amount. Subscription entitlement is granted from `invoice.paid` only after settled invoice, customer/subscription binding and allowlisted Pro price.
- `src/lib/billing/stripe-webhook-settlement.test.ts` is focused regression evidence.

Gaps:

- No authorised staging signature/freshness/replay test was captured.
- Complete out-of-order event state-machine tests are missing.
- The receipt retains only event ID, creation time, mode and type; the retention schedule still needs deployed-policy evidence.
- A durable outbox for database-plus-external follow-up was not evidenced.
- Provider API re-fetch policy for disputed/ambiguous state is not documented.

## Lago

Evidence:

- `verifyLagoWebhook` requires `x-lago-signature-algorithm: hmac`, a signature and configured secret, then compares a SHA-256 HMAC using `timingSafeEqual`.
- Stored safe headers exclude the signature.
- Duplicate provider key/hash increments retry count.
- Each reducer claim receives a random processing token. The reducer acquires the receipt row under that exact token before mutating billing state, and terminal updates clear the token.
- `BillingEvent.webhookEventId` is unique, so a provider receipt can commit at most one billing-domain audit event. The forward-only migration fails closed if historical duplicate evidence exists.

Gaps:

- No timestamp/freshness control is visible; confirm whether Lago supplies one and document replay bounds.
- Complete schema validation occurs downstream and was not traced for every event type.
- Out-of-order, delayed and authoritative-provider reconciliation tests are incomplete.
- Raw payload retention/minimisation is undefined.

## LiveKit

Evidence:

- `receiveLiveKitWebhook` delegates signature verification to the LiveKit SDK.
- Invalid verification returns a generic 401 and logs no request body.
- Existing communication checks include idempotent `room_finished` handling.

Gaps:

- Endpoint resource/rate controls are absent based on the assumption that signatures suffice; a valid but replayed or compromised provider credential still needs bounded work.
- No event-ID replay ledger or freshness evidence was found.
- Every supported event, duplicate and out-of-order transition requires a test.

## Required release gate

1. Keep raw-body signature verification before parsing.
2. Add explicit maximum body sizes and processing timeouts.
3. Record provider event IDs and reject replay within a documented window.
4. Validate every payload against an event-specific schema.
5. Reconcile out-of-order billing events against authoritative provider state.
6. Minimise/redact stored payloads and apply a retention schedule.
7. Keep the handler response fast and queue long work with a validated, idempotent payload.
8. Re-run missing/invalid signatures, duplicate delivery, stale-lease takeover, out-of-order delivery, delayed delivery, provider timeout, DB rollback and audit failure against disposable pre-production infrastructure.
