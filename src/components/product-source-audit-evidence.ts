export const PRODUCT_SOURCE_AUDIT_SCOPE =
  "Source-static repository discovery only; browser journeys, runtime behaviour, deployment parity, database behaviour, authentication enforcement, billing-provider settlement and runtime feature-flag values remain separate gates.";

export const PRODUCT_SOURCE_AUDIT_EVIDENCE_FILE =
  "src/components/product-source-audit-evidence.ts";
export const PRODUCT_SOURCE_AUDIT_TEST_FILE =
  "src/components/product-source-audit-evidence.test.ts";

const STRUCTURE_EVIDENCE = [
  PRODUCT_SOURCE_AUDIT_EVIDENCE_FILE,
  PRODUCT_SOURCE_AUDIT_TEST_FILE,
  "src/app/layout.tsx",
  "src/app/admin/layout.tsx",
] as const;

const ROUTE_EVIDENCE = [
  PRODUCT_SOURCE_AUDIT_EVIDENCE_FILE,
  PRODUCT_SOURCE_AUDIT_TEST_FILE,
  "src/components/product-route-tree-evidence.test.ts",
] as const;

const TEST_INVENTORY_EVIDENCE = [
  PRODUCT_SOURCE_AUDIT_EVIDENCE_FILE,
  PRODUCT_SOURCE_AUDIT_TEST_FILE,
  "scripts/run-unit-tests.ts",
  "package.json",
] as const;

const FIXTURE_EVIDENCE = [
  PRODUCT_SOURCE_AUDIT_EVIDENCE_FILE,
  PRODUCT_SOURCE_AUDIT_TEST_FILE,
  "src/components/demo-experience-registry.ts",
  "src/components/demo-experience-registry.test.ts",
] as const;

const API_HANDLER_EVIDENCE = [
  PRODUCT_SOURCE_AUDIT_EVIDENCE_FILE,
  PRODUCT_SOURCE_AUDIT_TEST_FILE,
  "security/endpoints.ts",
  "security/registry.test.ts",
  "src/components/product-route-tree-evidence.test.ts",
] as const;

const DATABASE_MODEL_EVIDENCE = [
  PRODUCT_SOURCE_AUDIT_EVIDENCE_FILE,
  PRODUCT_SOURCE_AUDIT_TEST_FILE,
  "prisma/schema.prisma",
] as const;

const FEATURE_FLAG_EVIDENCE = [
  PRODUCT_SOURCE_AUDIT_EVIDENCE_FILE,
  PRODUCT_SOURCE_AUDIT_TEST_FILE,
  "src/components/demo-experience-registry.ts",
  "src/lib/design-lab-access.ts",
] as const;

const AUTHENTICATION_FLOW_EVIDENCE = [
  PRODUCT_SOURCE_AUDIT_EVIDENCE_FILE,
  PRODUCT_SOURCE_AUDIT_TEST_FILE,
  "security/api-surface-inventory.ts",
  "security/application-surface-inventory.ts",
  "src/app/sign-in/route.ts",
  "src/app/callback/route.ts",
] as const;

const BILLING_FLOW_EVIDENCE = [
  PRODUCT_SOURCE_AUDIT_EVIDENCE_FILE,
  PRODUCT_SOURCE_AUDIT_TEST_FILE,
  "security/application-surface-inventory.ts",
  "src/lib/billing/stripe-service.ts",
  "src/lib/billing/stripe-webhooks.ts",
  "src/lib/billing/lago-webhooks.ts",
] as const;

const REDIRECT_EVIDENCE = [
  PRODUCT_SOURCE_AUDIT_EVIDENCE_FILE,
  PRODUCT_SOURCE_AUDIT_TEST_FILE,
  "src/app/sign-in/route.ts",
  "src/app/callback/route.ts",
  "src/lib/workos-redirect.test.ts",
] as const;

const BILLING_RETURN_EVIDENCE = [
  PRODUCT_SOURCE_AUDIT_EVIDENCE_FILE,
  PRODUCT_SOURCE_AUDIT_TEST_FILE,
  "security/application-surface-inventory.ts",
  "src/lib/billing/stripe-service.ts",
  "src/lib/billing/stripe-readiness.test.ts",
] as const;

export const PRODUCT_ROUTE_CAPABILITY_SOURCE_AUDIT_SCOPE =
  "Source-static interface, validation/delegation and UI-binding inspection only; request execution, authorisation enforcement, persistence, network responses, browser behaviour and production runtime remain separate gates.";

export type ProductRouteCapabilitySourceEvidenceRecord = {
  requirementId: string;
  interfacePath: string;
  interfaceExport: string;
  requiredInterfaceCalls: readonly string[];
  delegatePath: string;
  delegateExport: string;
  requiredDelegateCalls?: readonly string[];
  bindingPath: string;
  requiredBindingSignals: readonly string[];
  additionalBindings?: readonly {
    path: string;
    requiredSignals: readonly string[];
  }[];
  sourceFunctionChecks?: readonly {
    path: string;
    functionName: string;
    requiredCalls?: readonly string[];
    requiredSignals?: readonly string[];
  }[];
};

const RACE_EXPLORER_SOURCE_CHAIN = {
  interfacePath: "src/app/races/page.tsx",
  interfaceExport: "RacesPage",
  requiredInterfaceCalls: ["getRaceExplorerData", "firstParam"],
  delegatePath: "src/lib/queries.ts",
  delegateExport: "getRaceExplorerData",
  requiredDelegateCalls: ["fetchRaceExplorerData"],
  bindingPath: "src/app/races/page.tsx",
} as const;

const RACE_DETAIL_SOURCE_CHAIN = {
  interfacePath: "src/app/races/[id]/page.tsx",
  interfaceExport: "RacePage",
  requiredInterfaceCalls: [
    "getRaceById",
    "notFound",
    "getPreviousRaceVideoRunners",
    "collectPreviousRaceVideoCandidates",
    "resolvePreviousRaceVideos",
  ],
  delegatePath: "src/lib/queries.ts",
  delegateExport: "getPreviousRaceVideoRunners",
  requiredDelegateCalls: [
    "safeQuery",
    "withDbAnonymousQueryDeadline",
    "tx.race.findUnique",
    "currentRace.runners.map",
    "tx.runner.findMany",
    "getBoundedRaceDetailVideos",
  ],
  bindingPath: "src/app/races/[id]/page.tsx",
} as const;

const DOG_SEARCH_SOURCE_CHAIN = {
  interfacePath: "src/app/api/dogs/search/route.ts",
  interfaceExport: "GET",
  requiredInterfaceCalls: [
    "isEmergencyControlActive",
    "getClientIp",
    "checkRateLimit",
    "searchParams.get",
    "searchDogs",
    "NextResponse.json",
  ],
  delegatePath: "src/lib/queries.ts",
  delegateExport: "searchDogs",
  requiredDelegateCalls: ["cached", "runDogSearch"],
  bindingPath: "src/components/dog-search.tsx",
} as const;

const ACCOUNT_CHECKOUT_SOURCE_CHAIN = {
  interfacePath: "src/app/api/billing/checkout/route.ts",
  interfaceExport: "POST",
  requiredInterfaceCalls: [
    "checkoutRequestSchema.parse",
    "readBoundedJsonOrFormRequest",
    "getStripeCheckoutEnv",
    "assertTrustedOrigin",
    "requireCurrentUserProfile",
    "checkRateLimit",
    "createStripeCheckoutSession",
    "NextResponse.redirect",
  ],
  delegatePath: "src/lib/billing/stripe-service.ts",
  delegateExport: "createStripeCheckoutSession",
  requiredDelegateCalls: [
    "getStripeClient",
    "getOrCreateStripeCustomer",
    "stripe.checkout.sessions.create",
    "buildStripeCheckoutSessionParams",
  ],
  bindingPath: "src/app/account/page.tsx",
} as const;

const ACCOUNT_BILLING_OVERVIEW_SOURCE_CHAIN = {
  interfacePath: "src/app/account/billing/page.tsx",
  interfaceExport: "BillingPage",
  requiredInterfaceCalls: ["getCurrentUser"],
  delegatePath: "src/lib/billing/entitlement-service.ts",
  delegateExport: "getEntitlementLimitsForCurrentUser",
  requiredDelegateCalls: [
    "safeQuery",
    "withDbSystemContext",
    "tx.entitlementSnapshot.findFirst",
    "parseEntitlementLimits",
  ],
  bindingPath: "src/app/account/billing/page.tsx",
} as const;

const ACCOUNT_HELP_SOURCE_CHAIN = {
  interfacePath: "src/components/interactive-help.tsx",
  interfaceExport: "InteractiveHelpMenuControls",
  requiredInterfaceCalls: ["useInteractiveHelpState", "updateInteractiveHelp"],
  delegatePath: "src/components/interactive-help-state.ts",
  delegateExport: "reduceInteractiveHelpState",
  bindingPath: "src/components/account-support-help-centre.tsx",
} as const;

const COMMUNITY_DISCOVERY_SOURCE_CHAIN = {
  interfacePath: "src/app/discover/page.tsx",
  interfaceExport: "DiscoverPage",
  requiredInterfaceCalls: ["getCurrentUser", "discoverSocialActorsAndDogs"],
  delegatePath: "src/lib/social-discovery.ts",
  delegateExport: "discoverSocialActorsAndDogs",
  requiredDelegateCalls: [
    "tx.socialActor.findMany",
    "tx.dog.findMany",
    "withDbRequestContext",
    "withDbAnonymousContext",
  ],
  bindingPath: "src/app/discover/page.tsx",
} as const;

const COMMUNITY_FRIEND_RESPONSE_SOURCE_CHAIN = {
  interfacePath: "src/app/actions.ts",
  interfaceExport: "respondToFriendRequestAction",
  requiredInterfaceCalls: [
    "requireCurrentUserProfile",
    "checkRateLimit",
    "friendRespondSchema.parse",
    "respondToFriendRequest",
  ],
  delegatePath: "src/lib/friend-service.ts",
  delegateExport: "respondToFriendRequest",
  requiredDelegateCalls: [
    "withDbRequestContext",
    "tx.friendship.findFirst",
    "createAuditLog",
    "createInAppNotificationDeduped",
    "broadcastProfileRealtimeEvent",
  ],
  bindingPath: "src/components/hub/hub-messenger-panel.tsx",
} as const;

const COMMUNITY_FOLLOW_SOURCE_CHAIN = {
  interfacePath: "src/app/p/[handle]/actions.ts",
  interfaceExport: "toggleActorFollowAction",
  requiredInterfaceCalls: [
    "requireCurrentUserProfile",
    "checkRateLimit",
    "followSchema.parse",
    "toggleActorFollow",
  ],
  delegatePath: "src/lib/social-actor-service.ts",
  delegateExport: "toggleActorFollow",
  requiredDelegateCalls: [
    "withDbRequestContext",
    "ensurePersonalActor",
    "tx.actorFollow.findUnique",
    "tx.actorFollow.delete",
    "tx.actorFollow.create",
    "createInAppNotification",
  ],
  bindingPath: "src/app/p/[handle]/page.tsx",
} as const;

const COMMUNITY_MESSAGE_SEND_SOURCE_CHAIN = {
  interfacePath: "src/app/api/conversations/[id]/messages/route.ts",
  interfaceExport: "POST",
  requiredInterfaceCalls: [
    "requireCurrentUserProfile",
    "checkRateLimit",
    "conversationMessageSchema.parse",
    "readBoundedJsonRequest",
    "sendConversationMessage",
    "NextResponse.json",
  ],
  delegatePath: "src/lib/conversation-service.ts",
  delegateExport: "sendConversationMessage",
  requiredDelegateCalls: [
    "getConversationForProfile",
    "assertNotBlocked",
    "resolveConversationActorsForSender",
    "assertProfilesCanInteract",
    "assertProfileCanReceiveMessage",
    "assertMediaAttachable",
    "findBannedPhraseMatch",
    "withDbRequestContext",
    "tx.message.create",
    "createAuditLog",
    "broadcastConversationRefresh",
    "createInAppNotificationDeduped",
  ],
  bindingPath: "src/components/instant-message-composer.tsx",
} as const;

const COMMUNITY_UPLOAD_RECOVERY_SOURCE_CHAIN = {
  interfacePath: "src/app/api/media/sign-upload/route.ts",
  interfaceExport: "POST",
  requiredInterfaceCalls: [
    "isEmergencyControlActive",
    "requireCurrentUserProfile",
    "checkRateLimit",
    "mediaSignUploadSchema.parse",
    "createSignedUploadIntent",
  ],
  delegatePath: "src/lib/media-service.ts",
  delegateExport: "createSignedUploadIntent",
  bindingPath: "src/components/media-attachment-fields.tsx",
} as const;

const COMMUNITY_CALL_START_SOURCE_CHAIN = {
  interfacePath: "src/app/api/calls/rooms/route.ts",
  interfaceExport: "POST",
  requiredInterfaceCalls: [
    "requireCurrentUserProfile",
    "checkRateLimit",
    "rateLimitExceededResponse",
    "readBoundedJsonRequest",
    "callRoomCreateSchema.parse",
    "createCallRoomForConversation",
    "NextResponse.json",
  ],
  delegatePath: "src/lib/call-service.ts",
  delegateExport: "createCallRoomForConversation",
  requiredDelegateCalls: [
    "assertPaidFeatureAccess",
    "getConversationForProfile",
    "assertProfilesCanInteract",
    "findActiveCallRoom",
    "randomUUID",
    "withDbRequestContext",
    "tx.callRoom.create",
    "tx.callEvent.create",
    "createAuditLog",
    "broadcastConversationRealtimeEvent",
    "broadcastProfileRealtimeEvent",
  ],
  bindingPath: "src/components/conversation-call-panel.tsx",
  additionalBindings: [
    {
      path: "src/lib/call-client-actions.ts",
      requiredSignals: [
        'fetch("/api/calls/rooms", {',
        'method: "POST"',
        "body: JSON.stringify({ conversationId, callType })",
      ],
    },
  ],
} as const;

const MARKETPLACE_DIRECTORY_SOURCE_CHAIN = {
  interfacePath: "src/app/listings/page.tsx",
  interfaceExport: "ListingsPage",
  requiredInterfaceCalls: ["getCurrentUser"],
  delegatePath: "src/lib/queries.ts",
  delegateExport: "getMarketplaceListings",
  requiredDelegateCalls: [
    "marketplaceListingsCacheKey",
    "Date.now",
    "fetchMarketplaceListings",
  ],
  bindingPath: "src/app/listings/page.tsx",
} as const;

const MARKETPLACE_DETAIL_SOURCE_CHAIN = {
  interfacePath: "src/app/listings/[id]/page.tsx",
  interfaceExport: "ListingDetailPage",
  requiredInterfaceCalls: [
    "Promise.all",
    "getOptionalCurrentUser",
    "getListingForViewerById",
    "notFound",
    "listingIsExpired",
  ],
  delegatePath: "src/lib/listing-service.ts",
  delegateExport: "getListingForViewerById",
  requiredDelegateCalls: [
    "withDbSystemContext",
    "tx.listing.findUnique",
    "listingInclude",
    "listingIsPublic",
    "isModeratorRole",
  ],
  bindingPath: "src/app/listings/[id]/page.tsx",
} as const;

const ADMIN_USER_ACCESS_SOURCE_CHAIN = {
  interfacePath: "src/app/admin/mutations.ts",
  interfaceExport: "updateAdminUserAccessAction",
  requiredInterfaceCalls: [
    "requireAdminProfile",
    "updateUserAccessSchema.parse",
    "updateAdminUserAccess",
    "revalidateAdmin",
  ],
  delegatePath: "src/lib/admin-service.ts",
  delegateExport: "updateAdminUserAccess",
  requiredDelegateCalls: [
    "assertAdmin",
    "cleanAdminReason",
    "withDbRequestContext",
    "lockAdminAccessChanges",
    "Promise.all",
    "tx.user.findUnique",
    "tx.profile.count",
    "assertAdminSelfAccessChange",
    "assertLastAdminAccessChange",
    "tx.user.update",
    "tx.profile.update",
    "logAdminMutation",
  ],
  bindingPath: "src/app/admin/form-controls.tsx",
} as const;

const ADMIN_USERS_DIRECTORY_SOURCE_CHAIN = {
  interfacePath: "src/app/admin/users/page.tsx",
  interfaceExport: "AdminUsersPage",
  requiredInterfaceCalls: [
    "requireAdminProfile",
    "parseAdminUsersQuery",
    "getUsers",
    "result.users.find",
    "buildAdminUsersHref",
  ],
  delegatePath: "src/lib/auth.ts",
  delegateExport: "requireAdminProfile",
  requiredDelegateCalls: ["requireCurrentUserProfile", "isAdminRole"],
  bindingPath: "src/app/admin/users/page.tsx",
} as const;

const STRIPE_WEBHOOK_SOURCE_CHAIN = {
  interfacePath: "src/app/api/webhooks/stripe/route.ts",
  interfaceExport: "POST",
  requiredInterfaceCalls: [
    "checkRateLimit",
    "getStripeWebhookRateLimitKey",
    "rateLimitExceededResponse",
    "readBoundedWebhookBody",
    "Buffer.from",
    "ingestStripeWebhook",
    "NextResponse.json",
  ],
  delegatePath: "src/lib/billing/stripe-webhooks.ts",
  delegateExport: "ingestStripeWebhook",
  requiredDelegateCalls: [
    "verifyStripeWebhook",
    "createHash",
    "stripeWebhookAuditPayload",
    "safeHeaders",
    "withDbSystemContext",
    "tx.webhookEvent.create",
    "reduceStripeWebhook",
    "isUniqueConstraintError",
    "processDuplicateStripeWebhook",
    "persistFailedStripeWebhook",
  ],
  bindingPath: "src/app/admin/webhooks/page.tsx",
} as const;

export const PRODUCT_ROUTE_CAPABILITY_SOURCE_EVIDENCE_RECORDS = [
  {
    requirementId: "ROUTE.COMMUNITY.post-create",
    interfacePath: "src/app/api/feed/route.ts",
    interfaceExport: "POST",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "checkRateLimit",
      "feedPostWriteSchema.parse",
      "createFeedPostForCurrentUser",
    ],
    delegatePath: "src/lib/feed-service.ts",
    delegateExport: "createFeedPostForCurrentUser",
    bindingPath: "src/components/instant-feed-controls.tsx",
    requiredBindingSignals: [
      'fetch("/api/feed", {',
      'method: "POST"',
      "body: JSON.stringify",
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.post-edit",
    interfacePath: "src/app/api/feed/[postId]/route.ts",
    interfaceExport: "PATCH",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "checkMutationRate",
      "feedPostEditSchema.parse",
      "editFeedPostForCurrentUser",
    ],
    delegatePath: "src/lib/feed-service.ts",
    delegateExport: "editFeedPostForCurrentUser",
    bindingPath: "src/components/instant-feed-controls.tsx",
    requiredBindingSignals: [
      "fetch(`/api/feed/${postId}`, {",
      'method: "PATCH"',
      '"Could not edit post"',
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.post-delete",
    interfacePath: "src/app/api/feed/[postId]/route.ts",
    interfaceExport: "DELETE",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "checkMutationRate",
      "deleteFeedPostForCurrentUser",
    ],
    delegatePath: "src/lib/feed-service.ts",
    delegateExport: "deleteFeedPostForCurrentUser",
    bindingPath: "src/components/instant-feed-controls.tsx",
    requiredBindingSignals: [
      'fetch(`/api/feed/${postId}`, { method: "DELETE" })',
      'window.confirm("Delete this post?")',
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.like",
    interfacePath: "src/app/api/feed/[postId]/reaction/route.ts",
    interfaceExport: "POST",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "checkRateLimit",
      "feedReactionWriteSchema.parse",
      "toggleFeedPostReactionForCurrentUser",
    ],
    delegatePath: "src/lib/feed-service.ts",
    delegateExport: "toggleFeedPostReactionForCurrentUser",
    bindingPath: "src/components/instant-feed-controls.tsx",
    requiredBindingSignals: [
      'toggle(reactionType ?? "like")',
      '{reactionType ? selected.label : "Like"}',
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.unlike",
    interfacePath: "src/app/api/feed/[postId]/reaction/route.ts",
    interfaceExport: "POST",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "checkRateLimit",
      "feedReactionWriteSchema.parse",
      "toggleFeedPostReactionForCurrentUser",
    ],
    delegatePath: "src/lib/feed-service.ts",
    delegateExport: "toggleFeedPostReactionForCurrentUser",
    bindingPath: "src/components/instant-feed-controls.tsx",
    requiredBindingSignals: [
      "const removing = reactionType === nextType;",
      '${reactionType ? "Remove" : "Add"}',
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.react",
    interfacePath: "src/app/api/feed/[postId]/reaction/route.ts",
    interfaceExport: "POST",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "checkRateLimit",
      "feedReactionWriteSchema.parse",
      "toggleFeedPostReactionForCurrentUser",
    ],
    delegatePath: "src/lib/feed-service.ts",
    delegateExport: "toggleFeedPostReactionForCurrentUser",
    bindingPath: "src/components/instant-feed-controls.tsx",
    requiredBindingSignals: [
      "fetch(`/api/feed/${postId}/reaction`, {",
      "REACTIONS.map((reaction) =>",
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.comment",
    interfacePath: "src/app/api/feed/[postId]/comments/route.ts",
    interfaceExport: "POST",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "checkRateLimit",
      "feedCommentWriteSchema.parse",
      "createFeedCommentForCurrentUser",
    ],
    delegatePath: "src/lib/feed-service.ts",
    delegateExport: "createFeedCommentForCurrentUser",
    bindingPath: "src/components/instant-feed-controls.tsx",
    requiredBindingSignals: [
      "fetch(`/api/feed/${postId}/comments`, {",
      'parentCommentId ? "Write a reply" : "Add a comment"',
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.comment-edit",
    interfacePath: "src/app/api/feed/comments/[commentId]/route.ts",
    interfaceExport: "PATCH",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "checkMutationRate",
      "editCommentSchema.parse",
      "editFeedCommentForCurrentUser",
    ],
    delegatePath: "src/lib/feed-service.ts",
    delegateExport: "editFeedCommentForCurrentUser",
    bindingPath: "src/components/feed-comments-panel.tsx",
    requiredBindingSignals: [
      "fetch(`/api/feed/comments/${comment.id}`, {",
      'method: "PATCH"',
      '"Could not edit comment"',
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.comment-delete",
    interfacePath: "src/app/api/feed/comments/[commentId]/route.ts",
    interfaceExport: "DELETE",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "checkMutationRate",
      "deleteFeedCommentForCurrentUser",
    ],
    delegatePath: "src/lib/feed-service.ts",
    delegateExport: "deleteFeedCommentForCurrentUser",
    bindingPath: "src/components/feed-comments-panel.tsx",
    requiredBindingSignals: [
      "fetch(`/api/feed/comments/${comment.id}`, {",
      'method: "DELETE"',
      '"Could not delete comment"',
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.save",
    interfacePath: "src/app/api/feed/[postId]/save/route.ts",
    interfaceExport: "POST",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "checkRateLimit",
      "actorSchema.parse",
      "toggleSavedFeedPostForCurrentUser",
    ],
    delegatePath: "src/lib/feed-service.ts",
    delegateExport: "toggleSavedFeedPostForCurrentUser",
    bindingPath: "src/components/instant-feed-controls.tsx",
    requiredBindingSignals: [
      "fetch(`/api/feed/${postId}/save`, {",
      '{saved ? "Saved" : "Save"}',
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.unsave",
    interfacePath: "src/app/api/feed/[postId]/save/route.ts",
    interfaceExport: "POST",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "checkRateLimit",
      "actorSchema.parse",
      "toggleSavedFeedPostForCurrentUser",
    ],
    delegatePath: "src/lib/feed-service.ts",
    delegateExport: "toggleSavedFeedPostForCurrentUser",
    bindingPath: "src/components/instant-feed-controls.tsx",
    requiredBindingSignals: [
      "setSaved(!previous);",
      "aria-pressed={saved}",
      '{saved ? "Saved" : "Save"}',
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.share",
    interfacePath: "src/app/api/feed/[postId]/share/route.ts",
    interfaceExport: "POST",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "checkRateLimit",
      "feedShareWriteSchema.parse",
      "shareFeedPostForCurrentUser",
    ],
    delegatePath: "src/lib/feed-service.ts",
    delegateExport: "shareFeedPostForCurrentUser",
    bindingPath: "src/components/instant-feed-controls.tsx",
    requiredBindingSignals: [
      "fetch(`/api/feed/${postId}/share`, {",
      "setShared(true);",
      '{shared ? "Shared" : "Share"}',
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.block",
    interfacePath: "src/app/actions.ts",
    interfaceExport: "blockFeedPostAuthor",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "checkRateLimit",
      "blockFeedPostAuthorForCurrentUser",
    ],
    delegatePath: "src/lib/feed-service.ts",
    delegateExport: "blockFeedPostAuthorForCurrentUser",
    bindingPath: "src/components/instant-feed-controls.tsx",
    requiredBindingSignals: [
      'import { blockFeedPostAuthor } from "@/app/actions";',
      "await blockFeedPostAuthor(postId);",
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.report",
    interfacePath: "src/app/actions.ts",
    interfaceExport: "reportFeedPost",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "feedReportSchema.parse",
      "createReportForUser",
    ],
    delegatePath: "src/lib/report-service.ts",
    delegateExport: "createReportForUser",
    bindingPath: "src/components/feed-post-card.tsx",
    requiredBindingSignals: [
      'import { reportFeedPost } from "@/app/actions";',
      "reportFeedPost.bind(null, post.id)",
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.message-react",
    interfacePath: "src/app/actions.ts",
    interfaceExport: "toggleMessageReaction",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "checkRateLimit",
      "toggleConversationMessageReactionForCurrentUser",
    ],
    delegatePath: "src/lib/conversation-service.ts",
    delegateExport: "toggleConversationMessageReaction",
    bindingPath: "src/app/messages/[id]/page.tsx",
    requiredBindingSignals: [
      "toggleMessageReaction.bind(",
      "reactionAction",
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.message-delete",
    interfacePath: "src/app/actions.ts",
    interfaceExport: "deleteConversationMessage",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "softDeleteConversationMessage",
    ],
    delegatePath: "src/lib/conversation-service.ts",
    delegateExport: "softDeleteConversationMessage",
    bindingPath: "src/app/messages/[id]/page.tsx",
    requiredBindingSignals: [
      "deleteConversationMessage.bind(",
      "deleteAction",
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.search-people",
    ...COMMUNITY_DISCOVERY_SOURCE_CHAIN,
    requiredBindingSignals: [
      '["People", results.people]',
      "href={`/p/${actor.handle}`}",
      "No matches in this group.",
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.search-pages",
    ...COMMUNITY_DISCOVERY_SOURCE_CHAIN,
    requiredBindingSignals: [
      '["Trainer pages", results.trainers]',
      '["Dog pages", results.dogPages]',
      '["Punter pages", results.punters]',
      "href={`/p/${actor.handle}`}",
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.search-businesses",
    ...COMMUNITY_DISCOVERY_SOURCE_CHAIN,
    requiredBindingSignals: [
      '["Businesses", results.businesses]',
      "href={`/p/${actor.handle}`}",
      "No matches in this group.",
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.search-greyhounds",
    ...COMMUNITY_DISCOVERY_SOURCE_CHAIN,
    requiredBindingSignals: [
      "results.dogs.map((dog) =>",
      "href={`/dogs/${dog.id}`}",
      "Greyhounds",
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.public-profile",
    interfacePath: "src/app/p/[handle]/page.tsx",
    interfaceExport: "SocialActorPage",
    requiredInterfaceCalls: [
      "getCurrentUser",
      "toViewerContext",
      "getSocialActorProfileByHandle",
      "notFound",
      "getFriendshipState",
    ],
    delegatePath: "src/lib/social-actor-service.ts",
    delegateExport: "getSocialActorProfileByHandle",
    requiredDelegateCalls: [
      "withActorReadContext",
      "tx.socialActor.findFirst",
      "canViewAudience",
      "tx.feedPost.findMany",
      "tx.actorFollow.count",
    ],
    bindingPath: "src/app/p/[handle]/page.tsx",
    requiredBindingSignals: [
      "if (!profile) notFound();",
      "<PersonalProfileView",
      "<ManagedPageView",
      "profile.viewer.isOwner",
    ],
    sourceFunctionChecks: [
      {
        path: "src/lib/social-actor-service.ts",
        functionName: "getSocialActorProfileByHandle",
        requiredSignals: [
          "published: true",
          "giq_profiles_blocked",
          "if (blockState?.blocked) return null;",
          "canViewContact",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.friend-send",
    interfacePath: "src/app/actions.ts",
    interfaceExport: "sendFriendRequestAction",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "checkRateLimit",
      "friendTargetSchema.parse",
      "sendFriendRequest",
    ],
    delegatePath: "src/lib/friend-service.ts",
    delegateExport: "sendFriendRequest",
    requiredDelegateCalls: [
      "assertProfilesCanInteract",
      "friendshipPair",
      "withDbRequestContext",
      "tx.friendship.create",
      "createAuditLog",
      "createInAppNotificationDeduped",
      "broadcastProfileRealtimeEvent",
    ],
    bindingPath: "src/components/hub/add-friend-search.tsx",
    requiredBindingSignals: [
      'formData.set("profileId", profileId);',
      "await sendFriendRequestAction(formData);",
      'setRequestError(',
      'sent ? "Requested" : "Add"',
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.friend-accept",
    ...COMMUNITY_FRIEND_RESPONSE_SOURCE_CHAIN,
    requiredBindingSignals: [
      "<form action={respondToFriendRequestAction}>",
      'name="friendshipId"',
      'name="response" value="accept"',
      "Accept friend request from",
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.friend-decline",
    ...COMMUNITY_FRIEND_RESPONSE_SOURCE_CHAIN,
    requiredBindingSignals: [
      "<form action={respondToFriendRequestAction}>",
      'name="friendshipId"',
      'name="response" value="decline"',
      "Decline friend request from",
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.follow",
    ...COMMUNITY_FOLLOW_SOURCE_CHAIN,
    requiredBindingSignals: [
      "action={toggleActorFollowAction}",
      'name="actorId"',
      'profile.viewer.isFollowing ? "Following" : "Follow"',
      'Sign in to follow',
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.unfollow",
    ...COMMUNITY_FOLLOW_SOURCE_CHAIN,
    requiredBindingSignals: [
      "action={toggleActorFollowAction}",
      'profile.viewer.isFollowing',
      '? "Unfollowing..."',
      '? "Following" : "Follow"',
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.unblock",
    interfacePath: "src/app/actions.ts",
    interfaceExport: "unblockConversation",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "setConversationBlock",
      "revalidatePath",
      "redirect",
    ],
    delegatePath: "src/lib/conversation-service.ts",
    delegateExport: "setConversationBlock",
    requiredDelegateCalls: [
      "getConversationForProfile",
      "withDbRequestContext",
      "tx.conversation.update",
      "tx.userBlock.deleteMany",
      "createAuditLog",
      "broadcastConversationRefresh",
    ],
    bindingPath: "src/app/messages/[id]/page.tsx",
    requiredBindingSignals: [
      "const unblockAction = unblockConversation.bind(null, conversation.id);",
      "<form action={unblockAction}>",
      'pendingLabel="Unblocking..."',
      "Unblock before sending new messages.",
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.post-media",
    interfacePath: "src/app/api/feed/route.ts",
    interfaceExport: "POST",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "checkRateLimit",
      "feedPostWriteSchema.parse",
      "createFeedPostForCurrentUser",
    ],
    delegatePath: "src/lib/feed-service.ts",
    delegateExport: "createFeedPostForCurrentUser",
    requiredDelegateCalls: [
      "assertFeedMediaAttachable",
      "withDbRequestContext",
      "tx.feedPost.create",
      "attachMediaToFeedPost",
    ],
    bindingPath: "src/components/instant-feed-controls.tsx",
    requiredBindingSignals: [
      '.getAll("mediaIds")',
      "body: JSON.stringify({ topicId, body, mediaIds, pageId, visibility })",
      'mediaContext="feed"',
      "maxFiles={10}",
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.thread-create",
    interfacePath: "src/app/actions.ts",
    interfaceExport: "createForumThread",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "assertPaidFeatureAccess",
      "forumThreadSchema.parse",
      "prisma.forumCategory.findUnique",
      "withDbRequestContext",
      "tx.thread.create",
      "tx.post.create",
      "cleanText",
    ],
    delegatePath: "src/lib/content.ts",
    delegateExport: "cleanText",
    requiredDelegateCalls: ["value.replace"],
    bindingPath: "src/app/forum/[slug]/page.tsx",
    requiredBindingSignals: [
      "<form action={createForumThread}",
      'name="categoryId"',
      'name="title"',
      'name="body"',
      'pendingLabel="Creating..."',
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.thread-reply",
    interfacePath: "src/app/actions.ts",
    interfaceExport: "replyToForumThread",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "assertPaidFeatureAccess",
      "forumReplySchema.parse",
      "prisma.thread.findUnique",
      "withDbRequestContext",
      "tx.post.create",
      "tx.thread.update",
      "cleanText",
    ],
    delegatePath: "src/lib/content.ts",
    delegateExport: "cleanText",
    requiredDelegateCalls: ["value.replace"],
    bindingPath: "src/app/forum/threads/[id]/page.tsx",
    requiredBindingSignals: [
      "const replyAction = replyToForumThread.bind(null, thread.id);",
      "<form action={replyAction}",
      'name="body"',
      'pendingLabel="Posting..."',
      "This thread is locked.",
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.conversation-start",
    interfacePath: "src/app/actions.ts",
    interfaceExport: "startChatAction",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "checkRateLimit",
      "friendTargetSchema.parse",
      "startOrGetConversation",
      "redirect",
    ],
    delegatePath: "src/lib/conversation-service.ts",
    delegateExport: "startOrGetConversation",
    requiredDelegateCalls: [
      "withDbRequestContext",
      "requireOwnedActor",
      "resolveConversationRecipient",
      "assertProfileCanReceiveMessage",
      "assertProfilesCanInteract",
      "canonicalProfilePair",
      "tx.conversation.findFirst",
      "tx.conversation.create",
      "ensureConversationParticipants",
    ],
    bindingPath: "src/components/hub/hub-friends-list.tsx",
    requiredBindingSignals: [
      "<form action={startChatAction}>",
      'name="profileId"',
      "Start chat with",
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.conversation-continue",
    ...COMMUNITY_MESSAGE_SEND_SOURCE_CHAIN,
    requiredBindingSignals: [
      "fetch(`/api/conversations/${conversationId}/messages`, {",
      'method: "POST"',
      "startTransition(() => router.refresh());",
      "Send reply",
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.conversation-search",
    interfacePath: "src/app/messages/[id]/page.tsx",
    interfaceExport: "MessageThreadPage",
    requiredInterfaceCalls: [
      "getCurrentUser",
      "getConversationForProfile",
      "searchConversationMessages",
      "notFound",
    ],
    delegatePath: "src/lib/conversation-service.ts",
    delegateExport: "searchConversationMessages",
    requiredDelegateCalls: [
      "rawQuery.trim",
      "withDbRequestContext",
      "tx.conversation.findFirst",
      "tx.message.findMany",
    ],
    bindingPath: "src/app/messages/[id]/page.tsx",
    requiredBindingSignals: [
      'aria-label="Search this conversation"',
      'name="q"',
      'placeholder="Search this conversation"',
      "messageSearch.items.map((message) =>",
      "No matching messages.",
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.send-text",
    ...COMMUNITY_MESSAGE_SEND_SOURCE_CHAIN,
    requiredBindingSignals: [
      'const body = String(formData.get("body") ?? "").trim();',
      'name="body"',
      "body: JSON.stringify({ body, mediaIds })",
      "Send reply",
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.send-image",
    ...COMMUNITY_MESSAGE_SEND_SOURCE_CHAIN,
    requiredBindingSignals: [
      "<MediaAttachmentFields key={resetKey} compact />",
      "body: JSON.stringify({ body, mediaIds })",
    ],
    additionalBindings: [
      {
        path: "src/components/media-attachment-fields.tsx",
        requiredSignals: [
          'mediaContext = "messages"',
          '"image/jpeg"',
          '"image/png"',
          'item.mimeType.startsWith("image/")',
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.send-video",
    ...COMMUNITY_MESSAGE_SEND_SOURCE_CHAIN,
    requiredBindingSignals: [
      "<MediaAttachmentFields key={resetKey} compact />",
      "body: JSON.stringify({ body, mediaIds })",
    ],
    additionalBindings: [
      {
        path: "src/components/media-attachment-fields.tsx",
        requiredSignals: [
          'mediaContext = "messages"',
          '"video/mp4"',
          '"video/webm"',
          'item.mimeType.startsWith("video/")',
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.send-audio",
    ...COMMUNITY_MESSAGE_SEND_SOURCE_CHAIN,
    requiredBindingSignals: [
      "<MediaAttachmentFields key={resetKey} compact />",
      "body: JSON.stringify({ body, mediaIds })",
    ],
    additionalBindings: [
      {
        path: "src/components/media-attachment-fields.tsx",
        requiredSignals: [
          'mediaContext = "messages"',
          '"audio/mp4"',
          '"audio/ogg"',
          'item.mimeType.startsWith("audio/")',
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.send-document",
    ...COMMUNITY_MESSAGE_SEND_SOURCE_CHAIN,
    requiredBindingSignals: [
      "<MediaAttachmentFields key={resetKey} compact />",
      "body: JSON.stringify({ body, mediaIds })",
    ],
    additionalBindings: [
      {
        path: "src/components/media-attachment-fields.tsx",
        requiredSignals: [
          'mediaContext = "messages"',
          '"application/pdf"',
          "Attach media",
          'name={fieldName}',
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.delivery-state",
    interfacePath: "src/app/api/conversations/[id]/delivered/route.ts",
    interfaceExport: "POST",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "checkRateLimit",
      "markConversationDelivered",
      "NextResponse.json",
    ],
    delegatePath: "src/lib/conversation-service.ts",
    delegateExport: "markConversationDelivered",
    requiredDelegateCalls: [
      "getConversationForProfile",
      "withDbRequestContext",
      "tx.message.findMany",
      "tx.messageDeliveryReceipt.createMany",
      "broadcastConversationRealtimeEvent",
    ],
    bindingPath: "src/components/conversation-delivery-acknowledger.tsx",
    requiredBindingSignals: [
      "`/api/conversations/${encodeURIComponent(conversationId)}/delivered`",
      'method: "POST"',
      'credentials: "same-origin"',
      'keepalive: true',
    ],
    additionalBindings: [
      {
        path: "src/app/messages/[id]/page.tsx",
        requiredSignals: [
          "message.deliveryReceipts.find(",
          "isMine && deliveryReceipt",
          "`Delivered ${deliveryReceipt.deliveredAt.toLocaleString(",
          '? "Sent"',
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.read-state",
    interfacePath: "src/app/actions.ts",
    interfaceExport: "markConversationReadAction",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "markConversationRead",
      "revalidatePath",
      "redirect",
    ],
    delegatePath: "src/lib/conversation-service.ts",
    delegateExport: "markConversationRead",
    requiredDelegateCalls: [
      "getConversationForProfile",
      "resolveConversationActorsForSender",
      "withDbRequestContext",
      "tx.message.findMany",
      "tx.message.updateMany",
      "tx.messageReadReceipt.createMany",
      "tx.conversationParticipant.upsert",
      "createAuditLog",
      "broadcastConversationRefresh",
    ],
    bindingPath: "src/app/messages/[id]/page.tsx",
    requiredBindingSignals: [
      "const readAction = markConversationReadAction.bind(null, conversation.id);",
      "<form action={readAction}>",
      "Mark read",
      "message.readReceipts.find(",
      "isMine && readAt",
      "`Read ${readAt.toLocaleString(\"en-AU\", {",
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.message-reply",
    ...COMMUNITY_MESSAGE_SEND_SOURCE_CHAIN,
    requiredBindingSignals: [
      "<form ref={formRef} onSubmit={onSubmit}",
      'name="body"',
      ': "Type a private reply."',
      "Send reply",
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.message-failed",
    ...COMMUNITY_MESSAGE_SEND_SOURCE_CHAIN,
    requiredBindingSignals: [
      "if (!response.ok) throw new Error(await errorMessage(response));",
      "setPendingBody(null);",
      'setError(err instanceof Error ? err.message : "Could not send message");',
      "{error && (",
      "{error}",
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.upload-retry",
    ...COMMUNITY_UPLOAD_RECOVERY_SOURCE_CHAIN,
    requiredBindingSignals: [
      'step = "signing";',
      "failedStep: step",
      'onClick={() => runUpload(item.key, item.failedStep ?? "signing")}',
      "Retry",
    ],
    additionalBindings: [
      {
        path: "src/components/instant-message-composer.tsx",
        requiredSignals: ["<MediaAttachmentFields key={resetKey} compact />"],
      },
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.upload-recovery",
    ...COMMUNITY_UPLOAD_RECOVERY_SOURCE_CHAIN,
    requiredBindingSignals: [
      'return "Retry or remove the failed upload before saving.";',
      "failedStep: step",
      'onClick={() => runUpload(item.key, item.failedStep ?? "signing")}',
      'onClick={() => removeItem(item.key)}',
    ],
    additionalBindings: [
      {
        path: "src/components/instant-message-composer.tsx",
        requiredSignals: ["<MediaAttachmentFields key={resetKey} compact />"],
      },
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.voice-start",
    ...COMMUNITY_CALL_START_SOURCE_CHAIN,
    requiredBindingSignals: [
      "const created = await createClientCallRoom(conversationId, callType);",
      'onClick={() => void startCall("voice")}',
      "Voice call",
    ],
  },
  {
    requirementId: "ROUTE.COMMUNITY.video-start",
    ...COMMUNITY_CALL_START_SOURCE_CHAIN,
    requiredBindingSignals: [
      "const created = await createClientCallRoom(conversationId, callType);",
      'onClick={() => void startCall("video")}',
      "Video call",
    ],
  },
  {
    requirementId: "ROUTE.MARKET.enquiries-route",
    interfacePath: "src/app/api/listings/[id]/enquiry/route.ts",
    interfaceExport: "POST",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "checkRateLimit",
      "listingEnquirySchema.parse",
      "createListingEnquiryForCurrentUser",
    ],
    delegatePath: "src/lib/listing-service.ts",
    delegateExport: "createListingEnquiryForCurrentUser",
    bindingPath: "src/components/instant-listing-enquiry-form.tsx",
    requiredBindingSignals: [
      "fetch(`/api/listings/${listingId}/enquiry`, {",
      'method: "POST"',
      "body: JSON.stringify({ message })",
    ],
  },
  {
    requirementId: "ROUTE.MARKET.media-route",
    interfacePath: "src/app/api/media/[id]/finalize/route.ts",
    interfaceExport: "POST",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "checkRateLimit",
      "mediaFinalizeSchema.parse",
      "finalizeMediaUpload",
    ],
    delegatePath: "src/lib/media-service.ts",
    delegateExport: "finalizeMediaUpload",
    bindingPath: "src/components/media-attachment-fields.tsx",
    requiredBindingSignals: [
      "`/api/media/${ctx.mediaId}/finalize`",
      "altText: ctx.altText?.trim() || undefined",
    ],
    additionalBindings: [
      {
        path: "src/app/listings/new/page.tsx",
        requiredSignals: [
          '<MediaAttachmentFields mediaContext="listings" maxFiles={11} />',
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.MARKET.unavailable-route",
    interfacePath: "src/app/api/listings/[id]/sold/route.ts",
    interfaceExport: "POST",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "checkRateLimit",
      "markListingSoldForCurrentUser",
    ],
    delegatePath: "src/lib/listing-service.ts",
    delegateExport: "markListingSoldForCurrentUser",
    bindingPath: "src/app/listings/[id]/page.tsx",
    requiredBindingSignals: [
      "markListingSold.bind(null, listing.id)",
      "Mark sold",
    ],
    additionalBindings: [
      {
        path: "src/app/actions.ts",
        requiredSignals: [
          "export async function markListingSold(",
          "await markListingSoldForCurrentUser(current, listingId);",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.MARKET.save",
    interfacePath: "src/app/api/listings/[id]/save/route.ts",
    interfaceExport: "POST",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "checkRateLimit",
      "toggleSavedListingForCurrentUser",
    ],
    delegatePath: "src/lib/listing-service.ts",
    delegateExport: "toggleSavedListingForCurrentUser",
    bindingPath: "src/components/instant-save-listing-button.tsx",
    requiredBindingSignals: [
      "fetch(`/api/listings/${listingId}/save`, {",
      'method: "POST"',
      '{saved ? "Saved marketplace item" : "Save marketplace item"}',
    ],
  },
  {
    requirementId: "ROUTE.MARKET.unsave",
    interfacePath: "src/app/api/listings/[id]/save/route.ts",
    interfaceExport: "POST",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "checkRateLimit",
      "toggleSavedListingForCurrentUser",
    ],
    delegatePath: "src/lib/listing-service.ts",
    delegateExport: "toggleSavedListingForCurrentUser",
    bindingPath: "src/components/instant-save-listing-button.tsx",
    requiredBindingSignals: [
      "const previous = saved;",
      "setSaved(!saved);",
      "aria-pressed={saved}",
    ],
  },
  {
    requirementId: "ROUTE.MARKET.enquire",
    interfacePath: "src/app/api/listings/[id]/enquiry/route.ts",
    interfaceExport: "POST",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "checkRateLimit",
      "listingEnquirySchema.parse",
      "createListingEnquiryForCurrentUser",
    ],
    delegatePath: "src/lib/listing-service.ts",
    delegateExport: "createListingEnquiryForCurrentUser",
    bindingPath: "src/components/instant-listing-enquiry-form.tsx",
    requiredBindingSignals: [
      'placeholder="Ask the seller about this marketplace item."',
      "router.push(`/pulse/${conversationId}`)",
      "Message seller in Pulse",
    ],
  },
  {
    requirementId: "ROUTE.MARKET.report",
    interfacePath: "src/app/actions.ts",
    interfaceExport: "reportListing",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "checkRateLimit",
      "listingReportSchema.parse",
      "createReportForUser",
    ],
    delegatePath: "src/lib/report-service.ts",
    delegateExport: "createReportForUser",
    bindingPath: "src/app/listings/[id]/page.tsx",
    requiredBindingSignals: [
      "reportListing.bind(null, listing.id)",
      "Report marketplace item",
      "action={reportAction}",
    ],
  },
  {
    requirementId: "ROUTE.MARKET.publish",
    interfacePath: "src/app/actions.ts",
    interfaceExport: "approveListing",
    requiredInterfaceCalls: [
      "requireModeratorProfile",
      "approveListingForModerator",
    ],
    delegatePath: "src/lib/listing-service.ts",
    delegateExport: "approveListingForModerator",
    bindingPath: "src/app/admin/listings/page.tsx",
    requiredBindingSignals: [
      "approveListing.bind(null, listing.id)",
      "action={approveAction}",
      "Approve",
    ],
  },
  {
    requirementId: "ROUTE.MARKET.unpublish",
    interfacePath: "src/app/actions.ts",
    interfaceExport: "withdrawListing",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "withdrawListingForCurrentUser",
    ],
    delegatePath: "src/lib/listing-service.ts",
    delegateExport: "withdrawListingForCurrentUser",
    bindingPath: "src/app/listings/[id]/page.tsx",
    requiredBindingSignals: [
      "withdrawListing.bind(null, listing.id)",
      "action={withdrawAction}",
      "Withdraw",
    ],
  },
  {
    requirementId: "ROUTE.MARKET.mark-unavailable",
    interfacePath: "src/app/actions.ts",
    interfaceExport: "markListingSold",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "markListingSoldForCurrentUser",
    ],
    delegatePath: "src/lib/listing-service.ts",
    delegateExport: "markListingSoldForCurrentUser",
    bindingPath: "src/app/listings/[id]/page.tsx",
    requiredBindingSignals: [
      "markListingSold.bind(null, listing.id)",
      "action={soldAction}",
      "Mark sold",
    ],
  },
  {
    requirementId: "ROUTE.MARKET.delete",
    interfacePath: "src/app/actions.ts",
    interfaceExport: "removeListing",
    requiredInterfaceCalls: [
      "requireModeratorProfile",
      "moderationReason",
      "removeListingForModerator",
    ],
    delegatePath: "src/lib/listing-service.ts",
    delegateExport: "removeListingForModerator",
    bindingPath: "src/app/admin/listings/page.tsx",
    requiredBindingSignals: [
      "removeListing.bind(null, listing.id)",
      "action={removeAction}",
      "Remove",
    ],
  },
  {
    requirementId: "ROUTE.MARKET.upload-images",
    interfacePath: "src/app/api/media/sign-upload/route.ts",
    interfaceExport: "POST",
    requiredInterfaceCalls: [
      "isEmergencyControlActive",
      "requireCurrentUserProfile",
      "checkRateLimit",
      "mediaSignUploadSchema.parse",
      "createSignedUploadIntent",
    ],
    delegatePath: "src/lib/media-service.ts",
    delegateExport: "createSignedUploadIntent",
    bindingPath: "src/components/media-attachment-fields.tsx",
    requiredBindingSignals: [
      'mediaContext === "listings"',
      'type.startsWith("image/")',
      'postJson<{',
      '}>("/api/media/sign-upload", {',
    ],
    additionalBindings: [
      {
        path: "src/app/listings/new/page.tsx",
        requiredSignals: [
          "Add up to ten clear photos and one video.",
          '<MediaAttachmentFields mediaContext="listings" maxFiles={11} />',
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.MARKET.upload-video",
    interfacePath: "src/app/api/media/sign-upload/route.ts",
    interfaceExport: "POST",
    requiredInterfaceCalls: [
      "isEmergencyControlActive",
      "requireCurrentUserProfile",
      "checkRateLimit",
      "mediaSignUploadSchema.parse",
      "createSignedUploadIntent",
    ],
    delegatePath: "src/lib/media-service.ts",
    delegateExport: "createSignedUploadIntent",
    bindingPath: "src/components/media-attachment-fields.tsx",
    requiredBindingSignals: [
      'mediaContext === "listings"',
      'type.startsWith("video/")',
      'postJson<{',
      '}>("/api/media/sign-upload", {',
    ],
    additionalBindings: [
      {
        path: "src/app/listings/new/page.tsx",
        requiredSignals: [
          "Add up to ten clear photos and one video.",
          '<MediaAttachmentFields mediaContext="listings" maxFiles={11} />',
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.MARKET.remove-media",
    interfacePath: "src/app/api/media/[id]/route.ts",
    interfaceExport: "DELETE",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "checkRateLimit",
      "deleteMediaForCurrentUser",
    ],
    delegatePath: "src/lib/media-service.ts",
    delegateExport: "deleteMediaForCurrentUser",
    bindingPath: "src/components/media-attachment-fields.tsx",
    requiredBindingSignals: [
      "function removeItem(key: string)",
      'fetch(`/api/media/${mediaId}`, { method: "DELETE" })',
      "setItems((current) => current.filter((item) => item.key !== key))",
    ],
    additionalBindings: [
      {
        path: "src/app/listings/new/page.tsx",
        requiredSignals: [
          '<MediaAttachmentFields mediaContext="listings" maxFiles={11} />',
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.MARKET.upload-recovery",
    interfacePath: "src/app/api/media/sign-upload/route.ts",
    interfaceExport: "POST",
    requiredInterfaceCalls: [
      "isEmergencyControlActive",
      "requireCurrentUserProfile",
      "checkRateLimit",
      "mediaSignUploadSchema.parse",
      "createSignedUploadIntent",
    ],
    delegatePath: "src/lib/media-service.ts",
    delegateExport: "createSignedUploadIntent",
    bindingPath: "src/components/media-attachment-fields.tsx",
    requiredBindingSignals: [
      "step = \"signing\";",
      "failedStep: step",
      'onClick={() => runUpload(item.key, item.failedStep ?? "signing")}',
      "Retry",
    ],
    additionalBindings: [
      {
        path: "src/app/listings/new/page.tsx",
        requiredSignals: [
          '<MediaAttachmentFields mediaContext="listings" maxFiles={11} />',
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.MARKET.save-feedback",
    interfacePath: "src/app/api/listings/[id]/save/route.ts",
    interfaceExport: "POST",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "checkRateLimit",
      "toggleSavedListingForCurrentUser",
    ],
    delegatePath: "src/lib/listing-service.ts",
    delegateExport: "toggleSavedListingForCurrentUser",
    bindingPath: "src/components/marketplace-dog-player-card.tsx",
    requiredBindingSignals: [
      "fetch(`/api/listings/${dog.listingId}/save`, {",
      "setStatus(nextSaved ?",
      "removed from your saved listings.",
      'aria-live="polite"',
    ],
  },
  {
    requirementId: "ROUTE.MARKET.manage-route",
    interfacePath: "src/app/actions.ts",
    interfaceExport: "approveListing",
    requiredInterfaceCalls: [
      "requireModeratorProfile",
      "approveListingForModerator",
      "revalidatePath",
      "redirect",
    ],
    delegatePath: "src/lib/listing-service.ts",
    delegateExport: "approveListingForModerator",
    requiredDelegateCalls: [
      "assertModerator",
      "withDbRequestContext",
      "tx.listing.findUnique",
      "tx.listing.update",
      "tx.listingStatusHistory.create",
      "listingExpiryDate",
      "auditListingModeration",
    ],
    bindingPath: "src/app/admin/listings/page.tsx",
    requiredBindingSignals: [
      'title="Marketplace review queue"',
      '<ListingTable listings={pending} mode="pending" />',
      "<form action={approveAction}>",
      '<form action={rejectAction} className="flex gap-2">',
      '<form action={removeAction} className="flex min-w-[220px] gap-2">',
    ],
    sourceFunctionChecks: [
      {
        path: "src/app/admin/listings/page.tsx",
        functionName: "ListingActions",
        requiredCalls: [
          "approveListing.bind",
          "rejectListing.bind",
          "removeListing.bind",
        ],
        requiredSignals: [
          'listing.status === "pending_review"',
          'listing.status === "active"',
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.MARKET.verification-route",
    interfacePath: "src/app/admin/dog-ownership/page.tsx",
    interfaceExport: "AdminDogOwnershipPage",
    requiredInterfaceCalls: ["requireModeratorProfile", "getPendingClaims"],
    delegatePath: "src/lib/db.ts",
    delegateExport: "safeQuery",
    bindingPath: "src/app/admin/dog-ownership/page.tsx",
    requiredBindingSignals: [
      'description: "Review and verify pending dog ownership claims."',
      "Approving marks the claim verified",
      "<AdminDogOwnershipForm",
      'path="/admin/dog-ownership"',
    ],
    sourceFunctionChecks: [
      {
        path: "src/app/admin/dog-ownership/page.tsx",
        functionName: "getPendingClaims",
        requiredCalls: [
          "safeQuery",
          "withDbSystemContext",
          "tx.dogOwnership.findMany",
        ],
        requiredSignals: ['where: { status: "pending" }', "evidence: true"],
      },
    ],
  },
  {
    requirementId: "ROUTE.MARKET.ownership-route",
    interfacePath: "src/app/admin/dog-ownership/page.tsx",
    interfaceExport: "AdminDogOwnershipPage",
    requiredInterfaceCalls: ["requireModeratorProfile", "getPendingClaims"],
    delegatePath: "src/lib/db.ts",
    delegateExport: "safeQuery",
    bindingPath: "src/app/admin/dog-ownership/page.tsx",
    requiredBindingSignals: [
      'title: "Dog ownership claims - GreyhoundIQ"',
      'title="Dog ownership claims"',
      "<AdminDogOwnershipForm",
      'path="/admin/dog-ownership"',
    ],
    sourceFunctionChecks: [
      {
        path: "src/app/admin/dog-ownership/page.tsx",
        functionName: "getPendingClaims",
        requiredCalls: [
          "safeQuery",
          "withDbSystemContext",
          "tx.dogOwnership.findMany",
        ],
        requiredSignals: ['where: { status: "pending" }', "evidence: true"],
      },
    ],
  },
  {
    requirementId: "ROUTE.MARKET.search",
    ...MARKETPLACE_DIRECTORY_SOURCE_CHAIN,
    requiredBindingSignals: [
      'action="/marketplace"',
      'name="q"',
      'placeholder="Title or description"',
      "No items match these filters",
    ],
    sourceFunctionChecks: [
      {
        path: "src/app/listings/page.tsx",
        functionName: "ListingsResults",
        requiredCalls: ["getMarketplaceListings"],
        requiredSignals: [
          "getMarketplaceListings(MARKETPLACE_PAGE_SIZE + 1, {",
          "categorySlug: category || null,",
          "offset: marketplacePageOffset(page),",
        ],
      },
      {
        path: "src/lib/queries.ts",
        functionName: "fetchMarketplaceListings",
        requiredCalls: [
          "findMarketplaceListingSearchCandidates",
          "safeQuery",
          "prisma.listing.findMany",
        ],
        requiredSignals: [
          "const q = filters.q?.trim();",
          "{ title: { contains: q } },",
          "{ description: { contains: q } },",
          "{ searchIndex: { searchText: { contains: q } } },",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.MARKET.filter",
    ...MARKETPLACE_DIRECTORY_SOURCE_CHAIN,
    requiredBindingSignals: [
      'name="category"',
      '<option value="">All categories</option>',
      "Clear filters",
      "No items match these filters",
    ],
    sourceFunctionChecks: [
      {
        path: "src/app/listings/page.tsx",
        functionName: "ListingsResults",
        requiredCalls: ["getMarketplaceListings", "getMarketplaceCategories"],
        requiredSignals: [
          "getMarketplaceListings(MARKETPLACE_PAGE_SIZE + 1, {",
          "categorySlug: category || null,",
          "offset: marketplacePageOffset(page),",
        ],
      },
      {
        path: "src/lib/queries.ts",
        functionName: "fetchMarketplaceListings",
        requiredCalls: ["safeQuery", "prisma.listing.findMany"],
        requiredSignals: [
          "if (filters.categorySlug) where.category = { slug: filters.categorySlug };",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.MARKET.carousel",
    ...MARKETPLACE_DIRECTORY_SOURCE_CHAIN,
    bindingPath: "src/components/listing-card-media-carousel.tsx",
    requiredBindingSignals: [
      'const images = media.filter((item) => item.mimeType.startsWith("image/"));',
      "setActiveIndex((current) => (current - 1 + imageCount) % imageCount);",
      "showNextImage();",
      "{activeImageIndex + 1} / {imageCount}",
    ],
    additionalBindings: [
      {
        path: "src/app/listings/page.tsx",
        requiredSignals: [
          "<ListingCardMediaCarousel",
          "media={listing.media.map(({ media }) => ({",
        ],
      },
    ],
    sourceFunctionChecks: [
      {
        path: "src/app/listings/page.tsx",
        functionName: "ListingsResults",
        requiredCalls: ["getMarketplaceListings"],
        requiredSignals: ["<ListingCardMediaCarousel"],
      },
    ],
  },
  {
    requirementId: "ROUTE.MARKET.media-disclosure",
    ...MARKETPLACE_DETAIL_SOURCE_CHAIN,
    requiredBindingSignals: [
      "Scanning listing media…",
      "Media removed by safety scan",
      "Media safety scan failed",
      "Media processing failed",
      "Preparing listing media…",
      "Listing media queued for processing…",
    ],
    sourceFunctionChecks: [
      {
        path: "src/app/listings/[id]/page.tsx",
        functionName: "ListingAttachment",
        requiredCalls: ["mediaDeliveryUrl"],
        requiredSignals: [
          '["pending", "scanning"].includes(media.scanStatus)',
          'media.scanStatus !== "clean"',
          'media.processingStatus !== "ready"',
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.MARKET.ownership-evidence",
    interfacePath: "src/app/actions.ts",
    interfaceExport: "claimDogOwnership",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "dogOwnershipClaimSchema.parse",
      "field",
      "checkRateLimit",
      "withDbRequestContext",
      "tx.dog.findUnique",
      "tx.dogOwnership.findUnique",
      "tx.dogOwnership.create",
      "createAuditLog",
      "revalidatePath",
      "redirect",
    ],
    delegatePath: "src/lib/account-service.ts",
    delegateExport: "createAuditLog",
    requiredDelegateCalls: [
      "withDbSystemContext",
      "insertAuditLog",
    ],
    sourceFunctionChecks: [
      {
        path: "src/lib/account-service.ts",
        functionName: "insertAuditLog",
        requiredCalls: ["tx.auditLog.createMany", "JSON.stringify"],
      },
    ],
    bindingPath: "src/app/dogs/[id]/page.tsx",
    requiredBindingSignals: [
      "const claimAction = claimDogOwnership.bind(null, dog.id);",
      "<form action={claimAction}",
      'name="evidence"',
      'placeholder="How can we verify this link? e.g. registration papers, kennel records."',
      "Request ownership",
    ],
  },
  {
    requirementId: "ROUTE.MARKET.inventory-separation",
    ...MARKETPLACE_DIRECTORY_SOURCE_CHAIN,
    requiredBindingSignals: [
      "data-marketplace-profile-showcase",
      "Verified dog card showcase",
      "Six interactive public-profile cards",
      "not active sale",
      "data-marketplace-inventory-item",
    ],
    sourceFunctionChecks: [
      {
        path: "src/app/listings/page.tsx",
        functionName: "ListingsResults",
        requiredCalls: ["getMarketplaceListings"],
        requiredSignals: [
          "data-marketplace-inventory-item",
          "<MarketplaceProfileShowcase />",
        ],
      },
      {
        path: "src/app/listings/page.tsx",
        functionName: "MarketplaceProfileShowcase",
        requiredCalls: ["MARKETPLACE_TEMPLATE_LISTINGS.map"],
        requiredSignals: [
          "data-marketplace-profile-showcase",
          "Six interactive public-profile cards",
          "not active sale",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.MARKET.illustrative-disclosure",
    ...MARKETPLACE_DIRECTORY_SOURCE_CHAIN,
    requiredBindingSignals: [
      "Illustrative demo media",
      "Where shown, illustrative fallback media demonstrates the product",
      "experience and does not verify a listing or seller.",
    ],
    sourceFunctionChecks: [
      {
        path: "src/app/listings/page.tsx",
        functionName: "ListingsResults",
        requiredCalls: ["getMarketplaceListings", "getDemoListingImages"],
        requiredSignals: ["Illustrative demo media"],
      },
    ],
  },
  {
    requirementId: "ROUTE.MARKET.explicit-status",
    ...MARKETPLACE_DETAIL_SOURCE_CHAIN,
    requiredBindingSignals: [
      'pending_review: "giq-badge-gold",',
      'expired: "giq-badge-neutral",',
      'sold: "giq-badge-gold",',
      'archived: "giq-badge-neutral",',
      "STATUS_STYLE[listing.status] ?? STATUS_STYLE.archived",
      '{expired && listing.status === "active" ? "expired" : listing.status}',
    ],
  },
  {
    requirementId: "ROUTE.ADMIN.required-reason",
    ...ADMIN_USER_ACCESS_SOURCE_CHAIN,
    requiredBindingSignals: [
      "action={updateAdminUserAccessAction}",
      "<ReasonField />",
      'name="reason"',
      "required",
      "minLength={3}",
      "maxLength={500}",
    ],
    sourceFunctionChecks: [
      {
        path: "src/lib/admin-service.ts",
        functionName: "cleanAdminReason",
        requiredSignals: [
          'const value = reason?.trim() ?? "";',
          'if (value.length < 3) throw new Error("admin.reason_required");',
          "return value.slice(0, 500);",
        ],
      },
      {
        path: "src/app/admin/form-controls.tsx",
        functionName: "ReasonField",
        requiredSignals: [
          'name="reason"',
          "required",
          "minLength={3}",
          "maxLength={500}",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.ADMIN.danger-confirm",
    ...ADMIN_USER_ACCESS_SOURCE_CHAIN,
    requiredBindingSignals: [
      "action={updateAdminUserAccessAction}",
      'name="role"',
      'name="banned"',
      'confirmMessage="Confirm this account access change?"',
    ],
    additionalBindings: [
      {
        path: "src/app/admin/admin-submit-button.tsx",
        requiredSignals: [
          "confirmMessage &&",
          "!window.confirm(confirmMessage)",
          "event.preventDefault();",
        ],
      },
    ],
    sourceFunctionChecks: [
      {
        path: "src/app/admin/admin-submit-button.tsx",
        functionName: "AdminSubmitButton",
        requiredCalls: [
          "useFormStatus",
          "window.confirm",
          "event.preventDefault",
        ],
        requiredSignals: [
          "disabled={pending || disabled}",
          "!event.defaultPrevented &&",
          "confirmMessage &&",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.ADMIN.self-lockout",
    ...ADMIN_USER_ACCESS_SOURCE_CHAIN,
    requiredBindingSignals: [
      "action={updateAdminUserAccessAction}",
      'name="role"',
      'name="banned"',
      'confirmMessage="Confirm this account access change?"',
    ],
    sourceFunctionChecks: [
      {
        path: "src/lib/admin-access-contract.ts",
        functionName: "assertAdminSelfAccessChange",
        requiredSignals: [
          "if (actingUserId !== targetUserId) return;",
          'if (nextRole !== "admin" || banned) {',
          'throw new Error("admin.self_lockout_forbidden");',
        ],
      },
      {
        path: "src/lib/admin-service.ts",
        functionName: "updateAdminUserAccess",
        requiredCalls: [
          "lockAdminAccessChanges",
          "tx.user.findUnique",
          "tx.profile.count",
          "assertAdminSelfAccessChange",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.ADMIN.preserve-queue",
    ...ADMIN_USERS_DIRECTORY_SOURCE_CHAIN,
    requiredBindingSignals: [
      "action={lookupAdminUserAction}",
      'name="lookup"',
      'name="tier"',
      'name="role"',
      "buildAdminUsersHref(query, result.page - 1)",
      "buildAdminUsersHref(query, result.page + 1)",
      "Page {result.page} of {result.pageCount}",
    ],
    sourceFunctionChecks: [
      {
        path: "src/app/admin/users/page.tsx",
        functionName: "getUsers",
        requiredCalls: [
          "safeQuery",
          "withDbSystemContext",
          "tx.user.count",
          "Math.ceil",
          "Math.min",
          "tx.user.findMany",
        ],
        requiredSignals: [
          "skip: (page - 1) * PAGE_SIZE",
          "take: PAGE_SIZE",
        ],
      },
      {
        path: "src/app/admin/users/page.tsx",
        functionName: "parseAdminUsersQuery",
        requiredCalls: [
          "singleQueryValue",
          "Number.parseInt",
          "USER_TIERS.includes",
          "USER_ROLES.includes",
          "Number.isSafeInteger",
        ],
      },
      {
        path: "src/app/admin/users/page.tsx",
        functionName: "buildAdminUsersHref",
        requiredCalls: ["params.set", "params.toString"],
        requiredSignals: [
          'if (query.tier) params.set("tier", query.tier);',
          'if (query.role) params.set("role", query.role);',
          'if (page > 1) params.set("page", String(page));',
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.ADMIN.webhook-idempotency",
    ...STRIPE_WEBHOOK_SOURCE_CHAIN,
    requiredBindingSignals: [
      "Webhook events",
      "Retries",
      "{event.retryCount}",
      'statuses={["received", "processed", "failed", "ignored"]}',
    ],
    additionalBindings: [
      {
        path: "src/app/api/webhooks/stripe/route.ts",
        requiredSignals: [
          "duplicate: result.duplicate",
          "ok: true",
        ],
      },
    ],
    sourceFunctionChecks: [
      {
        path: "src/lib/billing/stripe-webhooks.ts",
        functionName: "processDuplicateStripeWebhook",
        requiredCalls: [
          "withDbSystemContext",
          "findExistingStripeWebhook",
          "tx.webhookEvent.updateMany",
          "reduceStripeWebhook",
          "incrementWebhookRetryCount",
        ],
        requiredSignals: [
          'if (existing.status === "failed")',
          'where: { id: existing.id, status: "failed" }',
          "if (claim.count === 1)",
        ],
      },
      {
        path: "src/lib/billing/stripe-webhooks.ts",
        functionName: "findExistingStripeWebhook",
        requiredCalls: [
          "db.webhookEvent.findUnique",
        ],
        requiredSignals: [
          "where: { lagoEventId: stripeEventId }",
          'where: { provider_payloadHash: { provider: "stripe", payloadHash } }',
          'throw new Error("stripe.webhook_receipt_conflict")',
        ],
      },
      {
        path: "src/lib/billing/stripe-webhooks.ts",
        functionName: "incrementWebhookRetryCount",
        requiredCalls: ["db.webhookEvent.update"],
        requiredSignals: ["data: { retryCount: { increment: 1 } }"],
      },
    ],
  },
  {
    requirementId: "ROUTE.RACING.search-race",
    ...RACE_EXPLORER_SOURCE_CHAIN,
    requiredBindingSignals: [
      'q: firstParam(params.q)',
      'name="q"',
      'placeholder="Search track, runner, R4, 520m"',
    ],
    sourceFunctionChecks: [
      {
        path: "src/lib/queries.ts",
        functionName: "fetchRaceExplorerData",
        requiredCalls: [
          "normaliseRaceSearchParam",
          "findRankedRaceSearchIds",
          "raceSearchWhere",
        ],
      },
      {
        path: "src/lib/queries.ts",
        functionName: "raceSearchWhere",
        requiredCalls: ["parseRaceSearchQuery"],
        requiredSignals: [
          "if (parsed.raceNumber !== null) filters.push({ raceNumber: parsed.raceNumber });",
          "{ name: { contains: parsed.text, mode: insensitive } },",
        ],
      },
      {
        path: "src/lib/queries.ts",
        functionName: "parseRaceSearchQuery",
        requiredCalls: [
          "raceNumberFromSearch",
          "distanceFromSearch",
          "clockTimeFromSearch",
          "structuredSearchText",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.RACING.search-track",
    ...RACE_EXPLORER_SOURCE_CHAIN,
    requiredBindingSignals: [
      'q: firstParam(params.q)',
      'placeholder="Search track, runner, R4, 520m"',
      'href={`/tracks/${track.id}`}',
    ],
    sourceFunctionChecks: [
      {
        path: "src/lib/queries.ts",
        functionName: "fetchRaceExplorerData",
        requiredCalls: ["normaliseRaceSearchParam", "raceSearchWhere"],
      },
      {
        path: "src/lib/queries.ts",
        functionName: "raceSearchWhere",
        requiredCalls: ["parseRaceSearchQuery"],
        requiredSignals: [
          "{ meeting: { track: { name: { contains: parsed.text, mode: insensitive } } } },",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.RACING.search-dog",
    ...DOG_SEARCH_SOURCE_CHAIN,
    requiredBindingSignals: [
      '`/api/dogs/search?q=${encodeURIComponent(query)}`',
      'aria-label="Search for a greyhound by name"',
      "onChange={(e) => handleQueryChange(e.target.value)}",
    ],
    sourceFunctionChecks: [
      {
        path: "src/lib/queries.ts",
        functionName: "runDogSearch",
        requiredCalls: ["safeQuery", "searchDogsTrigram"],
        requiredSignals: [
          "const prefixPattern = `${escapeLikePattern(trimmed)}%`;",
          "WHERE lower(d.name) LIKE lower(${prefixPattern})",
        ],
      },
      {
        path: "src/lib/queries.ts",
        functionName: "searchDogsTrigram",
        requiredCalls: ["safeQuery", "Prisma.join"],
        requiredSignals: ["d.name ILIKE", "similarity(d.name, ${trimmed}) DESC"],
      },
    ],
  },
  {
    requirementId: "ROUTE.RACING.search-date",
    ...RACE_EXPLORER_SOURCE_CHAIN,
    requiredBindingSignals: [
      'date: firstParam(params.date)',
      'type="date"',
      'name="date"',
      'aria-label="Choose race date"',
    ],
    sourceFunctionChecks: [
      {
        path: "src/lib/queries.ts",
        functionName: "fetchRaceExplorerData",
        requiredCalls: ["resolveRaceSearchDate", "raceDateWindow"],
      },
      {
        path: "src/lib/race-search.ts",
        functionName: "resolveRaceSearchDate",
        requiredCalls: ["normaliseRaceDateInput"],
        requiredSignals: [
          'dateInputValue: explicitDate ?? ""',
          "selectedDate: explicitDate ?? defaultDate",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.RACING.search-distance",
    ...RACE_EXPLORER_SOURCE_CHAIN,
    requiredBindingSignals: [
      'q: firstParam(params.q)',
      'placeholder="Search track, runner, R4, 520m"',
    ],
    sourceFunctionChecks: [
      {
        path: "src/lib/queries.ts",
        functionName: "raceSearchWhere",
        requiredCalls: ["parseRaceSearchQuery"],
        requiredSignals: [
          "if (parsed.distance !== null) filters.push({ distance: parsed.distance });",
        ],
      },
      {
        path: "src/lib/queries.ts",
        functionName: "parseRaceSearchQuery",
        requiredCalls: ["distanceFromSearch"],
      },
      {
        path: "src/lib/queries.ts",
        functionName: "distanceFromSearch",
        requiredSignals: ["/\\b(\\d{3,4})\\s*m\\b/i.exec(query)"],
      },
    ],
  },
  {
    requirementId: "ROUTE.RACING.search-grade",
    ...RACE_EXPLORER_SOURCE_CHAIN,
    requiredBindingSignals: [
      'q: firstParam(params.q)',
      'placeholder="Search track, runner, R4, 520m"',
      '{race.grade ? ` / ${race.grade}` : ""}',
    ],
    sourceFunctionChecks: [
      {
        path: "src/lib/queries.ts",
        functionName: "raceSearchWhere",
        requiredCalls: ["parseRaceSearchQuery"],
        requiredSignals: [
          "{ grade: { contains: parsed.text, mode: insensitive } },",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.RACING.search-state",
    ...RACE_EXPLORER_SOURCE_CHAIN,
    requiredBindingSignals: [
      'state: firstParam(params.state)',
      '<FilterGroup label="State">',
      "active={selectedState === state}",
    ],
    sourceFunctionChecks: [
      {
        path: "src/lib/queries.ts",
        functionName: "fetchRaceExplorerData",
        requiredCalls: ["states.includes"],
        requiredSignals: [
          'const selectedState = states.includes(filters.state ?? "")',
          "meeting: { track: { state: selectedState } }",
          "track: { state: selectedState }",
        ],
      },
      {
        path: "src/lib/queries.ts",
        functionName: "raceSearchWhere",
        requiredSignals: [
          "{ meeting: { track: { state: { contains: parsed.text, mode: insensitive } } } },",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.RACING.search-status",
    ...RACE_EXPLORER_SOURCE_CHAIN,
    requiredBindingSignals: [
      'status: firstParam(params.status)',
      '<FilterGroup label="Status">',
      "active={data.selectedStatus === option.value}",
    ],
    sourceFunctionChecks: [
      {
        path: "src/lib/queries.ts",
        functionName: "fetchRaceExplorerData",
        requiredCalls: ["normaliseRaceStatusParam", "raceStatusWhere"],
      },
      {
        path: "src/lib/queries.ts",
        functionName: "normaliseRaceStatusParam",
        requiredSignals: [
          'value === "upcoming" ||',
          'value === "live" ||',
          'value === "resulted" ||',
          'value === "replay"',
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.RACING.date-navigation",
    ...RACE_EXPLORER_SOURCE_CHAIN,
    requiredBindingSignals: [
      "const dateRail = buildDateRail(data.recentRaceDates, data.selectedDate);",
      'aria-label="Race dates"',
      "href={dateLink(",
      "item.date,",
    ],
    sourceFunctionChecks: [
      {
        path: "src/app/races/page.tsx",
        functionName: "buildDateRail",
        requiredCalls: [
          "recentRaceDates.find",
          "recentRaceDates.filter",
        ],
        requiredSignals: [".slice(0, 10)"],
      },
      {
        path: "src/app/races/page.tsx",
        functionName: "dateLink",
        requiredCalls: [
          "params.set",
          "params.toString",
        ],
        requiredSignals: [
          "const params = new URLSearchParams();",
          'params.set("date", date)',
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.RACING.filter-live",
    ...RACE_EXPLORER_SOURCE_CHAIN,
    requiredBindingSignals: [
      '{ value: "live", label: "Live" }',
      "option.value,",
      "active={data.selectedStatus === option.value}",
    ],
    sourceFunctionChecks: [
      {
        path: "src/lib/queries.ts",
        functionName: "raceStatusWhere",
        requiredCalls: ["now.getTime"],
        requiredSignals: [
          'if (status === "live") {',
          "gte: new Date(now.getTime() - 20 * 60 * 1000)",
          "lte: now",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.RACING.filter-upcoming",
    ...RACE_EXPLORER_SOURCE_CHAIN,
    requiredBindingSignals: [
      '{ value: "upcoming", label: "Upcoming" }',
      "option.value,",
      "active={data.selectedStatus === option.value}",
    ],
    sourceFunctionChecks: [
      {
        path: "src/lib/queries.ts",
        functionName: "raceStatusWhere",
        requiredSignals: [
          'if (status === "upcoming") return { raceTime: { gt: now } };',
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.RACING.filter-resulted",
    ...RACE_EXPLORER_SOURCE_CHAIN,
    requiredBindingSignals: [
      '{ value: "resulted", label: "Results" }',
      "option.value,",
      "active={data.selectedStatus === option.value}",
    ],
    sourceFunctionChecks: [
      {
        path: "src/lib/queries.ts",
        functionName: "raceStatusWhere",
        requiredSignals: [
          'if (status === "resulted") {',
          "return { runners: { some: { result: { isNot: null } } } };",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.RACING.filter-replay",
    ...RACE_EXPLORER_SOURCE_CHAIN,
    requiredBindingSignals: [
      '{ value: "replay", label: "Replays" }',
      "option.value,",
      "active={data.selectedStatus === option.value}",
    ],
    sourceFunctionChecks: [
      {
        path: "src/lib/queries.ts",
        functionName: "raceStatusWhere",
        requiredSignals: [
          'if (status === "replay") {',
          "return { videos: { some: { streamUrl: { not: null } } } };",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.RACING.sort-time",
    ...RACE_EXPLORER_SOURCE_CHAIN,
    requiredBindingSignals: [
      'sort: firstParam(params.sort)',
      '<option value="time">Race time</option>',
      'name="sort"',
    ],
    sourceFunctionChecks: [
      {
        path: "src/lib/queries.ts",
        functionName: "normaliseRaceSortParam",
        requiredSignals: ['if (value === "time") return "time";'],
      },
      {
        path: "src/lib/queries.ts",
        functionName: "orderRaceExplorerMeetings",
        requiredCalls: ["orderMeetingsByFirstRaceTime"],
        requiredSignals: ['sort !== "relevance"'],
      },
      {
        path: "src/lib/queries.ts",
        functionName: "orderMeetingsByFirstRaceTime",
        requiredCalls: ["dedupeExactMeetingMatches"],
        requiredSignals: [
          "a.raceTime.getTime() - b.raceTime.getTime()",
          "firstRaceTime(a) - firstRaceTime(b)",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.RACING.sort-relevance",
    ...RACE_EXPLORER_SOURCE_CHAIN,
    requiredBindingSignals: [
      'sort: firstParam(params.sort)',
      '<option value="relevance">Relevance</option>',
      'data.selectedSort === "relevance" ? "ranked" : "time-sorted"',
    ],
    sourceFunctionChecks: [
      {
        path: "src/lib/queries.ts",
        functionName: "normaliseRaceSortParam",
        requiredSignals: ['return hasSearch ? "relevance" : "time";'],
      },
      {
        path: "src/lib/queries.ts",
        functionName: "orderRaceExplorerMeetings",
        requiredCalls: ["rankedRaceIds.map", "raceRank", "meetingRank"],
        requiredSignals: [
          'sort !== "relevance"',
          "raceRank(a) - raceRank(b)",
          "meetingRank(a) - meetingRank(b)",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.RACING.open-race",
    ...RACE_EXPLORER_SOURCE_CHAIN,
    requiredBindingSignals: [
      "detailHref={buildRaceDetailHref(race.id, {",
      "href={detailHref}",
      'aria-label={`Open ${trackName}, ${state} race ${race.raceNumber}',
    ],
    additionalBindings: [
      {
        path: "src/app/races/[id]/page.tsx",
        requiredSignals: [
          "export default async function RacePage(",
          "const race = await getRaceById(id);",
          "if (!race) notFound();",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.RACING.open-dog",
    ...DOG_SEARCH_SOURCE_CHAIN,
    requiredBindingSignals: [
      'href={`/dogs/${dog.id}`}',
      'role="option"',
      "router.push(`/dogs/${results[activeIndex].id}`)",
    ],
    additionalBindings: [
      {
        path: "src/app/dogs/[id]/page.tsx",
        requiredSignals: [
          "export default async function DogProfilePage(",
          "getDogById(id)",
          "if (!dog) notFound();",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.RACING.open-track",
    ...RACE_EXPLORER_SOURCE_CHAIN,
    requiredBindingSignals: [
      'href={`/tracks/${track.id}`}',
      'className="giq-meeting-track-link"',
    ],
    additionalBindings: [
      {
        path: "src/app/tracks/[id]/page.tsx",
        requiredSignals: [
          "export default async function TrackDetailPage(",
          "const track = await getTrackById(id);",
          "if (!track) notFound();",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.RACING.open-replay",
    ...RACE_EXPLORER_SOURCE_CHAIN,
    requiredBindingSignals: [
      "{data.replayRaces.map((race) => (",
      "href={buildRaceDetailHref(race.id, {",
      'aria-label={`Open replay for race ${race.raceNumber}',
    ],
    additionalBindings: [
      {
        path: "src/app/races/[id]/page.tsx",
        requiredSignals: [
          'import { RaceReplayPlayer } from "@/components/race-replay-player";',
          "<RaceReplayPlayer",
          "<ReplayFallback",
          "hasVideoRecord={Boolean(primaryVideo || race.replayUrl || providerReplay)}",
        ],
      },
    ],
    sourceFunctionChecks: [
      {
        path: "src/app/races/page.tsx",
        functionName: "hasReplay",
        requiredCalls: ["race.videos.some"],
        requiredSignals: [
          "return race.videos.some((video) => video.streamUrl);",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.RACING.delayed-records",
    ...RACE_DETAIL_SOURCE_CHAIN,
    requiredBindingSignals: [
      "resultCount === 0",
      '? "Not run - abandoned"',
      '? "Pending - postponed"',
      ': "Pending"',
      "? `Partial ${resultCount}/${expectedResultCount}`",
      "No runners loaded for this race yet.",
      'value={hasPlayableReplay ? "Playable replay" : "Not playable yet"}',
      "<ReplayFallback",
    ],
    sourceFunctionChecks: [
      {
        path: "src/app/races/[id]/page.tsx",
        functionName: "ReplayFallback",
        requiredSignals: [
          "Replay stream not ready",
          "A replay record exists, but a playable stream URL is not attached yet.",
          "This race does not have a replay record in the local archive yet.",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.RACING.meaningful-result",
    ...RACE_EXPLORER_SOURCE_CHAIN,
    requiredBindingSignals: [
      "const hasMeetings = data.meetings.length > 0;",
      "{hasMeetings ? (",
      "{data.meetings.map((meeting) => (",
      ': "No racecards found"}',
      "No races match these filters. Try a broader search, a recent",
      "No upcoming races are available for the active filters.",
    ],
    sourceFunctionChecks: [
      {
        path: "src/lib/queries.ts",
        functionName: "getRaceExplorerMeetings",
        requiredCalls: [
          "safeQuery",
          "db.meeting.findMany",
          "db.race.findMany",
          "db.runner.groupBy",
          "db.raceVideo.findMany",
        ],
        requiredSignals: [
          "if (meetings.length === 0) return [];",
          "if (races.length === 0) {",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.RACING.safe-missing",
    ...RACE_DETAIL_SOURCE_CHAIN,
    requiredBindingSignals: [
      "const race = await getRaceById(id);",
      "if (!race) notFound();",
    ],
    additionalBindings: [
      {
        path: "src/app/not-found.tsx",
        requiredSignals: [
          "404",
          "Off-track.",
          "The page you&apos;re looking for has either been moved, or never existed.",
          'href="/dogs"',
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.RACING.source-completeness",
    ...RACE_DETAIL_SOURCE_CHAIN,
    requiredBindingSignals: [
      "const resultCount = race.runners.filter((runner) => runner.result).length;",
      "const expectedResultCount = activeRunnerCount || race.runners.length;",
      '? `Partial ${resultCount}/${expectedResultCount}`',
      'label="Result status"',
      "No runners loaded for this race yet.",
      'value={hasPlayableReplay ? "Playable replay" : "Not playable yet"}',
    ],
    sourceFunctionChecks: [
      {
        path: "src/app/races/[id]/page.tsx",
        functionName: "PreviousReplayFallback",
        requiredSignals: [
          "Replay source",
          "The provider marks this previous run as having video, but a playable",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.RACING.mobile-tables",
    ...RACE_DETAIL_SOURCE_CHAIN,
    requiredBindingSignals: [
      '<section className="giq-racecard-section giq-table-shell overflow-hidden">',
      '<div className="overflow-x-auto">',
      '<table className="w-full min-w-[720px]">',
    ],
  },
  {
    requirementId: "ROUTE.RACING.row-a11y",
    ...RACE_EXPLORER_SOURCE_CHAIN,
    requiredBindingSignals: [
      "<RaceRowLink",
      'className={`giq-race-row-card giq-race-row-state-${status.key}`}',
      'aria-label={`Open ${trackName}, ${state} race ${race.raceNumber}',
    ],
    sourceFunctionChecks: [
      {
        path: "src/app/races/page.tsx",
        functionName: "RaceRowLink",
        requiredCalls: ["explorerRaceStatus", "formatRaceTime"],
        requiredSignals: [
          "<Link",
          "href={detailHref}",
          'aria-label={`Open ${trackName}, ${state} race ${race.raceNumber}',
          "Status: ${status.label}",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.RACING.validate-id",
    ...RACE_DETAIL_SOURCE_CHAIN,
    requiredBindingSignals: [
      "const { id } = await params;",
      "const race = await getRaceById(id);",
      "if (!race) notFound();",
    ],
    additionalBindings: [
      {
        path: "src/app/dogs/[id]/page.tsx",
        requiredSignals: [
          "getDogById(id),",
          "if (!dog) notFound();",
        ],
      },
      {
        path: "src/app/tracks/[id]/page.tsx",
        requiredSignals: [
          "const track = await getTrackById(id);",
          "if (!track) notFound();",
        ],
      },
      {
        path: "src/lib/queries.ts",
        requiredSignals: [
          "export const getRaceById = cache(async (id: string) => {",
          "export const getDogById = cache(async (id: string) => {",
          "export const getTrackById = cache(async (id: string) => {",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.ACCOUNT.appearance",
    interfacePath: "src/app/account/appearance/page.tsx",
    interfaceExport: "AccountAppearancePage",
    requiredInterfaceCalls: [
      "notFound",
      "resolveAppearancePreviewState",
      "getAppearancePreviewQuery",
      "PROTOTYPE_VARIANTS.find",
      "DOCK_SKIN_REGISTRY.find",
      "MARKETPLACE_TEMPLATE_OPTIONS.find",
    ],
    delegatePath: "src/components/appearance-preview-state.ts",
    delegateExport: "resolveAppearancePreviewState",
    requiredDelegateCalls: [
      "firstValue",
      "isPrototypeVariant",
      "isDockSkinKey",
      "resolveMarketplaceTemplateKey",
      "resolveSponsoredMarketplaceVisibility",
    ],
    bindingPath: "src/app/account/appearance/page.tsx",
    requiredBindingSignals: [
      "data-appearance-studio",
      'name="app"',
      'name="dock"',
      'name="market"',
      'name="sponsored"',
      "Preview only — saving is disabled",
    ],
  },
  {
    requirementId: "ROUTE.ACCOUNT.page-create",
    interfacePath: "src/app/actions.ts",
    interfaceExport: "createCustomPageAction",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "checkRateLimit",
      "field",
      "optional",
      "customPageMediaFields",
      "customPageCreateSchema.parse",
      "createCustomPage",
      "revalidatePath",
      "redirect",
    ],
    delegatePath: "src/lib/custom-page-service.ts",
    delegateExport: "createCustomPage",
    requiredDelegateCalls: [
      "getPlatformFlag",
      "assertPaidFeatureAccess",
      "assertClean",
      "withDbRequestContext",
      "assertMediaAttachable",
      "createAuditLog",
    ],
    bindingPath: "src/app/account/pages/page.tsx",
    requiredBindingSignals: [
      'id="create-page-heading"',
      "Create a page",
      "action={createCustomPageAction}",
      '<input type="hidden" name="pageType" value={type} />',
    ],
  },
  {
    requirementId: "ROUTE.ACCOUNT.page-edit",
    interfacePath: "src/app/actions.ts",
    interfaceExport: "updateCustomPageAction",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "checkRateLimit",
      "customPageUpdateSchema.parse",
      "updateCustomPage",
      "revalidatePath",
      "redirect",
    ],
    delegatePath: "src/lib/custom-page-service.ts",
    delegateExport: "updateCustomPage",
    requiredDelegateCalls: [
      "assertPaidFeatureAccess",
      "requireOwnedPage",
      "assertClean",
      "parseCustomPageContent",
      "assertMediaAttachable",
      "withDbRequestContext",
    ],
    bindingPath: "src/app/account/pages/[id]/page.tsx",
    requiredBindingSignals: [
      "const updateAction = updateCustomPageAction.bind(null, page.id);",
      "<form action={updateAction}",
      'name="title"',
      "Save changes",
    ],
  },
  {
    requirementId: "ROUTE.ACCOUNT.page-delete",
    interfacePath: "src/app/actions.ts",
    interfaceExport: "deleteCustomPageAction",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "destructiveConfirmationSchema.parse",
      "field",
      "deleteCustomPage",
      "revalidatePath",
      "redirect",
    ],
    delegatePath: "src/lib/custom-page-service.ts",
    delegateExport: "deleteCustomPage",
    requiredDelegateCalls: [
      "requireOwnedPage",
      "withDbRequestContext",
      "createAuditLog",
    ],
    bindingPath: "src/app/account/pages/[id]/page.tsx",
    requiredBindingSignals: [
      "const deleteAction = deleteCustomPageAction.bind(null, page.id);",
      '<form action={deleteAction} className="grid gap-2">',
      'name="confirmation"',
      "Delete managed page",
      "Delete this page",
    ],
  },
  {
    requirementId: "ROUTE.ACCOUNT.checkout",
    ...ACCOUNT_CHECKOUT_SOURCE_CHAIN,
    requiredBindingSignals: [
      '<form action="/api/billing/checkout" method="post"',
      '<input name="plan" type="hidden" value="pro" />',
      '<input name="interval" type="hidden" value={interval} />',
      "Continue to secure checkout",
    ],
    sourceFunctionChecks: [
      {
        path: "src/app/api/billing/checkout/route.ts",
        functionName: "assertTrustedOrigin",
        requiredCalls: ["request.headers.get"],
        requiredSignals: [
          'process.env.NODE_ENV === "production"',
          'throw new Error("auth.forbidden")',
        ],
      },
      {
        path: "src/lib/json-request.ts",
        functionName: "readBoundedJsonOrFormRequest",
        requiredCalls: [
          "requestMediaType",
          "request.headers.get",
          "readBoundedJsonRequest",
          "assertIdentityContentEncoding",
          "readBoundedRequestBytes",
          "decodeUtf8",
          "Object.fromEntries",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.ACCOUNT.billing-return",
    interfacePath: "src/lib/billing/stripe-service.ts",
    interfaceExport: "createStripeCheckoutSession",
    requiredInterfaceCalls: [
      "getStripeClient",
      "getOrCreateStripeCustomer",
      "stripe.checkout.sessions.create",
      "buildStripeCheckoutSessionParams",
    ],
    delegatePath: "src/lib/billing/stripe-service.ts",
    delegateExport: "buildStripeCheckoutSessionParams",
    requiredDelegateCalls: [
      "successUrl.searchParams.set",
      "cancelUrl.searchParams.set",
      "successUrl.toString",
      "cancelUrl.toString",
    ],
    bindingPath: "src/app/account/billing/page.tsx",
    requiredBindingSignals: [
      'if (checkout === "success")',
      "Returned from Stripe Checkout",
      "The local plan only changes after the signed Stripe webhook is",
      'href="/account/billing"',
    ],
  },
  {
    requirementId: "ROUTE.ACCOUNT.billing-cancel",
    interfacePath: "src/app/api/billing/portal/route.ts",
    interfaceExport: "POST",
    requiredInterfaceCalls: [
      "getStripeCheckoutEnv",
      "assertTrustedOrigin",
      "requireCurrentUserProfile",
      "checkRateLimit",
      "createStripePortalSession",
      "NextResponse.redirect",
    ],
    delegatePath: "src/lib/billing/stripe-service.ts",
    delegateExport: "createStripePortalSession",
    requiredDelegateCalls: [
      "withDbRequestContext",
      "tx.user.findUnique",
      "returnUrl.searchParams.set",
      "getStripeClient(env.secretKey).billingPortal.sessions.create",
      "returnUrl.toString",
    ],
    bindingPath: "src/app/account/billing/page.tsx",
    requiredBindingSignals: [
      'action="/api/billing/portal"',
      "Manage billing",
      "Use Manage billing for subscription details, invoices, and cancellation.",
      "Returned from the secure Stripe billing portal",
    ],
  },
  {
    requirementId: "ROUTE.ACCOUNT.payment-failure",
    ...ACCOUNT_BILLING_OVERVIEW_SOURCE_CHAIN,
    requiredBindingSignals: [
      "<SubscriptionStatusBanner",
      "Read-only local snapshot",
      'case "payment_failed":',
      "The local snapshot records a failed payment state.",
    ],
    sourceFunctionChecks: [
      {
        path: "src/app/account/billing/page.tsx",
        functionName: "SignedInBilling",
        requiredCalls: ["getLocalBillingOverview", "formatSnapshotText"],
      },
      {
        path: "src/app/account/billing/page.tsx",
        functionName: "getLocalBillingOverview",
        requiredCalls: [
          "getEntitlementLimitsForCurrentUser",
          "safeQuery",
          "withDbRequestContext",
          "tx.subscription.findFirst",
        ],
      },
      {
        path: "src/app/account/billing/page.tsx",
        functionName: "getSubscriptionStatusBanner",
        requiredCalls: ["formatSnapshotText", "normalizeSnapshotKey", "formatDate"],
        requiredSignals: [
          'case "payment_failed":',
          "The local snapshot records a failed payment state.",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.ACCOUNT.invoices",
    ...ACCOUNT_BILLING_OVERVIEW_SOURCE_CHAIN,
    requiredBindingSignals: [
      "Invoices",
      "{overview.invoices.map((invoice) => (",
      "invoice.invoiceNumber",
      "No invoice snapshots have been recorded for this account yet.",
    ],
    sourceFunctionChecks: [
      {
        path: "src/app/account/billing/page.tsx",
        functionName: "SignedInBilling",
        requiredCalls: ["getLocalBillingOverview"],
      },
      {
        path: "src/app/account/billing/page.tsx",
        functionName: "getLocalBillingOverview",
        requiredCalls: [
          "getEntitlementLimitsForCurrentUser",
          "safeQuery",
          "withDbRequestContext",
          "tx.invoiceRecord.findMany",
        ],
        requiredSignals: ["where: invoiceWhere", "take: 5", "invoiceNumber: true"],
      },
    ],
  },
  {
    requirementId: "ROUTE.ACCOUNT.account-delete",
    interfacePath: "src/app/actions.ts",
    interfaceExport: "requestAccountDeletion",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "checkRateLimit",
      "destructiveConfirmationSchema.parse",
      "field",
      "requestAccountDeletionForUser",
      "revalidatePath",
      "redirect",
    ],
    delegatePath: "src/lib/account-service.ts",
    delegateExport: "requestAccountDeletion",
    requiredDelegateCalls: [
      "withDbRequestContext",
      "lockAdminAccessChanges",
      "tx.user.findUnique",
      "tx.profile.count",
      "assertLastAdminAccessChange",
      "deletionRequestEmailForUser",
      "tx.user.update",
      "tx.auditLog.create",
    ],
    bindingPath: "src/app/account/page.tsx",
    requiredBindingSignals: [
      '<form action={requestAccountDeletion} className="grid gap-2">',
      'name="confirmation"',
      'pendingLabel="Requesting..."',
      "Request deletion",
      "30-day grace window",
      "Deletion requested",
    ],
  },
  {
    requirementId: "ROUTE.ACCOUNT.data-export",
    interfacePath: "src/app/api/users/me/export/route.ts",
    interfaceExport: "POST",
    requiredInterfaceCalls: [
      "isEmergencyControlActive",
      "emergencyControlResponse",
      "request.headers.get",
      "requireCurrentUserProfile",
      "checkRateLimit",
      "rateLimitExceededResponse",
      "readUserExportData",
      "assertUserExportDto",
      "JSON.stringify",
      "assertUserExportSize",
      "recordUserExportCompletion",
      "getClientIp",
    ],
    delegatePath: "src/lib/account-service.ts",
    delegateExport: "recordUserExportCompletion",
    requiredDelegateCalls: [
      "withDbRequestContext",
      "insertAuditLog",
      "tx.exportArtifact.create",
    ],
    bindingPath: "src/components/user-data-export-form.tsx",
    requiredBindingSignals: [
      'action="/api/users/me/export"',
      'method="post"',
      'type="submit"',
    ],
    additionalBindings: [
      {
        path: "src/app/account/page.tsx",
        requiredSignals: [
          "<UserDataExportForm",
          'label="Download JSON"',
          "Download a JSON archive of your profile, content, Pulse messages",
        ],
      },
    ],
    sourceFunctionChecks: [
      {
        path: "src/app/api/users/me/export/route.ts",
        functionName: "POST",
        requiredSignals: [
          '"content-disposition": `attachment; filename="greyhoundiq-export-${date}.json"`',
          "...PRIVATE_NO_STORE,",
        ],
      },
      {
        path: "src/lib/user-export-service.ts",
        functionName: "readUserExportData",
        requiredCalls: [
          "withDbRequestContext",
          "Promise.all",
          "tx.user.findUnique",
          "tx.profile.findUnique",
          "tx.thread.findMany",
          "tx.post.findMany",
          "tx.listing.findMany",
          "tx.conversation.findMany",
          "tx.message.findMany",
        ],
      },
      {
        path: "src/lib/account-service.ts",
        functionName: "recordUserExportCompletion",
        requiredCalls: [
          "withDbRequestContext",
          "insertAuditLog",
          "tx.exportArtifact.create",
        ],
        requiredSignals: [
          'status: "completed"',
          'exportType: "user_data"',
        ],
      },
      {
        path: "src/lib/account-service.ts",
        functionName: "insertAuditLog",
        requiredCalls: ["tx.auditLog.createMany", "JSON.stringify"],
      },
    ],
  },
  {
    requirementId: "ROUTE.ACCOUNT.onboarding-management",
    ...ACCOUNT_HELP_SOURCE_CHAIN,
    requiredBindingSignals: [
      'import { InteractiveHelpMenuControls } from "@/components/interactive-help";',
      "Onboarding preferences",
      "Guided help controls",
      "<InteractiveHelpMenuControls",
    ],
    sourceFunctionChecks: [
      {
        path: "src/components/interactive-help.tsx",
        functionName: "updateInteractiveHelp",
        requiredCalls: [
          "parseInteractiveHelpState",
          "readInteractiveHelpSnapshot",
          "reduceInteractiveHelpState",
          "serializeInteractiveHelpState",
          "window.localStorage.setItem",
          "window.dispatchEvent",
        ],
      },
      {
        path: "src/components/interactive-help-state.ts",
        functionName: "reduceInteractiveHelpState",
        requiredSignals: [
          'case "complete":',
          'case "disable":',
          'case "enable":',
          'case "restart":',
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.ACCOUNT.billing-intent",
    ...ACCOUNT_CHECKOUT_SOURCE_CHAIN,
    requiredBindingSignals: [
      "const pendingPlan = parsePendingPlan(query.plan);",
      'query.checkout === "continue"',
      '<input name="plan" type="hidden" value="pro" />',
      '<input name="interval" type="hidden" value={interval} />',
      "active tier stays unchanged until Stripe confirms a completed",
      "Signing in never starts a payment.",
    ],
    additionalBindings: [
      {
        path: "src/app/sign-in/route.ts",
        requiredSignals: [
          "const returnTo = resolveWorkosReturnTo({",
          'interval: request.nextUrl.searchParams.get("interval")',
          'plan: request.nextUrl.searchParams.get("plan")',
          "returnTo,",
        ],
      },
    ],
    sourceFunctionChecks: [
      {
        path: "src/app/account/page.tsx",
        functionName: "parsePendingPlan",
        requiredSignals: ["value in PENDING_PLAN_LABELS"],
      },
      {
        path: "src/app/account/page.tsx",
        functionName: "parsePendingInterval",
        requiredSignals: [
          'value === "monthly" || value === "yearly"',
        ],
      },
      {
        path: "src/app/account/page.tsx",
        functionName: "accountReturnTo",
        requiredCalls: ["params.set", "params.toString"],
        requiredSignals: [
          'params.set("interval", interval)',
          'params.set("checkout", "continue")',
        ],
      },
      {
        path: "src/lib/billing/stripe-service.ts",
        functionName: "buildStripeCheckoutSessionParams",
        requiredSignals: [
          "line_items: [{ price: env.prices[plan][interval], quantity: 1 }]",
          "interval,",
          "plan,",
          "userId: current.dbUserId",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.ACCOUNT.no-query-payment-proof",
    interfacePath: "src/app/account/billing/page.tsx",
    interfaceExport: "BillingPage",
    requiredInterfaceCalls: ["getCurrentUser"],
    delegatePath: "src/lib/billing/stripe-webhooks.ts",
    delegateExport: "ingestStripeWebhook",
    requiredDelegateCalls: [
      "verifyStripeWebhook",
      "createHash",
      "stripeWebhookAuditPayload",
      "safeHeaders",
      "withDbSystemContext",
      "reduceStripeWebhook",
      "isUniqueConstraintError",
      "processDuplicateStripeWebhook",
      "persistFailedStripeWebhook",
    ],
    bindingPath: "src/app/account/billing/page.tsx",
    requiredBindingSignals: [
      "const checkout = singleQueryValue(query.checkout);",
      "The local plan only changes after the signed Stripe webhook is",
      "Refresh billing status",
      "Read-only local snapshot",
    ],
    sourceFunctionChecks: [
      {
        path: "src/app/account/billing/page.tsx",
        functionName: "BillingOutcomeBanner",
        requiredCalls: ["singleQueryValue", "retryQuery.set", "retryQuery.toString"],
        requiredSignals: [
          'if (checkout === "success")',
          "The local plan only changes after the signed Stripe webhook is",
          'if (checkout === "cancelled")',
        ],
      },
      {
        path: "src/app/account/billing/page.tsx",
        functionName: "getLocalBillingOverview",
        requiredCalls: [
          "safeQuery",
          "withDbRequestContext",
          "tx.subscription.findFirst",
          "tx.invoiceRecord.findMany",
        ],
      },
      {
        path: "src/lib/billing/stripe-webhooks.ts",
        functionName: "verifyStripeWebhook",
        requiredCalls: [
          "headers.get",
          "getStripeWebhookEnv",
          "getStripeClient(env.secretKey).webhooks.constructEvent",
        ],
        requiredSignals: [
          'throw new StripeWebhookError("stripe.webhook_missing_signature", 401)',
          'throw new StripeWebhookError("stripe.webhook_invalid_signature", 401)',
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.ACCOUNT.safe-auth-return",
    interfacePath: "src/lib/workos-redirect.ts",
    interfaceExport: "resolveWorkosReturnTo",
    requiredInterfaceCalls: [
      "safeInternalReturnTo",
      "ALLOWED_PLANS.has",
      "params.set",
      "params.toString",
    ],
    delegatePath: "src/lib/workos-redirect.ts",
    delegateExport: "resolveWorkosRedirectUri",
    requiredDelegateCalls: [
      "trustedRequestOrigin",
      "firstSafeUrl",
      "resolveWorkosBaseUrl",
    ],
    bindingPath: "src/app/sign-in/route.ts",
    requiredBindingSignals: [
      "const returnTo = resolveWorkosReturnTo({",
      'returnTo: request.nextUrl.searchParams.get("returnTo")',
      "returnTo,",
    ],
    additionalBindings: [
      {
        path: "src/app/account/page.tsx",
        requiredSignals: [
          "returnTo={accountReturnTo(pendingPlan, pendingInterval)}",
          'href={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`}',
        ],
      },
    ],
    sourceFunctionChecks: [
      {
        path: "src/lib/workos-redirect.ts",
        functionName: "safeInternalReturnTo",
        requiredCalls: [
          "candidate.startsWith",
          "candidate.includes",
          "decodeURIComponent",
        ],
        requiredSignals: [
          'candidate.startsWith("//")',
          'candidate.includes("\\\\")',
          '.replace(/\\/+$/, "")',
          ".toLowerCase()",
          'path === "/sign-in"',
          'path === "/callback"',
          "if (url.origin !== RETURN_TO_BASE.origin) return undefined;",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.ACCOUNT.notification-scope",
    interfacePath: "src/app/account/notifications/page.tsx",
    interfaceExport: "AccountNotificationsPage",
    requiredInterfaceCalls: [
      "requireNotificationsProfile",
      "Promise.all",
      "listNotificationsForUser",
      "getMarketingPreferences",
      "notifications.filter",
    ],
    delegatePath: "src/lib/notification-service.ts",
    delegateExport: "listNotificationsForUser",
    requiredDelegateCalls: [
      "safeQuery",
      "withDbSystemContext",
      "tx.notification.findMany",
    ],
    bindingPath: "src/app/account/notifications/page.tsx",
    requiredBindingSignals: [
      "Review in-app updates and your recorded communication preferences.",
      "In-app notifications",
      "Marketing preferences",
      "Channel",
      "Opt-in status",
      "Source label",
    ],
    sourceFunctionChecks: [
      {
        path: "src/app/account/notifications/page.tsx",
        functionName: "getMarketingPreferences",
        requiredCalls: [
          "safeQuery",
          "withDbRequestContext",
          "tx.marketingPreference.findMany",
          "rows.map",
        ],
        requiredSignals: ["where: { userId: current.dbUserId }"],
      },
    ],
  },
  {
    requirementId: "ROUTE.ACCOUNT.export-delete-status",
    interfacePath: "src/app/api/users/me/export/route.ts",
    interfaceExport: "POST",
    requiredInterfaceCalls: [
      "requireCurrentUserProfile",
      "assertUserExportDto",
      "assertUserExportSize",
      "recordUserExportCompletion",
      "readUserExportData",
    ],
    delegatePath: "src/lib/account-service.ts",
    delegateExport: "recordUserExportCompletion",
    requiredDelegateCalls: [
      "withDbRequestContext",
      "insertAuditLog",
      "tx.exportArtifact.create",
    ],
    bindingPath: "src/app/account/privacy/page.tsx",
    requiredBindingSignals: [
      'title="Export history"',
      "{records.exportArtifacts.length > 0 ? (",
      "<ExportArtifactTable records={records.exportArtifacts} />",
      '<th className="px-4 py-3">Status</th>',
      "{formatLabel(record.status)}",
    ],
    additionalBindings: [
      {
        path: "src/app/account/page.tsx",
        requiredSignals: [
          "deletionRequestedAt",
          "Deletion requested",
          "Request account deletion with a 30-day grace window.",
          "Requested",
        ],
      },
    ],
    sourceFunctionChecks: [
      {
        path: "src/lib/account-service.ts",
        functionName: "recordUserExportCompletion",
        requiredCalls: [
          "withDbRequestContext",
          "insertAuditLog",
          "tx.exportArtifact.create",
        ],
        requiredSignals: [
          'exportType: "user_data"',
          'status: "completed"',
          "completedAt: input.exportedAt",
          "input.exportedAt.getTime() + USER_EXPORT_ARTIFACT_TTL_MS",
        ],
      },
      {
        path: "src/lib/account-service.ts",
        functionName: "requestAccountDeletion",
        requiredCalls: ["tx.user.update", "tx.auditLog.create"],
        requiredSignals: [
          'status: "requested"',
          "graceDays: 30",
          "deletionRequestedAt: requestedAt",
        ],
      },
    ],
  },
  {
    requirementId: "ROUTE.ACCOUNT.restart-reset-tour",
    ...ACCOUNT_HELP_SOURCE_CHAIN,
    requiredBindingSignals: [
      "Onboarding preferences",
      "Guided help controls",
      "<InteractiveHelpMenuControls",
    ],
    additionalBindings: [
      {
        path: "src/components/interactive-help.tsx",
        requiredSignals: [
          'event: "tour-restarted"',
          'updateInteractiveHelp("restart");',
          "Restart guided tour",
          'aria-label="Interactive help preferences"',
        ],
      },
    ],
    sourceFunctionChecks: [
      {
        path: "src/components/interactive-help.tsx",
        functionName: "updateInteractiveHelp",
        requiredCalls: [
          "reduceInteractiveHelpState",
          "serializeInteractiveHelpState",
          "window.localStorage.setItem",
          "window.dispatchEvent",
        ],
      },
      {
        path: "src/components/interactive-help-state.ts",
        functionName: "reduceInteractiveHelpState",
        requiredSignals: [
          'case "restart":',
          "return { completed: false, enabled: true };",
        ],
      },
    ],
  },
] as const satisfies readonly ProductRouteCapabilitySourceEvidenceRecord[];

export const PRODUCT_ROUTE_CAPABILITY_SOURCE_REQUIREMENT_IDS =
  PRODUCT_ROUTE_CAPABILITY_SOURCE_EVIDENCE_RECORDS.map(
    (record) => record.requirementId,
  ).toSorted();

export const PRODUCT_ROUTE_CAPABILITY_SOURCE_MASTER_EVIDENCE =
  Object.fromEntries(
    PRODUCT_ROUTE_CAPABILITY_SOURCE_EVIDENCE_RECORDS.map((record) => [
      record.requirementId,
      {
        status: "tested" as const,
        evidence: [
          PRODUCT_SOURCE_AUDIT_EVIDENCE_FILE,
          PRODUCT_SOURCE_AUDIT_TEST_FILE,
          record.interfacePath,
          record.delegatePath,
          record.bindingPath,
          ...("sourceFunctionChecks" in record
            ? record.sourceFunctionChecks.map((check) => check.path)
            : []),
          ...("additionalBindings" in record
            ? record.additionalBindings.map((binding) => binding.path)
            : []),
        ].filter(
          (evidencePath, index, evidencePaths) =>
            evidencePaths.indexOf(evidencePath) === index,
        ),
      },
    ]),
  ) as Readonly<
    Record<string, { status: "tested"; evidence: readonly string[] }>
  >;

/**
 * Client-safe evidence metadata. Filesystem discovery and negative fixtures are
 * confined to the focused test so importing the master registry remains safe.
 */
export const PRODUCT_SOURCE_AUDIT_MASTER_EVIDENCE = {
  "DISC.SRC.route-groups": {
    status: "tested",
    evidence: STRUCTURE_EVIDENCE,
  },
  "DISC.SRC.layouts": {
    status: "tested",
    evidence: STRUCTURE_EVIDENCE,
  },
  "DISC.SRC.nested-layouts": {
    status: "tested",
    evidence: STRUCTURE_EVIDENCE,
  },
  "DISC.SRC.parallel-routes": {
    status: "tested",
    evidence: STRUCTURE_EVIDENCE,
  },
  "DISC.SRC.dynamic-routes": {
    status: "tested",
    evidence: ROUTE_EVIDENCE,
  },
  "DISC.SRC.automated-tests": {
    status: "tested",
    evidence: TEST_INVENTORY_EVIDENCE,
  },
  "DISC.SRC.design-lab-fixtures": {
    status: "tested",
    evidence: FIXTURE_EVIDENCE,
  },
  "DISC.SRC.api-handlers": {
    status: "tested",
    evidence: API_HANDLER_EVIDENCE,
  },
  "DISC.SRC.api-redirects": {
    status: "tested",
    evidence: REDIRECT_EVIDENCE,
  },
  "DISC.SRC.auth-redirects": {
    status: "tested",
    evidence: REDIRECT_EVIDENCE,
  },
  "DISC.SRC.authentication-flows": {
    status: "tested",
    evidence: AUTHENTICATION_FLOW_EVIDENCE,
  },
  "DISC.SRC.billing-flows": {
    status: "tested",
    evidence: BILLING_FLOW_EVIDENCE,
  },
  "DISC.SRC.billing-return-routes": {
    status: "tested",
    evidence: BILLING_RETURN_EVIDENCE,
  },
  "DISC.SRC.database-models": {
    status: "tested",
    evidence: DATABASE_MODEL_EVIDENCE,
  },
  "DISC.SRC.feature-flagged-routes": {
    status: "tested",
    evidence: FEATURE_FLAG_EVIDENCE,
  },
  "DISC.SRC.feature-flags": {
    status: "tested",
    evidence: FEATURE_FLAG_EVIDENCE,
  },
} as const;

export const PRODUCT_SOURCE_AUDIT_REQUIREMENT_IDS = Object.keys(
  PRODUCT_SOURCE_AUDIT_MASTER_EVIDENCE,
).toSorted();
