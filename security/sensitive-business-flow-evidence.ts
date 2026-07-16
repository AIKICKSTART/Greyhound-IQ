export const SENSITIVE_BUSINESS_FLOW_EVIDENCE_TEST =
  "security/sensitive-business-flow-evidence.test.ts";

export const VERIFIED_SENSITIVE_BUSINESS_FLOW_IDS = [
  "security.sensitive-business-flow.friend-requests",
  "security.sensitive-business-flow.follows",
  "security.sensitive-business-flow.posting",
  "security.sensitive-business-flow.commenting",
  "security.sensitive-business-flow.reactions",
  "security.sensitive-business-flow.messaging",
  "security.sensitive-business-flow.rich-media-sending",
  "security.sensitive-business-flow.voice-or-video-call-invitations",
  "security.sensitive-business-flow.invitation-creation",
  "security.sensitive-business-flow.marketplace-enquiries",
  "security.sensitive-business-flow.listing-creation",
  "security.sensitive-business-flow.listing-publication",
  "security.sensitive-business-flow.ownership-claims",
  "security.sensitive-business-flow.verification-requests",
  "security.sensitive-business-flow.support-submissions",
  "security.sensitive-business-flow.reports",
  "security.sensitive-business-flow.data-exports",
  "security.sensitive-business-flow.account-deletion",
  "security.sensitive-business-flow.ai-tool-runs",
  "security.sensitive-business-flow.payment-checkout-creation",
] as const;

export type VerifiedSensitiveBusinessFlowId =
  (typeof VERIFIED_SENSITIVE_BUSINESS_FLOW_IDS)[number];

export const SENSITIVE_BUSINESS_FLOW_API_BINDINGS: Readonly<
  Partial<Record<VerifiedSensitiveBusinessFlowId, readonly string[]>>
> = {
  "security.sensitive-business-flow.follows": [
    "POST /api/feed/topics/[topicId]/follow",
  ],
  "security.sensitive-business-flow.posting": [
    "POST /api/feed",
    "POST /api/forum/categories/[slug]/threads",
  ],
  "security.sensitive-business-flow.commenting": [
    "POST /api/feed/[postId]/comments",
    "POST /api/forum/threads/[id]/posts",
  ],
  "security.sensitive-business-flow.reactions": [
    "POST /api/feed/[postId]/reaction",
    "POST /api/feed/comments/[commentId]/reaction",
  ],
  "security.sensitive-business-flow.messaging": [
    "POST /api/conversations",
    "POST /api/conversations/[id]/messages",
    "POST /api/messages",
  ],
  "security.sensitive-business-flow.rich-media-sending": [
    "POST /api/media/sign-upload",
    "POST /api/media/[id]/finalize",
    "POST /api/conversations/[id]/messages",
  ],
  "security.sensitive-business-flow.voice-or-video-call-invitations": [
    "POST /api/calls/[roomId]/invite",
  ],
  "security.sensitive-business-flow.marketplace-enquiries": [
    "POST /api/listings/[id]/enquiry",
  ],
  "security.sensitive-business-flow.listing-creation": ["POST /api/listings"],
  "security.sensitive-business-flow.listing-publication": [
    "POST /api/listings",
    "PATCH /api/listings/[id]",
  ],
  "security.sensitive-business-flow.ownership-claims": [
    "POST /api/dogs/[id]/claim",
  ],
  "security.sensitive-business-flow.verification-requests": [
    "POST /api/dogs/[id]/claim",
  ],
  "security.sensitive-business-flow.reports": ["POST /api/reports"],
  "security.sensitive-business-flow.data-exports": [
    "POST /api/users/me/export",
  ],
  "security.sensitive-business-flow.account-deletion": [
    "POST /api/users/me/delete",
  ],
  "security.sensitive-business-flow.ai-tool-runs": [
    "POST /api/agents/[type]/run",
  ],
  "security.sensitive-business-flow.payment-checkout-creation": [
    "POST /api/billing/checkout",
    "POST /api/billing/bespoke/checkout",
  ],
};

export const SENSITIVE_BUSINESS_FLOW_ACTION_BINDINGS: Readonly<
  Partial<Record<VerifiedSensitiveBusinessFlowId, readonly string[]>>
> = {
  "security.sensitive-business-flow.friend-requests": [
    "sendFriendRequestAction",
    "respondToFriendRequestAction",
  ],
  "security.sensitive-business-flow.posting": [
    "createFeedPost",
    "createForumThread",
  ],
  "security.sensitive-business-flow.commenting": [
    "replyToFeedPost",
    "replyToForumThread",
  ],
  "security.sensitive-business-flow.reactions": [
    "toggleFeedPostReaction",
    "toggleMessageReaction",
  ],
  "security.sensitive-business-flow.messaging": [
    "sendMessage",
    "replyToConversation",
    "startChatAction",
  ],
  "security.sensitive-business-flow.rich-media-sending": [
    "sendMessage",
    "replyToConversation",
  ],
  "security.sensitive-business-flow.marketplace-enquiries": [
    "enquireAboutListing",
  ],
  "security.sensitive-business-flow.listing-creation": ["createListing"],
  "security.sensitive-business-flow.listing-publication": ["createListing"],
  "security.sensitive-business-flow.ownership-claims": ["claimDogOwnership"],
  "security.sensitive-business-flow.verification-requests": [
    "claimDogOwnership",
  ],
  "security.sensitive-business-flow.support-submissions": [
    "createSupportTicket",
  ],
  "security.sensitive-business-flow.reports": [
    "reportFeedPost",
    "reportListing",
    "reportConversationMessage",
  ],
  "security.sensitive-business-flow.account-deletion": [
    "requestAccountDeletion",
  ],
  "security.sensitive-business-flow.ai-tool-runs": ["createAgentRun"],
  "security.sensitive-business-flow.invitation-creation": [
    "createTeamInvitationAction",
  ],
};

export const OPEN_SENSITIVE_BUSINESS_FLOW_GAPS = {
  "security.sensitive-business-flow.account-creation":
    "Account creation is delegated to WorkOS; deployed bot and signup-abuse policy evidence is not present.",
  "security.sensitive-business-flow.authentication":
    "Authentication is delegated to WorkOS; deployed credential-stuffing and bot policy evidence is not present.",
  "security.sensitive-business-flow.password-reset":
    "Password reset is delegated to WorkOS; deployed reset-abuse policy evidence is not present.",
  "security.sensitive-business-flow.group-joining":
    "No complete production group-membership join mutation was found.",
  "security.sensitive-business-flow.search-and-scraping":
    "Several searches are limited, but public race-page search and deployed edge scraping controls are not exhaustively verified.",
  "security.sensitive-business-flow.coupon-or-promotion-use-if-applicable":
    "No coupon or promotion redemption mechanism is currently implemented; applicability will be decided with advertising billing.",
} as const;

const EVIDENCE = [
  "security/sensitive-business-flow-evidence.ts",
  SENSITIVE_BUSINESS_FLOW_EVIDENCE_TEST,
  "security/rate-limits.ts",
  "security/rate-limits.test.ts",
  "src/lib/rate-limit.ts",
  "src/lib/rate-limit.test.ts",
  "src/lib/rate-limit-response.ts",
  "src/lib/rate-limit-response-route-contract.test.ts",
  "src/app/actions.ts",
  "src/app/account/team/actions.ts",
  "src/lib/organization-team-policy.ts",
  "src/lib/organization-team-policy.test.ts",
  "src/lib/organization-team-service.ts",
  "src/components/product-account-team-evidence.test.ts",
  "src/lib/listing-service.ts",
] as const;

export const SENSITIVE_BUSINESS_FLOW_MASTER_EVIDENCE = Object.fromEntries(
  VERIFIED_SENSITIVE_BUSINESS_FLOW_IDS.map((requirementId) => [
    requirementId,
    { status: "verified" as const, evidence: EVIDENCE },
  ]),
);
