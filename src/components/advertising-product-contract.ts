export type AdvertisingPlacementId =
  | "FEED_INLINE"
  | "FEED_BILLBOARD"
  | "FEED_FIRST_SESSION";

export type AdvertisingPlacement = {
  id: AdvertisingPlacementId;
  name: string;
  inventory: string;
  desktop: string;
  mobile: string;
  baseViewableCpmCents: number;
  minimumViewableImpressions: number;
  minimumOrganicGap: number;
  maximumPerSession: number;
  sameCampaignPerPersonPerDay: number;
};

export type AdvertisingAcceptanceScenario = {
  given: string;
  when: string;
  then: string;
};

export const ADVERTISING_RATE_CARD = Object.freeze({
  version: "DL-AUD-2026-07-13",
  status: "design-lab-proposal" as const,
  currency: "AUD" as const,
  publicPricesIncludeGst: true,
  billingUnit: "viewable-impressions" as const,
  viewabilityRule: "At least 50% of the placement visible for one continuous second.",
  quoteLockMinutes: 30,
  maximumCampaignViewableImpressions: 10_000_000,
  maximumVolumeDiscountBasisPoints: 1_500,
  publishedVolumeDiscountBasisPoints: [0, 500, 1_000, 1_500] as const,
  targetingMultiplierBasisPoints: {
    broad: 10_000,
    contextual: 11_500,
    eventOrGeo: 12_500,
  },
  peakMultiplierBasisPoints: {
    standard: 10_000,
    premiumEvent: 12_000,
  },
});

export const ADVERTISING_PLACEMENTS: readonly AdvertisingPlacement[] = [
  {
    id: "FEED_INLINE",
    name: "Feed inline",
    inventory: "Responsive sponsored card after at least eight organic Feed entries",
    desktop: "1600 × 700 px · 16:7",
    mobile: "1080 × 1350 px · 4:5",
    baseViewableCpmCents: 2_750,
    minimumViewableImpressions: 10_000,
    minimumOrganicGap: 8,
    maximumPerSession: 3,
    sameCampaignPerPersonPerDay: 2,
  },
  {
    id: "FEED_BILLBOARD",
    name: "Premium Feed billboard",
    inventory: "Large-format sponsored placement after a minimum of twelve organic entries",
    desktop: "1600 × 500 px · 16:5",
    mobile: "1080 × 1080 px · 1:1",
    baseViewableCpmCents: 4_400,
    minimumViewableImpressions: 10_000,
    minimumOrganicGap: 12,
    maximumPerSession: 1,
    sameCampaignPerPersonPerDay: 1,
  },
  {
    id: "FEED_FIRST_SESSION",
    name: "First premium session slot",
    inventory: "First eligible sponsored slot in a session; never before four organic entries",
    desktop: "1600 × 700 px · 16:7",
    mobile: "1080 × 1350 px · 4:5",
    baseViewableCpmCents: 6_050,
    minimumViewableImpressions: 20_000,
    minimumOrganicGap: 4,
    maximumPerSession: 1,
    sameCampaignPerPersonPerDay: 1,
  },
] as const;

export const MARKETPLACE_BOOST_PACKAGES = [
  {
    id: "BOOST.STARTER",
    name: "Starter boost",
    viewableImpressions: 2_000,
    priceCentsIncludingGst: 2_900,
    maximumDays: 14,
  },
  {
    id: "BOOST.MOMENTUM",
    name: "Momentum boost",
    viewableImpressions: 10_000,
    priceCentsIncludingGst: 11_900,
    maximumDays: 30,
  },
  {
    id: "BOOST.SHOWCASE",
    name: "Showcase boost",
    viewableImpressions: 25_000,
    priceCentsIncludingGst: 24_900,
    maximumDays: 45,
  },
] as const;

export const ADVERTISING_CREATIVE_RULES = [
  "Static WebP, JPEG or PNG only; exact dimensions, decoded MIME and file hash must match.",
  "Desktop and mobile variants are required, each no larger than 2 MB with meaningful alt text.",
  "No SVG, GIF, video, HTML, JavaScript, executable content, third-party pixels or advertiser cookies in phase one.",
  "GreyhoundIQ renders the immutable Sponsored label, advertiser identity, Why this ad, hide and report controls.",
  "Claims, prices and destination pages must be accurate, current and substantiated; public prices show GST clearly.",
  "Wagering advertising stays disabled until legal, jurisdiction, age-audience and category approval is explicitly recorded.",
  "No sensitive-trait targeting, discriminatory targeting, illegal goods, animal cruelty, deceptive urgency or disguised editorial content.",
  "Destination URLs must be approved HTTPS URLs on a verified advertiser domain; redirects are revalidated and open redirects are forbidden.",
] as const;

export const MARKETPLACE_BOOST_RULES = [
  "A seller may boost only their own approved, active and unsold listing with clean approved media.",
  "The five-card premium carousel uses equal rotation across eligible sellers; payment never buys a fixed card order.",
  "The module appears only after twelve organic Feed entries and shows five distinct sellers when inventory permits.",
  "The same listing is capped at two viewable appearances per person per day and one appearance per session.",
  "Spend is prepaid and hard-capped; no billable impression is recorded without a signed idempotent delivery token.",
  "Undelivered viewable impressions at expiry receive an automatic make-good credit or pro-rata refund under the published policy.",
  "Listing ownership, approval, active status, sale status, media safety and seller standing are rechecked at every decision and impression.",
] as const;

export const ADVERTISING_GLOBAL_DELIVERY_RULES = [
  "Paid placements never appear consecutively and the combined advertiser-plus-boost load is capped at three modules per twenty organic Feed entries.",
  "A person sees at most four paid modules per session across all placements, campaigns and Marketplace boosts.",
  "Eligibility, schedule, approval, payment, creative safety, destination, remaining inventory and every cap are rechecked at decision and impression time.",
  "Booked inventory decrements atomically only after a signed idempotent token proves viewability; concurrent requests cannot overspend or overdeliver.",
  "Organic cursor order remains authoritative and each paid decision is anchored after a stable organic entry so realtime updates cannot duplicate or reorder it.",
] as const;

export const ADVERTISING_PRIVACY_RULES = [
  "Use a first-party HTTP-only pseudonymous cap key; never expose raw account IDs to creatives or advertisers.",
  "Do not retain raw IP addresses in advertising events; pseudonymous cap keys expire within 48 hours and raw view/click telemetry within 30 days.",
  "Aggregate advertiser reporting may be retained for 24 months and financial, order, refund and tax records for five years, subject to Australian legal and tax sign-off.",
  "Members can hide or report an ad, inspect Why this ad, and opt out of non-essential personalization without losing access to the organic Feed.",
  "Do not create sensitive-trait segments or accept advertiser pixels, cookies, device graphs, data-broker audiences or cross-site tracking.",
  "Deletion, consent and privacy-request workflows must remove or de-identify viewer-linked advertising data while retaining legally required financial records.",
] as const;

export const ADVERTISING_CAMPAIGN_STATES = [
  "draft",
  "submitted",
  "approved-pending-payment",
  "checkout-pending",
  "paid-scheduled",
  "live",
  "completed",
  "rejected",
  "paused",
  "cancelled",
  "expired",
  "refunded",
  "late-payment-review",
  "payment-mismatch-review",
] as const;

export const ADVERTISING_ADMIN_CONTROLS = [
  "Advertiser verification, terms acceptance and account suspension",
  "Immutable versioned rate cards, price floors, quote expiry and placement inventory",
  "Creative review with reason, reviewer, version history, malware result and destination-domain approval",
  "Global, placement, campaign, session and per-person frequency caps",
  "Schedule, pause, emergency kill switch, refund and make-good credit controls",
  "Viewable-impression, click, spend, remaining inventory and invoice reporting",
  "Mandatory administrator reason, confirmation, AdminAction and AuditLog for every privileged mutation",
] as const;

export const ADVERTISING_PAYMENT_CONTRACT = [
  "Campaign approval precedes payment so rejected creative does not create avoidable refunds.",
  "The server creates one AUD payment-mode Stripe Checkout Session from an immutable quoted order using an order-and-quote idempotency key; browser amounts are ignored.",
  "Checkout collects billing details and records subtotal, GST, total and tax-invoice fields; automatic tax activates only after registrations are configured.",
  "A success URL never activates inventory; only a signed idempotent webhook from the configured test or live environment can change payment state.",
  "Activation requires Checkout status complete, payment_status paid, mode payment, expected AUD amount, exact customer, metadata, quote hash and environment.",
  "The stored quote and Checkout Session share a 30-minute expiry. Late or mismatched payments enter review and refund handling without reserving or activating inventory.",
  "Unpaid reservations expire automatically; refunds and credits retain the original rate-card, tax breakdown and order snapshot.",
] as const;

export const ADVERTISING_USER_STORIES = [
  {
    id: "ADS.STORY.ADVERTISER-CAMPAIGN",
    actor: "Verified advertiser",
    outcome: "Create, preview, submit and prepay an approved campaign without controlling price, review state or delivery evidence from the browser.",
    acceptance: [
      {
        given: "The advertiser owns an active account and selects a published placement, schedule and budget.",
        when: "They upload exact desktop and mobile creative and request a quote.",
        then: "The server validates the assets and stores an expiring immutable AUD quote with every pricing factor.",
      },
      {
        given: "The campaign and creative have administrator approval and the reservation is unexpired.",
        when: "Stripe sends a signed payment-complete webhook matching the stored order.",
        then: "The campaign becomes paid and schedulable exactly once; a browser redirect alone changes nothing.",
      },
    ],
  },
  {
    id: "ADS.STORY.ADVERTISER-LIFECYCLE",
    actor: "Advertiser account owner",
    outcome: "Complete business verification, manage campaign status, inspect delivery and download billing records without accessing another advertiser or raw viewer data.",
    acceptance: [
      {
        given: "A business owner has supplied identity, contact, domain and terms-acceptance evidence for a new advertiser account.",
        when: "The account is reviewed, approved, suspended or reactivated by an administrator.",
        then: "The scoped status and reason are auditable, and campaign creation remains unavailable unless the advertiser is active.",
      },
      {
        given: "The advertiser owns a paid live campaign with recorded delivery and billing events.",
        when: "They pause it or open its report and invoice history.",
        then: "Future decisions stop promptly and only aggregate delivery, spend, credits, refunds and owned billing documents are returned.",
      },
    ],
  },
  {
    id: "ADS.STORY.ADVERTISER-CHANGE-CONTROL",
    actor: "Advertiser campaign owner",
    outcome: "Edit, resubmit, appeal, reschedule or cancel an owned campaign through controlled transitions that preserve its original reviews, quotes and payments.",
    acceptance: [
      {
        given: "An owned campaign or creative was rejected with a visible policy reason and immutable review record.",
        when: "The advertiser replaces the rejected version, supplies substantiation or requests a documented appeal.",
        then: "A new review version enters the queue without overwriting the rejected evidence or bypassing administrator approval.",
      },
      {
        given: "An owned paid campaign is scheduled or live and the advertiser requests a budget, placement, schedule or cancellation change.",
        when: "The server evaluates the requested change against delivered inventory and the locked order.",
        then: "A requote, additional payment, bounded refund or future-only pause is recorded explicitly; delivered spend is never rewritten.",
      },
    ],
  },
  {
    id: "ADS.STORY.ADMIN-CONTROL",
    actor: "GreyhoundIQ administrator",
    outcome: "Control advertisers, placements, rates, reviews, schedules, caps, pauses, refunds and audit history without faking provider payment state.",
    acceptance: [
      {
        given: "A submitted campaign includes creative, destination and business identity evidence.",
        when: "An administrator approves or rejects it with confirmation and a mandatory reason.",
        then: "The decision, reviewer, evidence version and audit records are immutable and visible to the advertiser.",
      },
      {
        given: "A placement, campaign or advertiser creates a safety or compliance risk.",
        when: "An administrator uses a scoped pause or global kill switch.",
        then: "New delivery stops immediately without erasing orders, evidence, invoices or historical metrics.",
      },
    ],
  },
  {
    id: "ADS.STORY.MEMBER-DELIVERY",
    actor: "Feed member",
    outcome: "See scarce, clearly sponsored and frequency-capped advertising without losing organic Feed order, privacy or control.",
    acceptance: [
      {
        given: "An approved paid campaign is eligible for the member context and still has booked inventory.",
        when: "The Feed requests a decision after the configured organic anchor.",
        then: "At most one eligible creative is returned with Sponsored disclosure, hide, report and Why this ad controls.",
      },
      {
        given: "The same campaign reached its session or daily cap for that privacy-safe cap key.",
        when: "Another decision is requested.",
        then: "The campaign is excluded and no impression, click or spend is fabricated.",
      },
    ],
  },
  {
    id: "ADS.STORY.PRIVACY-CONTROL",
    actor: "Feed member or visitor",
    outcome: "Understand and control advertising personalization, hide or report ads, and exercise privacy requests without being excluded from organic GreyhoundIQ content.",
    acceptance: [
      {
        given: "A paid placement is shown using a privacy-safe decision and frequency-cap key.",
        when: "The viewer opens Why this ad, hides it, reports it or opts out of non-essential personalization.",
        then: "The reason and controls are clear, the preference is enforced, and organic Feed access remains available.",
      },
      {
        given: "A viewer submits a valid access, correction or deletion request for advertising-linked data.",
        when: "The privacy workflow reconciles raw events, aggregates and financial retention duties.",
        then: "Viewer-linked data is returned, corrected, deleted or de-identified as required while legally required order records remain restricted.",
      },
    ],
  },
  {
    id: "ADS.STORY.SELLER-BOOST",
    actor: "Marketplace seller",
    outcome: "Boost an owned approved listing into the five-card premium Feed carousel with transparent prepaid delivery and no pay-to-win ordering.",
    acceptance: [
      {
        given: "The seller owns an active approved listing that is not sold, paused or under review.",
        when: "They select a boost package and complete its bound Checkout order.",
        then: "The listing joins equal rotation with a hard viewable-impression cap and a clearly sponsored Marketplace label.",
      },
      {
        given: "The package expires before all booked viewable impressions are delivered.",
        when: "The expiry reconciliation runs.",
        then: "The seller receives the published make-good credit or pro-rata refund and an auditable delivery report.",
      },
    ],
  },
  {
    id: "ADS.STORY.FINANCE-RECONCILIATION",
    actor: "Finance and support operator",
    outcome: "Reconcile quotes, Checkout payments, invoices, delivery, credits and refunds against one immutable order ledger.",
    acceptance: [
      {
        given: "A Stripe event is duplicated, delayed or has mismatched order metadata.",
        when: "The signed webhook reducer processes it.",
        then: "Duplicates are idempotent, mismatches fail closed and no campaign is activated incorrectly.",
      },
      {
        given: "A valid refund or under-delivery credit is approved.",
        when: "The operator records the mandatory reason and provider result.",
        then: "The ledger, advertiser balance, invoice history and audit log reconcile without rewriting the original quote.",
      },
    ],
  },
] as const satisfies readonly {
  id: string;
  actor: string;
  outcome: string;
  acceptance: readonly AdvertisingAcceptanceScenario[];
}[];

export const ADVERTISING_PRODUCT_SUMMARY = Object.freeze({
  status: ADVERTISING_RATE_CARD.status,
  placements: ADVERTISING_PLACEMENTS.length,
  boostPackages: MARKETPLACE_BOOST_PACKAGES.length,
  userStories: ADVERTISING_USER_STORIES.length,
  acceptanceScenarios: ADVERTISING_USER_STORIES.reduce(
    (total, story) => total + story.acceptance.length,
    0,
  ),
});

export function quoteAdvertisingCampaign({
  placementId,
  viewableImpressions,
  targetingMultiplierBasisPoints = 10_000,
  peakMultiplierBasisPoints = 10_000,
  volumeDiscountBasisPoints = 0,
}: {
  placementId: AdvertisingPlacementId;
  viewableImpressions: number;
  targetingMultiplierBasisPoints?: number;
  peakMultiplierBasisPoints?: number;
  volumeDiscountBasisPoints?: number;
}) {
  const placement = ADVERTISING_PLACEMENTS.find(
    (candidate) => candidate.id === placementId
  );
  if (!placement) throw new Error("Unknown advertising placement.");
  if (!Number.isSafeInteger(viewableImpressions) || viewableImpressions < 1) {
    throw new Error("Viewable impressions must be a positive integer.");
  }
  if (
    viewableImpressions >
    ADVERTISING_RATE_CARD.maximumCampaignViewableImpressions
  ) {
    throw new Error("Viewable impressions exceed the published campaign maximum.");
  }
  if (
    !Object.values(
      ADVERTISING_RATE_CARD.targetingMultiplierBasisPoints
    ).includes(targetingMultiplierBasisPoints) ||
    !Object.values(ADVERTISING_RATE_CARD.peakMultiplierBasisPoints).includes(
      peakMultiplierBasisPoints
    ) ||
    !ADVERTISING_RATE_CARD.publishedVolumeDiscountBasisPoints.includes(
      volumeDiscountBasisPoints as 0 | 500 | 1_000 | 1_500
    )
  ) {
    throw new Error("Advertising quote factors are outside the published bounds.");
  }

  const bookedImpressions = Math.max(
    viewableImpressions,
    placement.minimumViewableImpressions
  );
  const baseCents = Number(
    ceilDivide(
      BigInt(bookedImpressions) * BigInt(placement.baseViewableCpmCents),
      BigInt(1_000)
    )
  );
  if (!Number.isSafeInteger(baseCents)) {
    throw new Error("Advertising base quote exceeds the safe monetary range.");
  }
  const totalCentsIncludingGstBigInt = ceilDivide(
    BigInt(bookedImpressions) *
      BigInt(placement.baseViewableCpmCents) *
      BigInt(targetingMultiplierBasisPoints) *
      BigInt(peakMultiplierBasisPoints) *
      BigInt(10_000 - volumeDiscountBasisPoints),
    BigInt(1_000) * BigInt(10_000) * BigInt(10_000) * BigInt(10_000)
  );
  if (totalCentsIncludingGstBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Advertising quote exceeds the safe monetary range.");
  }
  const totalCentsIncludingGst = Number(totalCentsIncludingGstBigInt);
  const gstCents = Math.round(totalCentsIncludingGst / 11);
  const subtotalCentsExcludingGst = totalCentsIncludingGst - gstCents;

  return {
    rateCardVersion: ADVERTISING_RATE_CARD.version,
    placementId,
    bookedImpressions,
    baseCents,
    targetingMultiplierBasisPoints,
    peakMultiplierBasisPoints,
    volumeDiscountBasisPoints,
    subtotalCentsExcludingGst,
    gstCents,
    totalCentsIncludingGst,
  } as const;
}

export function formatAud(cents: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function ceilDivide(numerator: bigint, denominator: bigint) {
  return (numerator + denominator - BigInt(1)) / denominator;
}
