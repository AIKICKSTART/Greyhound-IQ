import { DEMO_ADMIN_DISPLAY_NAME } from "../src/lib/demo-access";
import { DEMO_PROFILE_PORTRAITS } from "../src/lib/demo-profile-media";

export const DEMO_FIXTURE_TIMESTAMP = "2026-07-12T10:00:00.000Z";
export const DEMO_CONTROL_ROOM_AVATAR = "/images/logo-mark-purple-gold.webp";

export const DEMO_FIXTURE_BOUND_SOURCE_FILES = [
  "package.json",
  "package-lock.json",
  "prisma/schema.prisma",
  "prisma/migrations/20260630093000_baseline/migration.sql",
  "prisma/migrations/20260706223000_add_rls_entitlement_policies/migration.sql",
  "prisma/migrations/20260708192000_restrict_audit_ratelimit_rls/migration.sql",
  "prisma/migrations/20260708230000_dog_ownership_verification/migration.sql",
  "prisma/migrations/20260713173000_allow_owned_user_export_artifacts/migration.sql",
  "scripts/load-env.ts",
  "scripts/demo-route-fixture-contract.ts",
  "scripts/demo-route-fixture-evidence.ts",
  "scripts/check-demo-route-fixture-idempotency.ts",
  "scripts/seed-demo-route-fixtures.ts",
  "security/database-operations.ts",
  "security/mandatory-public-racing-database-operations.ts",
  "security/data-classification.ts",
  "security/local-data-policy.ts",
  "docs/security/data-classification.md",
  "src/app/api/users/me/export/route.ts",
  "src/lib/account-service.ts",
  "src/lib/auth-sync.ts",
  "src/lib/billing/stripe-client.ts",
  "src/lib/billing/stripe-env.ts",
  "src/lib/billing/stripe-webhooks.ts",
  "src/lib/demo-access.ts",
  "src/lib/demo-profile-media.ts",
  "src/lib/custom-page-service.ts",
  "src/lib/conversation-service.ts",
  "src/lib/db.ts",
  "src/lib/db-context.ts",
  "src/lib/listing-service.ts",
  "src/lib/media-service.ts",
  "src/lib/queries.ts",
  "src/lib/realtime-service.ts",
  "src/lib/social-actor-service.ts",
  "src/lib/signup-acceptance.ts",
  "src/lib/signup-acceptance-worker-store.ts",
  "src/lib/storage-paths.ts",
  "src/lib/supabase-storage.ts",
] as const;

export const DEMO_FIXTURE_APPROVED_ASSETS = [
  {
    id: "asset-control-room-brand-mark",
    filePath: "public/images/logo-mark-purple-gold.webp",
    publicUrl: DEMO_CONTROL_ROOM_AVATAR,
    sha256: "a3fa996a89fc599fb12a89e8b414de8fe8079fd912793329deb719c6cc1afd60",
    sizeBytes: 53_446,
    width: 512,
    height: 512,
    provenance: {
      id: "prov-control-room-brand-mark-v1",
      kind: "source-controlled-non-person-brand-art",
      synthetic: true,
      realPersonSource: false,
      approvedForPrivateFixtures: true,
      declaration: "GreyhoundIQ brand artwork; it does not depict a person.",
    },
  },
  {
    id: "asset-profile-freddie-free",
    filePath: "public/images/demo-profiles/freddie-free.webp",
    publicUrl: DEMO_PROFILE_PORTRAITS["Freddie Free"],
    sha256: "8f0947eb87197db98a1a1a57f3a8950d5eb38b74db953f60daa722cbab731e4a",
    sizeBytes: 161_182,
    width: 1024,
    height: 1024,
    provenance: {
      id: "prov-fictional-freddie-free-v1",
      kind: "fictional-generated-persona-portrait",
      personaName: "Freddie Free",
      synthetic: true,
      realPersonSource: false,
      approvedForPrivateFixtures: true,
      declaration: "Generated fictional persona; not based on a real person.",
    },
  },
  {
    id: "asset-profile-patricia-pro",
    filePath: "public/images/demo-profiles/patricia-pro.webp",
    publicUrl: DEMO_PROFILE_PORTRAITS["Patricia Pro"],
    sha256: "2cf77fd0c0c9840dde23192110afe7e2a9a20c23350ff34ffb7188fe0e31bee0",
    sizeBytes: 173_110,
    width: 1024,
    height: 1024,
    provenance: {
      id: "prov-fictional-patricia-pro-v1",
      kind: "fictional-generated-persona-portrait",
      personaName: "Patricia Pro",
      synthetic: true,
      realPersonSource: false,
      approvedForPrivateFixtures: true,
      declaration: "Generated fictional persona; not based on a real person.",
    },
  },
  {
    id: "asset-profile-quentin-quant",
    filePath: "public/images/demo-profiles/quentin-quant.webp",
    publicUrl: DEMO_PROFILE_PORTRAITS["Quentin Quant"],
    sha256: "9e3c0b807fc715969314c66eb98fa11d318b180ea0207b9eca6efa407106e5fc",
    sizeBytes: 172_538,
    width: 1024,
    height: 1024,
    provenance: {
      id: "prov-fictional-quentin-quant-v1",
      kind: "fictional-generated-persona-portrait",
      personaName: "Quentin Quant",
      synthetic: true,
      realPersonSource: false,
      approvedForPrivateFixtures: true,
      declaration: "Generated fictional persona; not based on a real person.",
    },
  },
  {
    id: "asset-control-room-banner",
    filePath: "public/images/site-header-gate-burst-landscape.webp",
    publicUrl: "/images/site-header-gate-burst-landscape.webp",
    sha256: "654cde0135b31ca8ba1bf1b2c0f313f922d1b40e985656b4245507e736360201",
    sizeBytes: 99_470,
    width: 2400,
    height: 500,
    provenance: {
      id: "prov-control-room-banner-v1",
      kind: "source-controlled-non-person-product-art",
      synthetic: true,
      realPersonSource: false,
      approvedForPrivateFixtures: true,
      declaration: "Source-controlled greyhound racing artwork; it does not depict a person.",
    },
  },
  {
    id: "asset-control-room-wordmark",
    filePath: "public/images/logo-wordmark-purple-gold.webp",
    publicUrl: "/images/logo-wordmark-purple-gold.webp",
    sha256: "6519b9aed615511ac03c8e9fc10bd64c77e3ff1acd1d62bacdb27a753e907a69",
    sizeBytes: 68_338,
    width: 900,
    height: 222,
    provenance: {
      id: "prov-control-room-wordmark-v1",
      kind: "source-controlled-non-person-brand-art",
      synthetic: true,
      realPersonSource: false,
      approvedForPrivateFixtures: true,
      declaration: "GreyhoundIQ wordmark artwork; it does not depict a person.",
    },
  },
  {
    id: "asset-control-room-gallery-stats",
    filePath: "public/images/feature-advanced-stats-green.webp",
    publicUrl: "/images/feature-advanced-stats-green.webp",
    sha256: "58e0bea2e27bf4363e43a1b6ac7c5da6e93ad95ecc6816ec19d3ee4a748f19a5",
    sizeBytes: 342_926,
    width: 1536,
    height: 1024,
    provenance: {
      id: "prov-control-room-gallery-stats-v1",
      kind: "source-controlled-non-person-product-art",
      synthetic: true,
      realPersonSource: false,
      approvedForPrivateFixtures: true,
      declaration: "Source-controlled product artwork; it does not depict a person.",
    },
  },
  {
    id: "asset-control-room-gallery-breeding",
    filePath: "public/images/feature-breeding-analytics-gold.webp",
    publicUrl: "/images/feature-breeding-analytics-gold.webp",
    sha256: "087e930ca1fd258f1c4434e78f9743a6e45613321cd344eb029a87c40ebdeb01",
    sizeBytes: 391_068,
    width: 1536,
    height: 1024,
    provenance: {
      id: "prov-control-room-gallery-breeding-v1",
      kind: "source-controlled-non-person-product-art",
      synthetic: true,
      realPersonSource: false,
      approvedForPrivateFixtures: true,
      declaration: "Source-controlled product artwork; it does not depict a person.",
    },
  },
  {
    id: "asset-control-room-gallery-ai",
    filePath: "public/images/feature-ai-predictions-blue.webp",
    publicUrl: "/images/feature-ai-predictions-blue.webp",
    sha256: "db1a78912a9a63f346facf5897e87cee680f2747885f773acc3534a1cc1bb012",
    sizeBytes: 446_598,
    width: 1536,
    height: 1024,
    provenance: {
      id: "prov-control-room-gallery-ai-v1",
      kind: "source-controlled-non-person-product-art",
      synthetic: true,
      realPersonSource: false,
      approvedForPrivateFixtures: true,
      declaration: "Source-controlled product artwork; it does not depict a person.",
    },
  },
] as const;

export const DEMO_FIXTURE_MANIFEST = {
  accounts: [
    {
      email: "admin@greyhoundiq.test",
      displayName: DEMO_ADMIN_DISPLAY_NAME,
      tier: "pro_plus",
      role: "admin",
      verified: true,
      avatarAssetId: "asset-control-room-brand-mark",
      avatarUrl: DEMO_CONTROL_ROOM_AVATAR,
      userId: "demo-user-admin-pro-plus",
      profileId: "demo-profile-admin-pro-plus",
      actorId: "demo-social-actor-admin-pro-plus",
      actorHandle: "demo-admin",
    },
    {
      email: "pro@greyhoundiq.test",
      displayName: "Patricia Pro",
      tier: "pro",
      role: "trainer",
      verified: true,
      avatarAssetId: "asset-profile-patricia-pro",
      avatarUrl: DEMO_PROFILE_PORTRAITS["Patricia Pro"],
      userId: "demo-user-pro",
      profileId: "demo-profile-pro",
      actorId: "demo-social-actor-pro",
      actorHandle: "demo-pro",
    },
    {
      email: "free@greyhoundiq.test",
      displayName: "Freddie Free",
      tier: "free",
      role: "member",
      verified: false,
      avatarAssetId: "asset-profile-freddie-free",
      avatarUrl: DEMO_PROFILE_PORTRAITS["Freddie Free"],
      userId: "demo-user-free",
      profileId: "demo-profile-free",
      actorId: "demo-social-actor-free",
      actorHandle: "demo-free",
    },
    {
      email: "proplus@greyhoundiq.test",
      displayName: "Quentin Quant",
      tier: "pro_plus",
      role: "breeder",
      verified: true,
      avatarAssetId: "asset-profile-quentin-quant",
      avatarUrl: DEMO_PROFILE_PORTRAITS["Quentin Quant"],
      userId: "demo-user-pro-plus",
      profileId: "demo-profile-pro-plus",
      actorId: "demo-social-actor-pro-plus",
      actorHandle: "demo-pro-plus",
    },
  ],
  friendship: { id: "demo-friendship-admin-pro" },
  page: {
    id: "demo-custom-page-control-room",
    actorId: "demo-social-actor-control-room",
    handle: "demo-control-room",
  },
  pageMedia: [
    {
      id: "demo-page-media-avatar",
      assetId: "asset-control-room-brand-mark",
      publicUrl: DEMO_CONTROL_ROOM_AVATAR,
      width: 512,
      height: 512,
      sha256: "a3fa996a89fc599fb12a89e8b414de8fe8079fd912793329deb719c6cc1afd60",
      altText: "GreyhoundIQ purple and gold identity mark.",
    },
    {
      id: "demo-page-media-banner",
      assetId: "asset-control-room-banner",
      publicUrl: "/images/site-header-gate-burst-landscape.webp",
      width: 2400,
      height: 500,
      sha256: "654cde0135b31ca8ba1bf1b2c0f313f922d1b40e985656b4245507e736360201",
      altText: "Greyhounds breaking from the starting boxes under race-night lights.",
    },
    {
      id: "demo-page-media-logo",
      assetId: "asset-control-room-wordmark",
      publicUrl: "/images/logo-wordmark-purple-gold.webp",
      width: 900,
      height: 222,
      sha256: "6519b9aed615511ac03c8e9fc10bd64c77e3ff1acd1d62bacdb27a753e907a69",
      altText: "GreyhoundIQ purple and gold wordmark.",
    },
    {
      id: "demo-page-media-gallery-stats",
      assetId: "asset-control-room-gallery-stats",
      publicUrl: "/images/feature-advanced-stats-green.webp",
      width: 1536,
      height: 1024,
      sha256: "58e0bea2e27bf4363e43a1b6ac7c5da6e93ad95ecc6816ec19d3ee4a748f19a5",
      altText: "Premium racing statistics workspace in green and charcoal.",
    },
    {
      id: "demo-page-media-gallery-breeding",
      assetId: "asset-control-room-gallery-breeding",
      publicUrl: "/images/feature-breeding-analytics-gold.webp",
      width: 1536,
      height: 1024,
      sha256: "087e930ca1fd258f1c4434e78f9743a6e45613321cd344eb029a87c40ebdeb01",
      altText: "Greyhound breeding analytics workspace in gold and charcoal.",
    },
    {
      id: "demo-page-media-gallery-ai",
      assetId: "asset-control-room-gallery-ai",
      publicUrl: "/images/feature-ai-predictions-blue.webp",
      width: 1536,
      height: 1024,
      sha256: "db1a78912a9a63f346facf5897e87cee680f2747885f773acc3534a1cc1bb012",
      altText: "AI-assisted race analysis workspace in blue and charcoal.",
    },
  ],
  community: {
    categoryId: "forum-category-general",
    categorySlug: "general",
    threadId: "demo-route-audit-thread",
    postId: "demo-route-audit-thread-post",
  },
  conversation: {
    id: "demo-conversation-admin-pro",
    participantIds: [
      "demo-conversation-participant-admin-pro-plus",
      "demo-conversation-participant-pro",
    ],
    messageId: "demo-message-admin-pro-welcome",
  },
  listing: {
    id: "demo-listing-racing-toolkit",
    locationId: "demo-listing-location-racing-toolkit",
    historyId: "demo-listing-history-approved",
  },
  providerSamples: {
    dogId: "cmr0fg5ki00a4ephcaj4sdctc",
    raceId: "c842cd06-5f44-461c-be14-94439ebee1eb",
    trackId: "ce9ee26f-b678-4a19-9aa7-58185d2a3719",
  },
} as const;

export const DEMO_SYNTHETIC_PRIVATE_MODELS = [
  "User",
  "Profile",
  "SocialActor",
  "Friendship",
  "CustomPage",
  "MediaAsset",
  "ActorGalleryMedia",
  "Thread",
  "Post",
  "Conversation",
  "ConversationParticipant",
  "Message",
  "Listing",
  "ListingLocation",
  "ListingStatusHistory",
] as const;

export const DEMO_REFERENCE_SEED_MODELS = ["ForumCategory"] as const;
export const DEMO_LOCAL_DERIVED_MODELS = ["ListingSearchIndex"] as const;
export const DEMO_PRIVATE_FIXTURE_ROW_COUNT = 37;

export function assertDemoFixtureManifest() {
  const manifestText = JSON.stringify(DEMO_FIXTURE_MANIFEST);
  if (/Daniel Fleuren|daniel-fleuren-founder-portrait/i.test(manifestText)) {
    throw new Error("demo_fixture_manifest.real_person");
  }

  const approvedAssets = new Map(
    DEMO_FIXTURE_APPROVED_ASSETS.map((asset) => [asset.id, asset]),
  );
  if (approvedAssets.size !== DEMO_FIXTURE_APPROVED_ASSETS.length) {
    throw new Error("demo_fixture_manifest.duplicate_asset_id");
  }
  if (
    new Set(DEMO_FIXTURE_APPROVED_ASSETS.map((asset) => asset.filePath)).size !==
      DEMO_FIXTURE_APPROVED_ASSETS.length ||
    new Set(DEMO_FIXTURE_APPROVED_ASSETS.map((asset) => asset.publicUrl)).size !==
      DEMO_FIXTURE_APPROVED_ASSETS.length
  ) {
    throw new Error("demo_fixture_manifest.duplicate_asset_path");
  }
  for (const asset of DEMO_FIXTURE_APPROVED_ASSETS) {
    if (
      !/^[a-f0-9]{64}$/.test(asset.sha256) ||
      asset.sizeBytes <= 0 ||
      asset.width <= 0 ||
      asset.height <= 0 ||
      asset.provenance.synthetic !== true ||
      asset.provenance.realPersonSource !== false ||
      asset.provenance.approvedForPrivateFixtures !== true
    ) {
      throw new Error(`demo_fixture_manifest.asset_not_approved: ${asset.id}`);
    }
    if (`/${asset.filePath.replace(/^public\//, "")}` !== asset.publicUrl) {
      throw new Error(`demo_fixture_manifest.asset_path_mismatch: ${asset.id}`);
    }
  }

  const referencedAssetIds = new Set<string>();
  for (const account of DEMO_FIXTURE_MANIFEST.accounts) {
    if (!account.email.endsWith(".test")) {
      throw new Error(`demo_fixture_manifest.non_test_email: ${account.email}`);
    }
    for (const id of [account.userId, account.profileId, account.actorId]) {
      assertReservedId(id);
    }
    if (!account.actorHandle.startsWith("demo-")) {
      throw new Error(`demo_fixture_manifest.actor_handle: ${account.actorHandle}`);
    }
    const asset = approvedAssets.get(account.avatarAssetId);
    if (!asset || asset.publicUrl !== account.avatarUrl) {
      throw new Error(`demo_fixture_manifest.account_asset: ${account.userId}`);
    }
    if (
      account.displayName !== DEMO_ADMIN_DISPLAY_NAME &&
      (asset.provenance.kind !== "fictional-generated-persona-portrait" ||
        !("personaName" in asset.provenance) ||
        asset.provenance.personaName !== account.displayName)
    ) {
      throw new Error(`demo_fixture_manifest.persona_provenance: ${account.userId}`);
    }
    referencedAssetIds.add(account.avatarAssetId);
  }
  for (const pageAsset of DEMO_FIXTURE_MANIFEST.pageMedia) {
    const asset = approvedAssets.get(pageAsset.assetId);
    if (
      !asset ||
      asset.publicUrl !== pageAsset.publicUrl ||
      asset.sha256 !== pageAsset.sha256 ||
      asset.width !== pageAsset.width ||
      asset.height !== pageAsset.height
    ) {
      throw new Error(`demo_fixture_manifest.page_asset: ${pageAsset.id}`);
    }
    referencedAssetIds.add(pageAsset.assetId);
  }
  if (
    referencedAssetIds.size !== DEMO_FIXTURE_APPROVED_ASSETS.length ||
    DEMO_FIXTURE_APPROVED_ASSETS.some(
      (asset) => !referencedAssetIds.has(asset.id),
    )
  ) {
    throw new Error("demo_fixture_manifest.unreferenced_approved_asset");
  }

  const ids = [
    ...DEMO_FIXTURE_MANIFEST.accounts.flatMap((account) => [
      account.userId,
      account.profileId,
      account.actorId,
    ]),
    DEMO_FIXTURE_MANIFEST.friendship.id,
    DEMO_FIXTURE_MANIFEST.page.id,
    DEMO_FIXTURE_MANIFEST.page.actorId,
    ...DEMO_FIXTURE_MANIFEST.pageMedia.map((asset) => asset.id),
    DEMO_FIXTURE_MANIFEST.community.threadId,
    DEMO_FIXTURE_MANIFEST.community.postId,
    DEMO_FIXTURE_MANIFEST.conversation.id,
    ...DEMO_FIXTURE_MANIFEST.conversation.participantIds,
    DEMO_FIXTURE_MANIFEST.conversation.messageId,
    DEMO_FIXTURE_MANIFEST.listing.id,
    DEMO_FIXTURE_MANIFEST.listing.locationId,
    DEMO_FIXTURE_MANIFEST.listing.historyId,
  ];
  ids.forEach(assertReservedId);
  if (!DEMO_FIXTURE_MANIFEST.community.categoryId.startsWith("forum-category-")) {
    throw new Error("demo_fixture_manifest.unreserved_reference_id");
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error("demo_fixture_manifest.duplicate_id");
  }
}

function assertReservedId(id: string) {
  if (!id.startsWith("demo-")) {
    throw new Error(`demo_fixture_manifest.unreserved_id: ${id}`);
  }
}
