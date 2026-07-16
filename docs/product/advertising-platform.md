# GreyhoundIQ advertising and Marketplace boost contract

Status: Design Lab proposal only; not implemented, for sale or available in production  
Snapshot: 2026-07-13 AEST  
Owner: Product, commercial, engineering, security and legal

## Decision

GreyhoundIQ may add two separately gated paid-distribution products:

1. advertiser campaigns in scarce, clearly labelled Feed placements; and
2. seller-funded boosts for approved Marketplace listings in the five-card premium Feed module.

The commercial model is prepaid booked viewable impressions, not an auction. Paid content never changes organic Feed order and never buys editorial treatment, search rank or a fixed Marketplace card position.

This document is a product contract, not launch evidence. The current Design Lab rate card, controls and stories are provisional. No advertiser or seller may purchase inventory until every production gate in this document has evidence and the rate card is formally published.

The core business forecast remains subscription-only. Advertising and Marketplace boost revenue are excluded from every forecast until traffic, legal, privacy, delivery, refund and rate validation are complete.

## Product boundaries

| Surface | Buyer | Unit sold | Placement promise | Phase-one boundary |
| --- | --- | --- | --- | --- |
| Feed advertising | Verified advertiser | Prepaid viewable impressions | Eligible delivery within a placement, schedule and hard budget | First-party static creative only |
| Marketplace boost | Seller who owns the listing | Fixed prepaid viewable-impression package | Equal rotation in a five-card sponsored Marketplace module | Approved, active and unsold listings only |

Advertising must remain separate from organic `FeedPost` data and subscription billing catalogues. Existing `Listing`, private scanned `MediaAsset`, administrator authorization and audit foundations may be referenced, but paid orders, delivery and reconciliation need their own records.

Wagering advertising is disabled. Enabling it requires a separately approved legal, jurisdiction, age-audience, category and responsible-advertising control set.

## Provisional pricing

Rate-card version: `DL-AUD-2026-07-13`  
Currency: AUD  
Public price display: GST included  
Billable unit: viewable impression, defined as at least 50% of the placement visible for one continuous second  
Quote lock: 30 minutes  
Maximum campaign size: 10,000,000 booked viewable impressions

### Advertiser placements

| Placement | Inventory rule | Desktop asset | Mobile asset | Base vCPM incl. GST | Minimum | Minimum base order incl. GST | Per-session cap | Same campaign/person/day |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| Feed inline | After at least 8 organic Feed entries | 1600 x 700 px, 16:7 | 1080 x 1350 px, 4:5 | $27.50 | 10,000 | $275.00 | 3 | 2 |
| Premium Feed billboard | After at least 12 organic Feed entries | 1600 x 500 px, 16:5 | 1080 x 1080 px, 1:1 | $44.00 | 10,000 | $440.00 | 1 | 1 |
| First premium session slot | First eligible slot, never before 4 organic entries | 1600 x 700 px, 16:7 | 1080 x 1350 px, 4:5 | $60.50 | 20,000 | $1,210.00 | 1 | 1 |

### Published quote factors

| Factor | Values |
| --- | --- |
| Targeting | Broad 1.00x; contextual 1.15x; event or geographic 1.25x |
| Schedule | Standard 1.00x; premium event 1.20x |
| Volume discount | 0%, 5%, 10% or 15% |

The server selects factors from an immutable published rate-card version. The buyer cannot submit a price, multiplier or discount. The discount eligibility thresholds are not yet approved; no non-zero discount may be commercially published until a versioned threshold rule is approved.

For booked impressions above a placement minimum, the GST-inclusive quote is calculated once in integer cents:

`ceil(booked impressions x base vCPM cents x targeting factor x schedule factor x discount factor / 1,000)`

The stored quote contains the rate-card version, every factor, subtotal excluding GST, GST and total including GST. Intermediate rounding is forbidden. Values outside the published options, campaign maximum or safe integer range fail closed.

### Marketplace boost packages

| Package | Viewable impressions | Price incl. GST | Delivery window |
| --- | ---: | ---: | ---: |
| Starter boost | 2,000 | $29.00 | Up to 14 days |
| Momentum boost | 10,000 | $119.00 | Up to 30 days |
| Showcase boost | 25,000 | $249.00 | Up to 45 days |

Boost packages use a fixed public price. They do not inherit advertiser targeting or event multipliers. Undelivered booked impressions at expiry receive the published make-good credit or pro-rata refund; that policy must be approved before sales open.

## Creative and Marketplace rules

- Accept static WebP, JPEG or PNG only. Decoded MIME, exact dimensions and file hash must agree.
- Require desktop and mobile variants, meaningful alt text and a maximum of 2 MB per asset.
- Reject SVG, GIF, video, HTML, JavaScript, executable content, third-party pixels and advertiser cookies in phase one.
- GreyhoundIQ renders immutable `Sponsored`, advertiser identity, `Why this ad`, hide and report controls.
- Claims, public prices and destinations must be accurate, current and substantiated, with GST displayed clearly.
- Permit approved HTTPS destinations only on a verified advertiser domain. Revalidate redirects and reject open redirects.
- Reject illegal goods, animal cruelty, disguised editorial content, deceptive urgency, sensitive-trait or discriminatory targeting.
- A seller may boost only their own approved, active, unsold listing with approved clean media and an account in good standing.
- Recheck listing ownership, moderation, active/sold state, media safety and seller standing at the decision and impression boundaries.

Creative replacement creates a new immutable version and review. It never overwrites the version attached to an earlier quote, order, rejection or delivery record.

## Delivery contract

- Never render paid modules consecutively.
- Cap the combined advertiser-plus-boost load at three paid modules per 20 organic Feed entries and four paid modules per person per session.
- Apply the stricter placement, campaign, session, per-person and Marketplace caps in addition to the global cap.
- Anchor each paid decision after a stable organic entry. Realtime updates must not duplicate, omit or reorder organic content.
- Recheck account, campaign, schedule, approval, payment, creative, destination, remaining inventory and frequency eligibility at decision and impression time.
- Decrement booked inventory atomically only after a signed idempotent delivery token proves the viewability rule. Concurrent requests cannot overspend or overdeliver.
- Treat the five-card Marketplace carousel as one paid module. Use equal rotation across eligible sellers, show five distinct sellers when inventory permits and never sell a fixed card order.
- Cap one boosted listing at one appearance per session and two viewable appearances per person per day.
- Do not record a billable view, click or spend from client claims alone.

## Lifecycle states

The server owns transitions. Browser parameters, success redirects and administrator form fields cannot manufacture payment or delivery state.

Primary flow:

`draft -> submitted -> approved-pending-payment -> checkout-pending -> paid-scheduled -> live -> completed`

Controlled exception or terminal states:

`rejected`, `paused`, `cancelled`, `expired`, `refunded`, `late-payment-review`, `payment-mismatch-review`

Every transition records actor, reason, prior state, next state, timestamp and immutable evidence reference. Approval must precede Checkout so rejected creative does not create avoidable refunds. A paid change to budget, placement or schedule requires a new quote or an explicit bounded credit/refund; delivered spend is never rewritten.

## Payment and reconciliation contract

- Create one server-side Stripe Checkout Session in `payment` mode for an immutable AUD order. Use dynamic payment methods; do not hardcode `payment_method_types`.
- Ignore browser prices. Bind the request to the authenticated buyer, owned campaign or listing, rate-card version, quote hash and order-and-quote idempotency key.
- Give the stored quote and Checkout Session the same 30-minute expiry. Expire unpaid reservations automatically.
- Use separate test and live restricted keys and webhook secrets from the approved secrets manager. Never expose or log credentials, raw provider payload secrets or environment dumps.
- Verify the Stripe signature against the raw webhook body before processing. Bind the event to the configured environment and store the provider event ID for idempotent replay handling. An IP allowlist is defense in depth, not a replacement for signature verification.
- Activate only when the Checkout Session has `status=complete`, `payment_status=paid`, `mode=payment`, the expected AUD amount, exact customer, order metadata, quote hash and environment.
- Treat the success URL as display-only. It never reserves or activates inventory.
- Send late, duplicate-conflicting or mismatched payments to review without activation. Refunds and make-good credits preserve the original order, rate-card and tax snapshot.
- Record subtotal, GST, total and tax-invoice fields. Enable Stripe automatic tax only after required registrations and Australian tax advice are confirmed.
- Reconcile quote, Checkout Session, payment, invoice, delivered inventory, credit and refund against one immutable order ledger.

Administrators may approve a refund or credit with a mandatory reason, but cannot edit provider settlement facts or force a campaign into `paid-scheduled`.

## Administration and governance

Administrators need scoped controls for:

- advertiser verification, terms acceptance, verified domains, suspension and reactivation;
- immutable rate-card versions, price floors, factor rules, quote expiry and sellable inventory;
- creative, claim and destination review with reviewer, reason, malware result and version history;
- global, placement, campaign, session and per-person frequency caps;
- scheduling, campaign pause, scoped placement pause and emergency global kill switch;
- make-good credits, refunds, delivery/spend reconciliation and tax-invoice access; and
- aggregate viewable-impression, click, spend and remaining-inventory reporting.

Every privileged mutation requires current authorization, object-level scope, a confirmation step, mandatory reason, `AdminAction` and `AuditLog`. High-risk changes need a second reviewer before publication. Historical rate cards, orders, reviews, invoices and metrics are append-only from the administrator UI.

## Privacy contract

- Use a first-party HTTP-only pseudonymous frequency-cap key. Never expose raw account IDs to creatives or advertisers.
- Do not retain raw IP addresses in advertising events.
- Expire pseudonymous cap keys within 48 hours and raw view/click telemetry within 30 days.
- Retain aggregate advertiser reporting for up to 24 months and order, refund, tax and financial records for up to five years, subject to Australian privacy, records and tax sign-off.
- Let members inspect `Why this ad`, hide or report an ad and opt out of non-essential personalization without losing the organic Feed.
- Do not accept advertiser pixels, cookies, device graphs, data-broker audiences, cross-site tracking or sensitive-trait segments.
- Access, correction, deletion and consent workflows must remove or de-identify viewer-linked data while preserving only legally required restricted financial records.
- Advertiser reports expose aggregate campaign data only, never raw viewer identities or cap keys.

## Proposed data model

No advertising tables are implemented yet. The minimum production schema should be reviewed as a forward-only Prisma migration:

| Record | Purpose and critical relationships |
| --- | --- |
| `AdvertiserAccount` | Owner/organization, verification state, verified domains, terms evidence and suspension history |
| `AdPlacement` | Placement identifier, responsive spec, inventory rule and default caps |
| `AdRateCardVersion` | Immutable publication window, currency, GST display, quote limits and approval evidence |
| `AdRate` | Placement price, minimum, allowed factors and discount rule for one rate-card version |
| `AdCampaign` | Advertiser or seller owner, placement/boost kind, schedule, targeting, budget, state and optional owned `Listing` reference |
| `AdCreative` | Campaign version, private scanned `MediaAsset` variants, alt text, destination and immutable review evidence |
| `AdOrder` | Quote snapshot, Checkout/customer IDs, environment, currency/tax totals, state, idempotency keys, credits and refunds |
| `AdDelivery` | Stable organic anchor, signed token, campaign/creative/order, pseudonymous cap key, decision/viewability/click times and billed amount |
| `AdDailyMetric` | Later derived aggregate for advertiser reporting; never the source of billing truth |

Database constraints must enforce ownership references, unique provider event/order identities and idempotent delivery. `AdDelivery` remains the auditable source for billing; aggregates are rebuildable projections.

## User stories and acceptance scope

| Story | Actor | Required acceptance evidence |
| --- | --- | --- |
| `ADS.STORY.ADVERTISER-CAMPAIGN` | Verified advertiser | Server-owned quote and asset validation; signed paid webhook schedules exactly once |
| `ADS.STORY.ADVERTISER-LIFECYCLE` | Advertiser account owner | Auditable verification/suspension; owned aggregate reports and billing documents only |
| `ADS.STORY.ADVERTISER-CHANGE-CONTROL` | Campaign owner | Versioned resubmission/appeal; requote, bounded refund or future-only pause without rewriting delivery |
| `ADS.STORY.ADMIN-CONTROL` | GreyhoundIQ administrator | Reasoned immutable review; scoped pause/kill switch preserves evidence and orders |
| `ADS.STORY.MEMBER-DELIVERY` | Feed member | Sponsored controls and stable organic anchor; caps exclude delivery without fabricated spend |
| `ADS.STORY.PRIVACY-CONTROL` | Feed member or visitor | Explain/hide/report/opt-out behavior; access/correction/deletion reconciles retention duties |
| `ADS.STORY.SELLER-BOOST` | Marketplace seller | Ownership and eligibility at purchase/delivery; equal rotation and expiry make-good/refund |
| `ADS.STORY.FINANCE-RECONCILIATION` | Finance/support operator | Duplicate and mismatch events fail closed; refund/credit reconciles the immutable ledger |

Each story requires at least two Given/When/Then scenarios in the executable contract. No story is complete from a Design Lab rendering alone.

## Production gates

Advertising and boosts remain unavailable until all gates pass with staging evidence:

- **Commercial:** approve inventory capacity, rate card, discount thresholds, refund/make-good policy, advertiser terms and seller terms; validate willingness to pay and sustainable fill at real traffic volumes.
- **Forecast:** keep all ad and boost revenue out of projections until the commercial gate, traffic threshold and rate validation are signed off.
- **Legal and tax:** approve Australian advertising, consumer, privacy, retention, GST and invoice treatment; keep wagering disabled unless separately cleared.
- **Schema and authorization:** review the forward-only migration; prove advertiser/seller ownership, administrator roles, object isolation and append-only audit history.
- **Creative safety:** prove private upload, decoded MIME/dimension/hash checks, malware scan, destination-domain verification, redirect revalidation and immutable review versions.
- **Payments:** pass Stripe test-mode Checkout, signature, raw-body, idempotency, duplicate, delay, expiry, environment, amount/customer/metadata mismatch, refund and reconciliation tests.
- **Delivery:** prove stable organic anchors, global and placement caps, equal Marketplace rotation, atomic inventory, signed viewability tokens, concurrency safety and deterministic under-delivery handling.
- **Privacy:** prove opt-out, hide/report, privacy-request, deletion/de-identification and retention jobs without exposing viewer-level data to advertisers.
- **Admin operations:** prove rate publication, review, reasoned mutations, scoped pause, global kill switch, refund/make-good and immutable evidence across administrator roles.
- **Quality:** pass keyboard/screen-reader and responsive asset tests, API contract/security audit, monitoring/alerting, failure recovery, load tests and Design Lab release checks.
- **Launch control:** run in Stripe test mode and Supabase staging first. Production credentials, production data and live inventory require explicit release authorization.

Until these gates pass, product copy must use `proposed`, `preview` or `not yet available` and must not imply inventory can be purchased.
