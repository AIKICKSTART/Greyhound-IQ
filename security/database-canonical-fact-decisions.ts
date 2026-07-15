export const DATABASE_CANONICAL_FACT_IDS = [
  "DB.CANONICAL.ORGANIZATION_AUTHORITY",
  "DB.CANONICAL.SUBSCRIPTION_ACCESS",
  "DB.CANONICAL.LISTING_LOCATION_TYPE",
  "DB.CANONICAL.MESSAGE_READ",
  "DB.CANONICAL.MESSAGE_BLOCK",
  "DB.CANONICAL.DOG_OWNERSHIP",
  "DB.CANONICAL.RACING_ARCHIVE",
  "DB.CANONICAL.LISTING_STATUS_HISTORY",
] as const;

export type DatabaseCanonicalFactId = (typeof DATABASE_CANONICAL_FACT_IDS)[number];
type SourceReference = `${string}#${string}`;

type RetainedProjectionDecision = {
  id: string;
  writer: string;
  writerRef: SourceReference;
  reconciliationRule: string;
  driftThreshold: 0;
};

export type DatabaseCanonicalFactDecision = {
  id: DatabaseCanonicalFactId;
  status: "accepted";
  decisionOwner: string;
  canonicalFact: string;
  rationale: string;
  sourceRefs: readonly [SourceReference, ...SourceReference[]];
  retainedProjections: readonly [
    RetainedProjectionDecision,
    ...RetainedProjectionDecision[],
  ];
};

export const DATABASE_CANONICAL_FACT_DECISIONS = [
  {
    id: "DB.CANONICAL.ORGANIZATION_AUTHORITY",
    status: "accepted",
    decisionOwner: "Backend Lead",
    canonicalFact:
      "Organization.ownerId is the owner identity; only active Membership rows supply delegated administrator or member authority.",
    rationale:
      "The explicit owner cannot be overridden by a stale membership role, while delegated access remains revocable through membership status.",
    sourceRefs: [
      "prisma/schema.prisma#model Organization",
      "prisma/schema.prisma#model Membership",
      "src/lib/organization-team-policy.ts#resolveTeamAuthority",
    ],
    retainedProjections: [
      {
        id: "organization-owner-membership-role",
        writer: "Organization team transaction boundary",
        writerRef:
          "src/lib/organization-team-service.ts#changeOrganizationTeamMemberRole",
        reconciliationRule:
          "Each organization ownerId must match exactly one active owner Membership; no other active owner role may exist.",
        driftThreshold: 0,
      },
    ],
  },
  {
    id: "DB.CANONICAL.SUBSCRIPTION_ACCESS",
    status: "accepted",
    decisionOwner: "Billing Engineer",
    canonicalFact:
      "The settled Subscription status and planCode are the commercial source of truth for paid access.",
    rationale:
      "Provider events may be retried, so access projections must be reproducible from the settled subscription record rather than independently granted.",
    sourceRefs: [
      "prisma/schema.prisma#model Subscription",
      "src/lib/billing/subscription-state-machine.ts#assertSubscriptionStatusTransition",
    ],
    retainedProjections: [
      {
        id: "user-subscription-tier",
        writer: "Billing settlement reducer",
        writerRef: "src/lib/billing/stripe-webhooks.ts#reduceStripeWebhook",
        reconciliationRule:
          "User.subscriptionTier must equal the tier derived from the latest settled Subscription, otherwise access falls back to free.",
        driftThreshold: 0,
      },
      {
        id: "entitlement-snapshot",
        writer: "Billing entitlement settlement boundary",
        writerRef: "src/lib/admin-service.ts#upsertAdminEntitlement",
        reconciliationRule:
          "Every active EntitlementSnapshot must resolve to the same user, subscription and plan-derived entitlement set.",
        driftThreshold: 0,
      },
    ],
  },
  {
    id: "DB.CANONICAL.LISTING_LOCATION_TYPE",
    status: "accepted",
    decisionOwner: "Marketplace Backend Lead",
    canonicalFact:
      "Listing.type and Listing.state are canonical; ListingLocation stores extended address fields and search records are disposable projections.",
    rationale:
      "One listing row owns business classification while derived location and search rows can be rebuilt transactionally.",
    sourceRefs: [
      "prisma/schema.prisma#model Listing",
      "prisma/schema.prisma#model ListingLocation",
      "prisma/schema.prisma#model ListingSearchIndex",
    ],
    retainedProjections: [
      {
        id: "listing-type-alias",
        writer: "Listing write transaction",
        writerRef: "src/lib/listing-service.ts#updateListingForCurrentUser",
        reconciliationRule:
          "Listing.listingType must equal Listing.type for every row until the alias is contracted.",
        driftThreshold: 0,
      },
      {
        id: "listing-location",
        writer: "Listing write transaction",
        writerRef: "src/lib/listing-service.ts#upsertListingLocation",
        reconciliationRule:
          "ListingLocation.state must equal Listing.state and each listing may have at most one extended location row.",
        driftThreshold: 0,
      },
      {
        id: "listing-search-index",
        writer: "Listing write transaction",
        writerRef: "src/lib/listing-service.ts#upsertListingSearchIndex",
        reconciliationRule:
          "The search document must rebuild exactly from canonical listing, location and attribute values.",
        driftThreshold: 0,
      },
    ],
  },
  {
    id: "DB.CANONICAL.MESSAGE_READ",
    status: "accepted",
    decisionOwner: "Messaging Backend Lead",
    canonicalFact:
      "Message.readAt is the per-recipient read fact; a null value means unread.",
    rationale:
      "A timestamp is sufficient to derive the compatibility boolean, receipt and conversation cursor without competing truth.",
    sourceRefs: [
      "prisma/schema.prisma#model Message",
      "src/lib/conversation-service.ts#markConversationRead",
    ],
    retainedProjections: [
      {
        id: "message-read-boolean",
        writer: "Conversation read transaction",
        writerRef: "src/lib/conversation-service.ts#markConversationRead",
        reconciliationRule:
          "Message.read must be true exactly when Message.readAt is non-null.",
        driftThreshold: 0,
      },
      {
        id: "message-read-receipt",
        writer: "Conversation read transaction",
        writerRef: "src/lib/conversation-service.ts#markConversationRead",
        reconciliationRule:
          "Each read message must have one recipient MessageReadReceipt with the same read timestamp.",
        driftThreshold: 0,
      },
      {
        id: "conversation-last-read-cursor",
        writer: "Conversation read transaction",
        writerRef: "src/lib/conversation-service.ts#markConversationRead",
        reconciliationRule:
          "ConversationParticipant.lastReadMessageId must reference the newest read message for that participant.",
        driftThreshold: 0,
      },
    ],
  },
  {
    id: "DB.CANONICAL.MESSAGE_BLOCK",
    status: "accepted",
    decisionOwner: "Messaging Backend Lead",
    canonicalFact:
      "UserBlock is the canonical directional block relationship between two profiles.",
    rationale:
      "A profile-level relationship applies consistently across messaging and community surfaces; conversation fields only accelerate display and enforcement.",
    sourceRefs: [
      "prisma/schema.prisma#model UserBlock",
      "src/lib/conversation-service.ts#setConversationBlock",
    ],
    retainedProjections: [
      {
        id: "conversation-block-state",
        writer: "Conversation block transaction",
        writerRef: "src/lib/conversation-service.ts#setConversationBlock",
        reconciliationRule:
          "Conversation.blockedById and blockedAt must exist only when the same directional UserBlock exists.",
        driftThreshold: 0,
      },
    ],
  },
  {
    id: "DB.CANONICAL.DOG_OWNERSHIP",
    status: "accepted",
    decisionOwner: "Racing Data Lead",
    canonicalFact:
      "DogOwnership.status is the claim lifecycle fact; only approved rows grant ownership authority.",
    rationale:
      "The lifecycle status records pending, approved and rejected outcomes while the legacy verified flag remains derivable.",
    sourceRefs: [
      "prisma/schema.prisma#model DogOwnership",
      "src/lib/admin-service.ts#approveDogOwnership",
      "src/lib/admin-service.ts#rejectDogOwnership",
    ],
    retainedProjections: [
      {
        id: "dog-ownership-verified",
        writer: "Dog ownership review transaction",
        writerRef: "src/lib/admin-service.ts#approveDogOwnership",
        reconciliationRule:
          "DogOwnership.verified must be true exactly for approved status and false for pending or rejected status.",
        driftThreshold: 0,
      },
    ],
  },
  {
    id: "DB.CANONICAL.RACING_ARCHIVE",
    status: "accepted",
    decisionOwner: "Racing Data Lead",
    canonicalFact:
      "Sanitized provider archive snapshots are immutable ingestion evidence; normalized racing tables are current query projections.",
    rationale:
      "Provider evidence must remain replayable while application reads use bounded relational projections that can be regenerated.",
    sourceRefs: [
      "prisma/schema.prisma#model RaceDayArchive",
      "prisma/schema.prisma#model DogProfileArchive",
      "src/lib/live/raw-sanitizer.ts#whitelistProviderSnapshot",
    ],
    retainedProjections: [
      {
        id: "normalized-racing-current-state",
        writer: "Live racing synchronization boundary",
        writerRef: "src/lib/live/sync.ts#upsertSystemMeetings",
        reconciliationRule:
          "Every normalized provider row must trace to one archived provider identity and replay to the same canonical keys.",
        driftThreshold: 0,
      },
    ],
  },
  {
    id: "DB.CANONICAL.LISTING_STATUS_HISTORY",
    status: "accepted",
    decisionOwner: "Marketplace Backend Lead",
    canonicalFact:
      "ListingStatusHistory is the append-only transition history; Listing.status is the current-state projection of its latest event.",
    rationale:
      "An ordered transition record preserves accountability while the listing row remains efficient for current-state queries.",
    sourceRefs: [
      "prisma/schema.prisma#model ListingStatusHistory",
      "src/lib/listing-service.ts#markListingSoldForCurrentUser",
      "src/lib/listing-service.ts#runListingMaintenance",
    ],
    retainedProjections: [
      {
        id: "listing-current-status",
        writer: "Listing status transition transaction",
        writerRef: "src/lib/listing-service.ts#markListingSoldForCurrentUser",
        reconciliationRule:
          "Listing.status must equal the toStatus of the latest ListingStatusHistory row ordered by createdAt and id.",
        driftThreshold: 0,
      },
    ],
  },
] as const satisfies readonly DatabaseCanonicalFactDecision[];
