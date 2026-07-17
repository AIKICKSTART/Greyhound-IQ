export type DesignLabLocalDataSource =
  | "PROVIDER_PUBLIC"
  | "PROVIDER_METADATA_ONLY"
  | "REFERENCE_SEED"
  | "SYNTHETIC_ONLY"
  | "LOCAL_DERIVED";

export type DesignLabLocalDataPolicy = {
  model: string;
  productionDatabaseCopy: "DENY";
  localSource: DesignLabLocalDataSource;
  classificationIds: readonly string[];
  nullFields: readonly string[];
  relationStrategy: string;
};

const PROVIDER_PUBLIC_MODELS = [
  "Dog",
  "DogProfileForm",
  "DogProfileObservation",
  "DogSourceIdentity",
  "PedigreeAssertion",
  "Trainer",
  "Track",
  "Meeting",
  "Race",
  "RaceVideo",
  "Runner",
  "Result",
  "FormEntry",
] as const;

const PROVIDER_METADATA_ONLY_MODELS = [
  "DogProfileArchive",
  "RaceDayArchive",
] as const;

const REFERENCE_SEED_MODELS = [
  "Plan",
  "PriceCatalog",
  "PlanEntitlement",
  "ForumCategory",
  "MarketplaceCategory",
  "FeedTopic",
] as const;

const LOCAL_DERIVED_MODELS = [
  "UsageAggregate",
  "DogProfileMergeLedger",
  "PedigreeImportRun",
  "PedigreeMergeLedger",
  "ListingSearchIndex",
  "AuditLog",
  "JobRun",
  "DataSourceHealth",
  "RateLimit",
] as const;

const SYNTHETIC_ONLY_MODELS = [
  "User",
  "SignupOutbox",
  "TermsAcceptance",
  "ConsentEvent",
  "MarketingPreference",
  "Notification",
  "Organization",
  "Membership",
  "OrganizationInvitation",
  "SupportTicket",
  "SupportMessage",
  "Feedback",
  "BugReport",
  "RetentionPolicy",
  "DeletionJob",
  "ExportArtifact",
  "BillingCustomer",
  "Subscription",
  "EntitlementSnapshot",
  "WebhookEvent",
  "InvoiceRecord",
  "PaymentRecord",
  "RefundRecord",
  "CreditNoteRecord",
  "BillingEvent",
  "UsageEvent",
  "UsageOutbox",
  "Profile",
  "CustomPage",
  "SocialActor",
  "RealtimeTopicGrant",
  "ActorFollow",
  "ActorTopicFollow",
  "ActorMute",
  "ActorGalleryMedia",
  "SavedFeedPost",
  "FeedMention",
  "FeedShare",
  "Friendship",
  "DogOwnership",
  "Thread",
  "Post",
  "Listing",
  "ListingLocation",
  "ListingAttribute",
  "ListingStatusHistory",
  "SavedListing",
  "ListingEnquiry",
  "ListingReport",
  "ListingModerationAction",
  "ListingView",
  "TrustSafetyFlag",
  "BannedPhrase",
  "Message",
  "MediaAsset",
  "MessageMedia",
  "ListingMedia",
  "Conversation",
  "ConversationParticipant",
  "MessageDeliveryReceipt",
  "MessageReadReceipt",
  "MessageReaction",
  "UserPresence",
  "UserBlock",
  "MessageModerationAction",
  "FeedPost",
  "FeedPostMedia",
  "FeedComment",
  "FeedReaction",
  "CallRoom",
  "CallParticipant",
  "CallInvite",
  "CallEvent",
  "CallReport",
  "CallPermission",
  "AgentRun",
  "AgentRunUsage",
  "MemoryEntry",
  "ConversationContext",
  "AdminAction",
  "Report",
  "PlatformSetting",
  "CustomDesignRequest",
] as const;

const policies = [
  ...PROVIDER_PUBLIC_MODELS.map((model) =>
    policy(model, "PROVIDER_PUBLIC", {
      classificationIds:
        model === "Trainer" ? ["PUBLIC", "PERSONAL"] : ["PUBLIC"],
      nullFields:
        model === "Dog"
          ? ["ownerName"]
          : model === "DogProfileForm" || model === "Runner"
            ? ["startingPrice"]
            : model === "RaceVideo"
              ? ["sourceRawJson"]
              : [],
      relationStrategy:
        "Ingest through the configured public racing provider adapter and the production Prisma repository contract.",
    })
  ),
  ...PROVIDER_METADATA_ONLY_MODELS.map((model) =>
    policy(model, "PROVIDER_METADATA_ONLY", {
      classificationIds: ["INTERNAL"],
      nullFields:
        model === "DogProfileArchive"
          ? ["candidateJson", "parsedJson", "profileHtml", "fullFormHtml"]
          : ["rawJson"],
      relationStrategy:
        "Keep empty by default; historical tests may load metadata-only records after raw payload scrubbing.",
    })
  ),
  ...REFERENCE_SEED_MODELS.map((model) =>
    policy(model, "REFERENCE_SEED", {
      classificationIds: ["PUBLIC"],
      relationStrategy:
        "Load from reviewed source-controlled reference definitions, never production rows.",
    })
  ),
  ...LOCAL_DERIVED_MODELS.map((model) =>
    policy(model, "LOCAL_DERIVED", {
      classificationIds: ["INTERNAL"],
      relationStrategy:
        "Generate only from Design Lab activity after provider and synthetic fixtures are loaded.",
    })
  ),
  ...SYNTHETIC_ONLY_MODELS.map((model) =>
    policy(model, "SYNTHETIC_ONLY", {
      classificationIds: ["SYNTHETIC_PRIVATE"],
      relationStrategy:
        "Create deterministic demo-* records and .test identities locally; never copy, pseudonymise or replay production rows.",
    })
  ),
] as const;

export const DESIGN_LAB_LOCAL_DATA_POLICY = Object.freeze(
  Object.fromEntries(policies.map((entry) => [entry.model, entry]))
) as Readonly<Record<string, DesignLabLocalDataPolicy>>;

export const DESIGN_LAB_LOCAL_DATA_POLICY_SUMMARY = Object.freeze({
  totalModels: policies.length,
  productionDatabaseCopyAllowed: policies.filter(
    (entry) => entry.productionDatabaseCopy !== "DENY"
  ).length,
  providerPublic: PROVIDER_PUBLIC_MODELS.length,
  providerMetadataOnly: PROVIDER_METADATA_ONLY_MODELS.length,
  referenceSeed: REFERENCE_SEED_MODELS.length,
  syntheticOnly: SYNTHETIC_ONLY_MODELS.length,
  localDerived: LOCAL_DERIVED_MODELS.length,
});

function policy(
  model: string,
  localSource: DesignLabLocalDataSource,
  options: {
    classificationIds: readonly string[];
    nullFields?: readonly string[];
    relationStrategy: string;
  }
): DesignLabLocalDataPolicy {
  return {
    model,
    productionDatabaseCopy: "DENY",
    localSource,
    classificationIds: options.classificationIds,
    nullFields: options.nullFields ?? [],
    relationStrategy: options.relationStrategy,
  };
}
