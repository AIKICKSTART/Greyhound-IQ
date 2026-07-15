import type { CoverageClaim, FamilyScreenManifest } from "./types";
import {
  getAccountOnboardingRouteTour,
  getAdminOnboardingRouteTour,
} from "../onboarding-tour-registry";
import { getCommunityOnboardingRouteTour } from "../community-onboarding-tour-registry";
import { getAgentsOnboardingRouteTour } from "../agents-onboarding-tour-registry";
import { getDesignLabOnboardingRouteTour } from "../design-lab-onboarding-tour-registry";
import { getMarketplaceOnboardingRouteTour } from "../marketplace-onboarding-tour-registry";
import { getPublicOnboardingRouteTour } from "../public-onboarding-tour-registry";
import { getRacingOnboardingRouteTour } from "../racing-onboarding-tour-registry";
import {
  PUBLIC_SCREEN_PERMISSION_CONTRACTS,
  SCREEN_PERMISSION_EVIDENCE_TEST,
} from "./screen-permission-evidence";
import {
  PRODUCTION_SCREEN_STATE_CONTRACTS,
  SCREEN_STATE_EVIDENCE_TEST,
} from "./screen-state-evidence";
import {
  PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_CONTRACTS,
  PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_ROUTES,
} from "./production-screen-public-racing-interactions";
import {
  PRODUCTION_SCREEN_ADMIN_CORE_INTERACTION_CONTRACTS,
  PRODUCTION_SCREEN_ADMIN_CORE_INTERACTION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_ADMIN_CORE_INTERACTION_ROUTES,
} from "./production-screen-admin-core-interactions";
import {
  PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_CONTRACTS,
  PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_ROUTES,
} from "./production-screen-admin-operations-interactions";
import {
  PRODUCTION_SCREEN_ADMIN_MODERATION_INTERACTION_CONTRACTS,
  PRODUCTION_SCREEN_ADMIN_MODERATION_INTERACTION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_ADMIN_MODERATION_INTERACTION_ROUTES,
} from "./production-screen-admin-moderation-interactions";
import {
  PRODUCTION_SCREEN_PROFILE_MESSAGING_INTERACTION_CONTRACTS,
  PRODUCTION_SCREEN_PROFILE_MESSAGING_INTERACTION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_PROFILE_MESSAGING_INTERACTION_ROUTES,
} from "./production-screen-profile-messaging-interactions";
import {
  PRODUCTION_SCREEN_COMMERCE_INTERACTION_CONTRACTS,
  PRODUCTION_SCREEN_COMMERCE_INTERACTION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_COMMERCE_INTERACTION_ROUTES,
} from "./production-screen-commerce-interactions";
import {
  PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_CONTRACTS,
  PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_ROUTES,
} from "./production-screen-member-support-interactions";
import {
  PRODUCTION_SCREEN_PUBLIC_NAVIGATION_INTERACTION_CONTRACTS,
  PRODUCTION_SCREEN_PUBLIC_NAVIGATION_INTERACTION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_PUBLIC_NAVIGATION_INTERACTION_ROUTES,
} from "./production-screen-public-navigation-interactions";
import {
  PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_CONTRACTS,
  PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_EVIDENCE_TEST,
} from "./production-screen-admin-access-state-evidence";
import {
  PRODUCTION_SCREEN_MESSAGING_ACCESS_STATE_EVIDENCE_TEST,
  PRODUCTION_SCREEN_MESSAGING_PERMISSION_CONTRACTS,
  PRODUCTION_SCREEN_MESSAGING_STATE_CONTRACTS,
} from "./production-screen-messaging-access-state-evidence";
import {
  PRODUCTION_SCREEN_MEMBER_ACCESS_STATE_EVIDENCE_TEST,
  PRODUCTION_SCREEN_MEMBER_PERMISSION_CONTRACTS,
  PRODUCTION_SCREEN_MEMBER_STATE_CONTRACTS,
} from "./production-screen-member-access-state-evidence";

const TEST_PATH =
  "src/components/screen-contracts/production-screen-coverage.test.ts";
const TEST_ID = "PRODUCTION-SCREEN-COVERAGE";
const ROUTE_AUDIT_PATH = "output/demo-route-audit/latest.json";
const TEST_IDS = [TEST_ID] as const;
const NEXT_CONFIG_PATH = "next.config.ts";

export const PRODUCTION_SCREEN_ACCOUNT_INTERACTION_EVIDENCE_TEST = {
  id: "PRODUCTION-SCREEN-ACCOUNT-INTERACTIONS",
  path: "src/components/screen-contracts/production-screen-account-interactions.test.ts",
} as const;
const ACCOUNT_INTERACTION_TEST_IDS = [
  PRODUCTION_SCREEN_ACCOUNT_INTERACTION_EVIDENCE_TEST.id,
] as const;

export const PRODUCTION_SCREEN_MARKETPLACE_INTERACTION_EVIDENCE_TEST = {
  id: "PRODUCTION-SCREEN-MARKETPLACE-INTERACTIONS",
  path: "src/components/screen-contracts/production-screen-marketplace-interactions.test.ts",
} as const;
const MARKETPLACE_INTERACTION_TEST_IDS = [
  PRODUCTION_SCREEN_MARKETPLACE_INTERACTION_EVIDENCE_TEST.id,
] as const;

export const PRODUCTION_SCREEN_COMMUNITY_INTERACTION_EVIDENCE_TEST = {
  id: "PRODUCTION-SCREEN-COMMUNITY-INTERACTIONS",
  path: "src/components/screen-contracts/production-screen-community-interactions.test.ts",
} as const;
const COMMUNITY_INTERACTION_TEST_IDS = [
  PRODUCTION_SCREEN_COMMUNITY_INTERACTION_EVIDENCE_TEST.id,
] as const;

export const PRODUCTION_SCREEN_ONBOARDING_EVIDENCE_TEST = {
  id: "PRODUCTION-SCREEN-ONBOARDING-REDIRECT-EXCLUSIONS",
  path: "src/components/screen-contracts/production-screen-onboarding-exclusions.test.ts",
} as const;

export const PRODUCTION_SCREEN_ADMIN_ONBOARDING_EVIDENCE_TEST = {
  id: "PRODUCTION-SCREEN-ADMIN-ONBOARDING",
  path: "src/components/screen-contracts/production-screen-admin-onboarding-evidence.test.ts",
} as const;

export const PRODUCTION_SCREEN_ACCOUNT_ONBOARDING_EVIDENCE_TEST = {
  id: "PRODUCTION-SCREEN-ACCOUNT-ONBOARDING",
  path: "src/components/screen-contracts/production-screen-account-onboarding-evidence.test.ts",
} as const;

export const PRODUCTION_SCREEN_RACING_ONBOARDING_EVIDENCE_TEST = {
  id: "PRODUCTION-SCREEN-RACING-ONBOARDING",
  path: "src/components/screen-contracts/production-screen-racing-onboarding-evidence.test.ts",
} as const;

export const PRODUCTION_SCREEN_COMMUNITY_ONBOARDING_EVIDENCE_TEST = {
  id: "PRODUCTION-SCREEN-COMMUNITY-ONBOARDING",
  path: "src/components/screen-contracts/production-screen-community-onboarding-evidence.test.ts",
} as const;

export const PRODUCTION_SCREEN_PUBLIC_ONBOARDING_EVIDENCE_TEST = {
  id: "PRODUCTION-SCREEN-PUBLIC-ONBOARDING",
  path: "src/components/screen-contracts/production-screen-public-onboarding-evidence.test.ts",
} as const;

export const PRODUCTION_SCREEN_MARKETPLACE_ONBOARDING_EVIDENCE_TEST = {
  id: "PRODUCTION-SCREEN-MARKETPLACE-ONBOARDING",
  path: "src/components/screen-contracts/production-screen-marketplace-onboarding-evidence.test.ts",
} as const;

export const PRODUCTION_SCREEN_AGENTS_ONBOARDING_EVIDENCE_TEST = {
  id: "PRODUCTION-SCREEN-AGENTS-ONBOARDING",
  path: "src/components/screen-contracts/production-screen-agents-onboarding-evidence.test.ts",
} as const;

export const PRODUCTION_SCREEN_DESIGN_LAB_ONBOARDING_EVIDENCE_TEST = {
  id: "PRODUCTION-SCREEN-DESIGN-LAB-ONBOARDING",
  path: "src/components/screen-contracts/production-screen-design-lab-onboarding-evidence.test.ts",
} as const;

type ProductionScreenInteractionContract = {
  queryParameters: readonly string[];
  actions: FamilyScreenManifest["actions"];
  forms: FamilyScreenManifest["forms"];
};

type ProductionScreenAction = FamilyScreenManifest["actions"][number];
type ProductionScreenForm = FamilyScreenManifest["forms"][number];

function accountAction(
  id: string,
  result: string,
  enforcement: string,
): ProductionScreenAction {
  return { id, result, enforcement, testIds: ACCOUNT_INTERACTION_TEST_IDS };
}

function accountForm(
  id: string,
  submitsTo: string,
  schema: string,
): ProductionScreenForm {
  return { id, submitsTo, schema, testIds: ACCOUNT_INTERACTION_TEST_IDS };
}

function marketplaceAction(
  id: string,
  result: string,
  enforcement: string,
): ProductionScreenAction {
  return { id, result, enforcement, testIds: MARKETPLACE_INTERACTION_TEST_IDS };
}

function marketplaceForm(
  id: string,
  submitsTo: string,
  schema: string,
): ProductionScreenForm {
  return { id, submitsTo, schema, testIds: MARKETPLACE_INTERACTION_TEST_IDS };
}

function communityAction(
  id: string,
  result: string,
  enforcement: string,
): ProductionScreenAction {
  return { id, result, enforcement, testIds: COMMUNITY_INTERACTION_TEST_IDS };
}

function communityForm(
  id: string,
  submitsTo: string,
  schema: string,
): ProductionScreenForm {
  return { id, submitsTo, schema, testIds: COMMUNITY_INTERACTION_TEST_IDS };
}

export const PRODUCTION_SCREEN_COMMUNITY_INTERACTION_ROUTES = [
  "/feed",
  "/groups",
  "/groups/[slug]",
  "/groups/threads/[id]",
  "/pulse",
  "/pulse/[id]",
  "/pulse/friends",
] as const;

export const PRODUCTION_SCREEN_MARKETPLACE_INTERACTION_ROUTES = [
  "/marketplace",
  "/marketplace/[id]",
  "/marketplace/new",
] as const;

export const PRODUCTION_SCREEN_ACCOUNT_INTERACTION_ROUTES = [
  "/account",
  "/account/appearance",
  "/account/billing",
  "/account/listings",
  "/account/listings/archived",
  "/account/listings/drafts",
  "/account/notifications",
  "/account/pages",
  "/account/pages/[id]",
  "/account/privacy",
  "/account/profile",
  "/account/saved-listings",
  "/account/security",
  "/account/support",
  "/account/support/[id]",
] as const;

type ProductionScreenOnboardingRedirectExclusion = {
  redirectSource: string;
  redirectDestination: string;
};

export const PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS = {
  "/listings": {
    redirectSource: "/listings",
    redirectDestination: "/marketplace",
  },
  "/listings/[id]": {
    redirectSource: "/listings/:path*",
    redirectDestination: "/marketplace/:path*",
  },
  "/listings/[id]/edit": {
    redirectSource: "/listings/:path*",
    redirectDestination: "/marketplace/:path*",
  },
  "/listings/new": {
    redirectSource: "/listings/:path*",
    redirectDestination: "/marketplace/:path*",
  },
  "/forum": {
    redirectSource: "/forum",
    redirectDestination: "/groups",
  },
  "/forum/[slug]": {
    redirectSource: "/forum/:path*",
    redirectDestination: "/groups/:path*",
  },
  "/forum/threads/[id]": {
    redirectSource: "/forum/:path*",
    redirectDestination: "/groups/:path*",
  },
  "/messages": {
    redirectSource: "/messages",
    redirectDestination: "/pulse",
  },
  "/messages/[id]": {
    redirectSource: "/messages/:path*",
    redirectDestination: "/pulse/:path*",
  },
  "/messages/friends": {
    redirectSource: "/messages/:path*",
    redirectDestination: "/pulse/:path*",
  },
} as const satisfies Readonly<
  Record<string, ProductionScreenOnboardingRedirectExclusion>
>;

export const PRODUCTION_SCREEN_INTERACTION_CONTRACTS = {
  "/races": {
    queryParameters: ["date", "state", "q", "status", "sort"],
    actions: [
      {
        id: "RACES.ACTION.SEARCH",
        result:
          "Navigates by GET to /races with q while preserving the active date, state, status, and sort filters.",
        enforcement:
          "getRaceExplorerData normalises the query and allowlists every filter before querying.",
        testIds: TEST_IDS,
      },
      {
        id: "RACES.ACTION.DATE.SELECT",
        result:
          "Navigates to the selected race date, or all dates, while preserving the other active filters.",
        enforcement:
          "dateLink builds a same-origin /races URL from URLSearchParams and getRaceExplorerData validates the date.",
        testIds: TEST_IDS,
      },
      {
        id: "RACES.ACTION.DATE.JUMP",
        result:
          "Submits a selected date by GET to /races while preserving q, state, status, and sort.",
        enforcement:
          "The native date input submits to /races and resolveRaceSearchDate rejects invalid dates.",
        testIds: TEST_IDS,
      },
      {
        id: "RACES.ACTION.STATE.FILTER",
        result:
          "Navigates by GET to /races with the selected state and the remaining active filters.",
        enforcement:
          "State choices come from the loaded state inventory and unknown values resolve to no state filter.",
        testIds: TEST_IDS,
      },
      {
        id: "RACES.ACTION.STATUS.FILTER",
        result:
          "Navigates by GET to /races with all, upcoming, live, resulted, or replay status.",
        enforcement:
          "normaliseRaceStatusParam allowlists the four non-default status values and otherwise selects all.",
        testIds: TEST_IDS,
      },
      {
        id: "RACES.ACTION.SORT",
        result:
          "Submits race-time or relevance ordering by GET to /races while preserving the active filters.",
        enforcement:
          "AutoSubmitSelect requests the owning form submission and normaliseRaceSortParam rejects unsupported values.",
        testIds: TEST_IDS,
      },
      {
        id: "RACES.ACTION.RACE.OPEN",
        result:
          "Opens the selected meeting race, next-to-go race, or replay at /races/[id].",
        enforcement:
          "Race links use identifiers from loaded race records and the registered dynamic route owns the destination.",
        testIds: TEST_IDS,
      },
      {
        id: "RACES.ACTION.TRACK.OPEN",
        result: "Opens the selected meeting track at /tracks/[id].",
        enforcement:
          "Track links use identifiers from loaded meeting records and the registered dynamic route owns the destination.",
        testIds: TEST_IDS,
      },
    ],
    forms: [
      {
        id: "RACES.FORM.SEARCH",
        submitsTo: "GET /races",
        schema:
          "q:string<=80,date?:date,state?:state,status?:status,sort?:sort",
        testIds: TEST_IDS,
      },
      {
        id: "RACES.FORM.DATE-JUMP",
        submitsTo: "GET /races",
        schema: "date:date,q?:string,state?:state,status?:status,sort?:sort",
        testIds: TEST_IDS,
      },
      {
        id: "RACES.FORM.SORT",
        submitsTo: "GET /races",
        schema:
          "sort:time|relevance,date?:date,q?:string,state?:state,status?:status",
        testIds: TEST_IDS,
      },
    ],
  },
  "/results": {
    queryParameters: ["date", "trackId", "sort"],
    actions: [
      {
        id: "RESULTS.ACTION.FILTER",
        result:
          "Submits result order, date, and track filters by GET to /results.",
        enforcement:
          "Sort is allowlisted and date and track identifiers must exist in the loaded filter options.",
        testIds: TEST_IDS,
      },
      {
        id: "RESULTS.ACTION.CLEAR",
        result: "Navigates to /results without query parameters.",
        enforcement: "The fixed same-origin Link targets /results.",
        testIds: TEST_IDS,
      },
      {
        id: "RESULTS.ACTION.RACE.OPEN",
        result: "Opens the selected settled race at /races/[id].",
        enforcement:
          "Race links use identifiers from loaded result records and the registered dynamic route owns the destination.",
        testIds: TEST_IDS,
      },
      {
        id: "RESULTS.ACTION.DOG.OPEN",
        result: "Opens the selected result runner at /dogs/[id].",
        enforcement:
          "RunnerRow uses the loaded dog identifier and the registered dynamic route owns the destination.",
        testIds: TEST_IDS,
      },
    ],
    forms: [
      {
        id: "RESULTS.FORM.FILTER",
        submitsTo: "GET /results",
        schema:
          "sort:newest|oldest|track,date?:known-date,trackId?:known-track",
        testIds: TEST_IDS,
      },
    ],
  },
  "/tracks": {
    queryParameters: ["state"],
    actions: [
      {
        id: "TRACKS.ACTION.STATE.FILTER",
        result: "Submits the selected Australian state by GET to /tracks.",
        enforcement:
          "normaliseTrackState uppercases and allowlists NSW, NT, QLD, SA, TAS, VIC, and WA.",
        testIds: TEST_IDS,
      },
      {
        id: "TRACKS.ACTION.TRACK.OPEN",
        result: "Opens the selected track guide at /tracks/[id].",
        enforcement:
          "Track links use identifiers from loaded active-track records and the registered dynamic route owns the destination.",
        testIds: TEST_IDS,
      },
      {
        id: "TRACKS.ACTION.RACE.OPEN",
        result: "Opens a visible track race at /races/[id].",
        enforcement:
          "Race links use identifiers from the loaded latest meeting and the registered dynamic route owns the destination.",
        testIds: TEST_IDS,
      },
    ],
    forms: [
      {
        id: "TRACKS.FORM.STATE",
        submitsTo: "GET /tracks",
        schema: "state?:NSW|NT|QLD|SA|TAS|VIC|WA",
        testIds: TEST_IDS,
      },
    ],
  },
  "/discover": {
    queryParameters: ["q"],
    actions: [
      {
        id: "DISCOVER.ACTION.SEARCH",
        result: "Submits a public-directory query by GET to /discover.",
        enforcement:
          "discoverSocialActorsAndDogs trims and bounds q, skips short searches, and applies request-context visibility.",
        testIds: TEST_IDS,
      },
      {
        id: "DISCOVER.ACTION.ACTOR.OPEN",
        result: "Opens the selected visible actor at /p/[handle].",
        enforcement:
          "Actor results require a published owner profile whose user is not banned or pending deletion.",
        testIds: TEST_IDS,
      },
      {
        id: "DISCOVER.ACTION.DOG.OPEN",
        result: "Opens the selected greyhound at /dogs/[id].",
        enforcement:
          "Dog links use identifiers returned by the request-context discovery query and the registered route owns the destination.",
        testIds: TEST_IDS,
      },
    ],
    forms: [
      {
        id: "DISCOVER.FORM.SEARCH",
        submitsTo: "GET /discover",
        schema: "q:string,minLength=2,maxLength=80",
        testIds: TEST_IDS,
      },
    ],
  },
  ...PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_CONTRACTS,
  "/feed": {
    queryParameters: ["demo", "dock", "mode", "sponsored", "variant"],
    actions: [
      communityAction(
        "FEED.ACTION.ORDER.SELECT",
        "Switches the community stream between For You and Latest ordering.",
        "The fixed /feed links emit only for-you or latest; the page normalises every other mode to for-you before querying.",
      ),
      communityAction(
        "FEED.ACTION.POST.CREATE",
        "Publishes a validated feed post for the active personal or managed-page identity.",
        "POST /api/feed requires the current profile, applies a per-user rate limit, parses feedPostWriteSchema, re-verifies actor ownership and paid page access, and checks media and moderation policy.",
      ),
      communityAction(
        "FEED.ACTION.POST.MEDIA.SELECT",
        "Selects image, video, or audio attachments for a new feed post.",
        "The composer delegates to the bounded media fields; the feed service accepts only attachable media owned by the current profile.",
      ),
      communityAction(
        "FEED.ACTION.COMMENT.CREATE",
        "Adds a comment or nested reply to a visible feed post.",
        "POST /api/feed/[postId]/comments requires the current profile, rate-limits the post pair, parses feedCommentWriteSchema, and re-verifies the selected actor and parent comment.",
      ),
      communityAction(
        "FEED.ACTION.POST.REACT",
        "Toggles an allowlisted reaction on a visible feed post.",
        "The reaction endpoint requires the current profile, rate-limits the actor/post pair, parses feedReactionWriteSchema, and resolves the actor through the request context.",
      ),
      communityAction(
        "FEED.ACTION.POST.SAVE",
        "Saves or unsaves a visible feed post for the active identity.",
        "The save endpoint requires the current profile, rate-limits the actor/post pair, validates the actor identifier, and scopes persistence to an owned actor.",
      ),
      communityAction(
        "FEED.ACTION.ACTOR.MUTE",
        "Mutes or unmutes the selected feed actor.",
        "POST /api/actors/[actorId]/mute requires the current profile, rate-limits the pair, validates the desired state, and scopes the muting identity to an owned actor.",
      ),
      communityAction(
        "FEED.ACTION.AUTHOR.BLOCK",
        "Blocks the selected post author for the current member.",
        "The block control posts the loaded feed-post identifier and the service resolves both the post author and current profile before writing the block.",
      ),
      communityAction(
        "FEED.ACTION.TOPIC.FOLLOW",
        "Follows or unfollows the selected feed topic.",
        "The follow endpoint requires the current profile, rate-limits the pair, validates the desired state, and resolves the acting identity through the request context.",
      ),
      communityAction(
        "FEED.ACTION.POST.SHARE",
        "Shares a visible feed post with bounded commentary and visibility.",
        "The share endpoint requires the current profile, applies a per-user rate limit, parses feedShareWriteSchema, and re-verifies the owned sharing actor.",
      ),
      communityAction(
        "FEED.ACTION.POST.UPDATE",
        "Updates the current actor's post body and visibility.",
        "PATCH /api/feed/[postId] requires the current profile, rate-limits the post, parses feedPostEditSchema, and updates only a post owned by the resolved actor.",
      ),
      communityAction(
        "FEED.ACTION.POST.DELETE",
        "Deletes the current actor's feed post after confirmation.",
        "DELETE /api/feed/[postId] requires the current profile, rate-limits the post, and removes only content owned by the resolved actor.",
      ),
      communityAction(
        "FEED.ACTION.POST.REPORT",
        "Reports a feed post with an allowlisted safety reason.",
        "reportFeedPost requires the current profile, parses feedReportSchema, binds the loaded post identifier, and creates a user-scoped report.",
      ),
      communityAction(
        "FEED.ACTION.COMMENT.UPDATE",
        "Updates the current actor's bounded feed comment.",
        "PATCH /api/feed/comments/[commentId] requires the current profile, applies a per-user rate limit, validates the body, and updates only an owned comment.",
      ),
      communityAction(
        "FEED.ACTION.COMMENT.DELETE",
        "Deletes the current actor's feed comment.",
        "DELETE /api/feed/comments/[commentId] requires the current profile, applies a per-user rate limit, and removes only an owned comment.",
      ),
      communityAction(
        "FEED.ACTION.IDENTITY.SWITCH",
        "Switches the active feed identity between the personal profile and an owned page.",
        "setActiveIdentityAction requires the current profile, refuses unowned page identifiers, and stores only the validated identity hint in a protected cookie.",
      ),
      communityAction(
        "FEED.ACTION.FRIEND.REQUEST.RESPOND",
        "Accepts or declines a loaded incoming friend request.",
        "respondToFriendRequestAction requires the current profile, rate-limits responses, parses the friendship identifier and allowlisted response, and delegates ownership checks to the friend service.",
      ),
      communityAction(
        "FEED.ACTION.CHAT.START",
        "Starts or opens a Pulse conversation with a loaded friend.",
        "startChatAction requires the current profile, rate-limits conversation starts, validates the target and optional sending actor, and re-verifies actor ownership before redirecting.",
      ),
      communityAction(
        "FEED.ACTION.CHAT.SEND",
        "Sends a bounded message from the feed's quick-conversation dock.",
        "POST /api/conversations/[id]/messages requires the current profile, rate-limits the conversation, parses conversationMessageSchema, and sends only within a participant-visible conversation.",
      ),
      communityAction(
        "FEED.ACTION.CONVERSATION.OPEN",
        "Opens a loaded Pulse conversation or the friends directory.",
        "Destinations use conversation identifiers returned by participant-scoped reads or fixed same-origin Pulse routes.",
      ),
      communityAction(
        "FEED.ACTION.CALL.MANAGE",
        "Starts, joins, responds to, configures, retries, or leaves an eligible voice or video call.",
        "Call APIs require the current profile and participant access; starting is server-tier-gated, while microphone, camera, screen-share, and device controls operate on the connected LiveKit room.",
      ),
      communityAction(
        "FEED.ACTION.RACE.SEARCH",
        "Submits race search text from the device-preview header.",
        "Both prototype search forms submit by GET to /races with q and the fixed relevance sort.",
      ),
      communityAction(
        "FEED.ACTION.PROTOTYPE.INTERACT",
        "Exercises the enabled device-preview composer, comment, save, share, and quick-chat controls locally.",
        "FeedSystemPrototype prevents native submission and changes only component-local demo state; it is reachable only when the page's device-preview gate accepts the requested variant.",
      ),
      communityAction(
        "FEED.ACTION.HUB.NAVIGATE",
        "Opens a fixed hub, account, racing, marketplace, group, profile, or support destination.",
        "The navigation surfaces use fixed same-origin routes or identifiers from the current member's request-scoped records.",
      ),
      communityAction(
        "FEED.ACTION.SIGN-IN-OR-PLAN.OPEN",
        "Opens sign-in for a visitor or plan information for a tier-gated member.",
        "The rendered branches use fixed same-origin /sign-in and /pricing destinations; mutation paths independently enforce identity and tier.",
      ),
    ],
    forms: [
      communityForm(
        "FEED.FORM.POST",
        "POST /api/feed",
        "topicId?:id,body:trimmed-string(2..5000),mediaIds<=10,pageId?:owned-page-id,visibility?:public|members|connections|only_me",
      ),
      communityForm(
        "FEED.FORM.COMMENT",
        "POST /api/feed/[postId]/comments",
        "postId:path-bound-visible-post-id,body:trimmed-string(2..2000),parentCommentId?:same-post-comment-id,actorId?:owned-actor-id",
      ),
      communityForm(
        "FEED.FORM.POST-EDIT",
        "PATCH /api/feed/[postId]",
        "postId:path-bound-owned-post-id,body:trimmed-string(2..5000),visibility:public|members|connections|only_me",
      ),
      communityForm(
        "FEED.FORM.FRIEND-ACCEPT",
        "SERVER ACTION respondToFriendRequestAction",
        "friendshipId:loaded-incoming-request-id,response:accept",
      ),
      communityForm(
        "FEED.FORM.FRIEND-DECLINE",
        "SERVER ACTION respondToFriendRequestAction",
        "friendshipId:loaded-incoming-request-id,response:decline",
      ),
      communityForm(
        "FEED.FORM.QUICK-MESSAGE",
        "POST /api/conversations/[id]/messages",
        "conversationId:path-bound-participant-conversation-id,body:trimmed-string(1..5000),mediaIds<=4",
      ),
      communityForm(
        "FEED.FORM.CHAT-START",
        "SERVER ACTION startChatAction",
        "profileId:loaded-friend-profile-id,senderActorId?:owned-actor-id",
      ),
      communityForm(
        "FEED.FORM.IDENTITY",
        "SERVER ACTION setActiveIdentityAction",
        "identity:personal|owned-page-id",
      ),
      communityForm(
        "FEED.FORM.PROTOTYPE-POST",
        "CLIENT STATE FeedSystemPrototype.post",
        "draft?:string,attachment?:Photo|Video",
      ),
      communityForm(
        "FEED.FORM.PROTOTYPE-COMMENT",
        "CLIENT STATE FeedSystemPrototype.comment",
        "postId:demo-post-id,draft:trimmed-string",
      ),
      communityForm(
        "FEED.FORM.PROTOTYPE-CHAT",
        "CLIENT STATE FeedSystemPrototype.chat",
        "draft?:string,attachment?:file|photo",
      ),
      communityForm(
        "FEED.FORM.PROTOTYPE-RACE-SEARCH",
        "GET /races",
        "q?:string,sort:relevance",
      ),
      communityForm(
        "FEED.FORM.PROTOTYPE-MOBILE-RACE-SEARCH",
        "GET /races",
        "q?:string,sort:relevance",
      ),
      communityForm(
        "FEED.FORM.POST-REPORT",
        "SERVER ACTION reportFeedPost",
        "postId:server-bound-visible-post-id,reason:spam|harassment|misinformation|illegal|other",
      ),
      communityForm(
        "FEED.FORM.COMMENT-EDIT",
        "PATCH /api/feed/comments/[commentId]",
        "commentId:path-bound-owned-comment-id,body:trimmed-string(2..2000)",
      ),
    ],
  },
  "/groups": {
    queryParameters: [],
    actions: [
      communityAction(
        "GROUPS.ACTION.GROUP.OPEN",
        "Opens a selected public group.",
        "Group destinations use slugs returned by the public group query and the registered dynamic route owns the destination.",
      ),
      communityAction(
        "GROUPS.ACTION.THREAD.OPEN",
        "Opens a selected public group thread.",
        "Thread destinations use identifiers returned by public overview or recent-thread queries.",
      ),
      communityAction(
        "GROUPS.ACTION.THREAD-CREATE.OPEN",
        "Opens the first available group where a member can start a thread.",
        "The destination uses a loaded category slug; the group page and server action independently enforce availability and identity.",
      ),
      communityAction(
        "GROUPS.ACTION.MARKETPLACE.OPEN",
        "Opens the marketplace directory from the community header.",
        "The fixed same-origin Link targets /marketplace.",
      ),
    ],
    forms: [],
  },
  "/groups/[slug]": {
    queryParameters: [],
    actions: [
      communityAction(
        "GROUP.ACTION.THREAD.CREATE",
        "Creates a validated thread in the loaded group and opens it.",
        "createForumThread requires the current profile and paid access, parses forumThreadSchema, verifies the loaded category, and writes through the request context.",
      ),
      communityAction(
        "GROUP.ACTION.THREAD.OPEN",
        "Opens a selected thread in the current group.",
        "Thread destinations use identifiers returned with the loaded public category.",
      ),
      communityAction(
        "GROUP.ACTION.GROUPS.OPEN",
        "Returns to the groups directory.",
        "The fixed same-origin Link targets /groups.",
      ),
      communityAction(
        "GROUP.ACTION.SIGN-IN.OPEN",
        "Opens sign-in for a visitor who wants to start a thread.",
        "The signed-out branch renders a fixed same-origin anchor to /sign-in; the server action independently requires the current profile.",
      ),
    ],
    forms: [
      communityForm(
        "GROUP.FORM.THREAD-CREATE",
        "SERVER ACTION createForumThread",
        "categoryId:loaded-group-id,title:trimmed-string(5..200),body:trimmed-string(20..20000)",
      ),
    ],
  },
  "/groups/threads/[id]": {
    queryParameters: [],
    actions: [
      communityAction(
        "GROUP-THREAD.ACTION.REPLY",
        "Adds a validated reply to the loaded unlocked thread.",
        "replyToForumThread requires the current profile and paid access, parses forumReplySchema, and rechecks that the server-bound thread exists and is unlocked.",
      ),
      communityAction(
        "GROUP-THREAD.ACTION.GROUP.OPEN",
        "Returns to the thread's owning group.",
        "The destination uses the category slug returned with the loaded thread.",
      ),
      communityAction(
        "GROUP-THREAD.ACTION.SIGN-IN.OPEN",
        "Opens sign-in for a visitor who wants to reply.",
        "The signed-out unlocked branch renders a fixed same-origin anchor to /sign-in; the server action independently requires the current profile.",
      ),
    ],
    forms: [
      communityForm(
        "GROUP-THREAD.FORM.REPLY",
        "SERVER ACTION replyToForumThread",
        "threadId:server-bound-unlocked-thread-id,body:trimmed-string(20..20000)",
      ),
    ],
  },
  "/pulse": {
    queryParameters: [],
    actions: [
      communityAction(
        "PULSE.ACTION.CONVERSATION.OPEN",
        "Opens a participant-visible private conversation.",
        "Conversation links use identifiers returned by listConversationsForProfile through the current profile's request context.",
      ),
      communityAction(
        "PULSE.ACTION.MESSAGE.SEND",
        "Starts or reuses a conversation and sends a bounded private message.",
        "sendMessage requires the current profile, applies a per-user rate limit, parses messageSchema, and delegates participant, block, moderation, and media checks to conversation services.",
      ),
      communityAction(
        "PULSE.ACTION.FRIENDS.OPEN",
        "Opens the current member's Pulse friends directory.",
        "The fixed same-origin Link targets /pulse/friends, whose page scopes friends to the current profile.",
      ),
      communityAction(
        "PULSE.ACTION.FRIEND.CONVERSATION.OPEN",
        "Opens an existing friend conversation from its message, voice, or video affordance.",
        "All three affordances use the conversation identifier returned by the participant-scoped friend read; call controls are gated inside the conversation.",
      ),
      communityAction(
        "PULSE.ACTION.SIGN-IN.OPEN",
        "Opens sign-in for a visitor who wants to use private messaging.",
        "The signed-out branch renders a fixed same-origin anchor to /sign-in; all message mutation paths independently require the current profile.",
      ),
    ],
    forms: [
      communityForm(
        "PULSE.FORM.MESSAGE",
        "SERVER ACTION sendMessage",
        "recipientProfileId:loaded-recipient-id,body:trimmed-string(1..5000),mediaIds<=4",
      ),
    ],
  },
  "/pulse/[id]": {
    queryParameters: ["before", "call", "q"],
    actions: [
      communityAction(
        "PULSE-THREAD.ACTION.MARK-READ",
        "Marks the loaded conversation read for the current participant.",
        "markConversationReadAction requires the current profile and markConversationRead resolves the server-bound conversation through participant-scoped access.",
      ),
      communityAction(
        "PULSE-THREAD.ACTION.BLOCK",
        "Blocks the loaded private conversation for the current participant.",
        "blockConversation requires the current profile and setConversationBlock resolves the conversation through participant-scoped access.",
      ),
      communityAction(
        "PULSE-THREAD.ACTION.UNBLOCK",
        "Removes the current participant's block from the loaded conversation.",
        "unblockConversation requires the current profile and setConversationBlock permits only the participant who owns the block to clear it.",
      ),
      communityAction(
        "PULSE-THREAD.ACTION.SEARCH",
        "Searches the current conversation for bounded normalised text.",
        "The GET form targets the loaded /pulse/[id] route; q is trimmed, whitespace-normalised, bounded to 100 characters, and searched only within the participant-scoped conversation.",
      ),
      communityAction(
        "PULSE-THREAD.ACTION.SEARCH.CLEAR",
        "Clears the conversation search query.",
        "The fixed same-origin Link returns to the loaded conversation without q.",
      ),
      communityAction(
        "PULSE-THREAD.ACTION.PAGE.EARLIER",
        "Loads the preceding bounded page of visible conversation messages.",
        "The before cursor comes from the oldest loaded message and getConversationForProfile keeps the read participant-scoped and bounded.",
      ),
      communityAction(
        "PULSE-THREAD.ACTION.PAGE.LATEST",
        "Returns from an earlier message page to the latest conversation view.",
        "The fixed same-origin Link removes the before cursor from the loaded conversation route.",
      ),
      communityAction(
        "PULSE-THREAD.ACTION.REACTION.TOGGLE",
        "Toggles the current participant's reaction on a loaded message.",
        "toggleMessageReaction requires the current profile, rate-limits the message pair, and the service verifies both conversation participation and visible message membership.",
      ),
      communityAction(
        "PULSE-THREAD.ACTION.MESSAGE.DELETE",
        "Soft-deletes the current participant's loaded message.",
        "deleteConversationMessage requires the current profile and the service verifies conversation participation and message ownership before soft deletion.",
      ),
      communityAction(
        "PULSE-THREAD.ACTION.MESSAGE.REPORT",
        "Reports another participant's loaded message with an allowlisted reason.",
        "reportConversationMessage requires the current profile, rate-limits the message pair, verifies conversation membership, rejects self-reporting, and parses reportCreateSchema.",
      ),
      communityAction(
        "PULSE-THREAD.ACTION.MESSAGE.SEND",
        "Sends a bounded reply with clean attachable media to the loaded conversation.",
        "POST /api/conversations/[id]/messages requires the current profile, rate-limits the conversation, parses conversationMessageSchema, and delegates participant, block, moderation, and media checks to the service.",
      ),
      communityAction(
        "PULSE-THREAD.ACTION.CALL.MANAGE",
        "Starts, joins, responds to, retries, configures, or leaves an eligible voice or video call.",
        "Call APIs require the current profile and conversation participation; server services tier-gate call creation and the client controls only the connected LiveKit room's local media.",
      ),
      communityAction(
        "PULSE-THREAD.ACTION.ATTACHMENT.OPEN",
        "Opens or plays a clean, ready message attachment.",
        "The page emits blob or processed-media URLs only after the participant-scoped message read reports clean scan status and ready processing status.",
      ),
      communityAction(
        "PULSE-THREAD.ACTION.PULSE.OPEN",
        "Returns to the Pulse inbox.",
        "The fixed same-origin Link targets /pulse.",
      ),
      communityAction(
        "PULSE-THREAD.ACTION.SIGN-IN.OPEN",
        "Opens sign-in when a visitor reaches a private conversation route.",
        "The signed-out fallback renders a fixed same-origin anchor to /sign-in before any conversation read occurs.",
      ),
    ],
    forms: [
      communityForm(
        "PULSE-THREAD.FORM.MARK-READ",
        "SERVER ACTION markConversationReadAction",
        "conversationId:server-bound-participant-conversation-id",
      ),
      communityForm(
        "PULSE-THREAD.FORM.UNBLOCK",
        "SERVER ACTION unblockConversation",
        "conversationId:server-bound-participant-conversation-id,blockedBy:current-profile",
      ),
      communityForm(
        "PULSE-THREAD.FORM.BLOCK",
        "SERVER ACTION blockConversation",
        "conversationId:server-bound-participant-conversation-id",
      ),
      communityForm(
        "PULSE-THREAD.FORM.SEARCH",
        "GET /pulse/[id]",
        "conversationId:path-bound-participant-conversation-id,q?:trimmed-string(2..100)",
      ),
      communityForm(
        "PULSE-THREAD.FORM.REACTION",
        "SERVER ACTION toggleMessageReaction",
        "conversationId:server-bound-participant-conversation-id,messageId:server-bound-visible-message-id",
      ),
      communityForm(
        "PULSE-THREAD.FORM.DELETE",
        "SERVER ACTION deleteConversationMessage",
        "conversationId:server-bound-participant-conversation-id,messageId:server-bound-owned-message-id",
      ),
      communityForm(
        "PULSE-THREAD.FORM.REPORT",
        "SERVER ACTION reportConversationMessage",
        "conversationId:server-bound-participant-conversation-id,messageId:server-bound-other-message-id,reason:spam|harassment|misinformation|illegal|other",
      ),
      communityForm(
        "PULSE-THREAD.FORM.MESSAGE",
        "POST /api/conversations/[id]/messages",
        "conversationId:path-bound-participant-conversation-id,body:trimmed-string(1..5000),mediaIds<=4",
      ),
    ],
  },
  "/pulse/friends": {
    queryParameters: [],
    actions: [
      communityAction(
        "PULSE-FRIENDS.ACTION.PULSE.OPEN",
        "Returns to the Pulse inbox.",
        "The fixed same-origin Link targets /pulse.",
      ),
      communityAction(
        "PULSE-FRIENDS.ACTION.CONVERSATION.OPEN",
        "Opens an existing friend conversation from its message, voice, or video affordance.",
        "All three affordances use a conversation identifier returned by listFriendsForProfile through the current profile's request context.",
      ),
      communityAction(
        "PULSE-FRIENDS.ACTION.SIGN-IN.OPEN",
        "Opens sign-in for a visitor who wants to view friends.",
        "The signed-out branch renders a fixed same-origin anchor to /sign-in before any private friend read occurs.",
      ),
    ],
    forms: [],
  },
  "/marketplace": {
    queryParameters: ["q", "category", "sort", "page", "submitted"],
    actions: [
      marketplaceAction(
        "MARKETPLACE.ACTION.FILTER",
        "Filters and sorts active marketplace inventory by the submitted search text, category, and allowlisted sort order.",
        "The GET form targets /marketplace; the page bounds q and category, allowlists sort, resets pagination, and fetchMarketplaceListings returns only active, approved, unarchived, unexpired records.",
      ),
      marketplaceAction(
        "MARKETPLACE.ACTION.CLEAR",
        "Clears the current search, category, sort, and page state.",
        "The fixed same-origin Link returns to /marketplace without query parameters.",
      ),
      marketplaceAction(
        "MARKETPLACE.ACTION.PAGE.CHANGE",
        "Moves to the previous or next bounded marketplace results page while preserving active filters and sort order.",
        "Server-rendered links use marketplacePageHref with allowlisted q, category and sort values; page parsing and database offsets are capped before querying.",
      ),
      marketplaceAction(
        "MARKETPLACE.ACTION.LISTING.OPEN",
        "Opens a selected active marketplace item at /marketplace/[id].",
        "Listing destinations use identifiers from the public inventory query and the registered dynamic route owns the destination.",
      ),
      marketplaceAction(
        "MARKETPLACE.ACTION.CREATE.OPEN",
        "Opens the marketplace item creation flow.",
        "The fixed same-origin Link targets /marketplace/new, whose page and server action independently enforce sign-in and Pro eligibility.",
      ),
      marketplaceAction(
        "MARKETPLACE.ACTION.GROUPS.OPEN",
        "Opens the community groups directory from the marketplace introduction.",
        "The fixed same-origin Link targets the registered /groups route.",
      ),
      marketplaceAction(
        "MARKETPLACE.ACTION.PROFILE.OPEN",
        "Opens the public greyhound profile represented by a marketplace player card.",
        "Profile destinations come from loaded listing records or the fixed reviewed showcase catalogue.",
      ),
      marketplaceAction(
        "MARKETPLACE.ACTION.CARD.INSPECT",
        "Flips a marketplace player card or toggles its front information panel.",
        "The card buttons mutate only component-local presentation state and expose pressed state to assistive technology.",
      ),
      marketplaceAction(
        "MARKETPLACE.ACTION.CARD.SAVE",
        "Toggles the visible saved state of an eligible marketplace player card.",
        "Reviewed showcase cards remain local-only; account-mode cards POST the loaded listing identifier to the authenticated, rate-limited save endpoint, which accepts only public non-owned listings.",
      ),
    ],
    forms: [
      marketplaceForm(
        "MARKETPLACE.FORM.FILTER",
        "GET /marketplace",
        "q?:trimmed-max-200-string,category?:trimmed-max-100-slug,sort?:created_at|price|expires_at",
      ),
    ],
  },
  "/marketplace/[id]": {
    queryParameters: [],
    actions: [
      marketplaceAction(
        "MARKETPLACE-DETAIL.ACTION.SAVE.TOGGLE",
        "Saves or unsaves the loaded marketplace item for the signed-in buyer.",
        "POST /api/listings/[id]/save requires the current profile, applies a per-profile/listing rate limit, and permits only public listings not owned by that profile.",
      ),
      marketplaceAction(
        "MARKETPLACE-DETAIL.ACTION.ENQUIRY.SEND",
        "Sends a bounded seller enquiry and opens the resulting Pulse conversation.",
        "POST /api/listings/[id]/enquiry requires the current profile, rate-limits the listing pair, parses listingEnquirySchema, enforces paid access, and rejects non-public or self-owned listings.",
      ),
      marketplaceAction(
        "MARKETPLACE-DETAIL.ACTION.OWNER.RENEW",
        "Returns an eligible owned listing to moderator review.",
        "The server-bound listing identifier is checked by getOwnedListing and renewListingForCurrentUser also requires paid feature access.",
      ),
      marketplaceAction(
        "MARKETPLACE-DETAIL.ACTION.OWNER.SOLD",
        "Marks an active owned listing as sold.",
        "markListingSoldForCurrentUser resolves the listing through the current profile and rejects status transitions outside the sold allowlist.",
      ),
      marketplaceAction(
        "MARKETPLACE-DETAIL.ACTION.OWNER.WITHDRAW",
        "Withdraws an active or pending-review owned listing.",
        "withdrawListingForCurrentUser resolves the listing through the current profile and rejects status transitions outside the withdrawal allowlist.",
      ),
      marketplaceAction(
        "MARKETPLACE-DETAIL.ACTION.REPORT",
        "Submits a bounded marketplace-item report for moderator review.",
        "reportListing requires the current profile, applies a per-profile/listing rate limit, parses the allowlisted reason and optional bounded context, and creates a user-scoped report.",
      ),
      marketplaceAction(
        "MARKETPLACE-DETAIL.ACTION.DOG.OPEN",
        "Opens the registered greyhound linked to the listing.",
        "The destination uses the dog identifier included with the access-checked listing record.",
      ),
      marketplaceAction(
        "MARKETPLACE-DETAIL.ACTION.MARKETPLACE.OPEN",
        "Returns to the marketplace directory.",
        "The fixed same-origin Link targets /marketplace.",
      ),
      marketplaceAction(
        "MARKETPLACE-DETAIL.ACTION.PLAN.OPEN",
        "Opens plan information when the signed-in member cannot message the seller.",
        "The tier-gated branch renders a fixed same-origin Link to /pricing only for a signed-in non-owner without Pro access.",
      ),
      marketplaceAction(
        "MARKETPLACE-DETAIL.ACTION.SIGN-IN.OPEN",
        "Opens sign-in when a visitor wants to message the seller.",
        "The signed-out non-owner branch renders a fixed same-origin anchor to /sign-in.",
      ),
    ],
    forms: [
      marketplaceForm(
        "MARKETPLACE-DETAIL.FORM.RENEW",
        "SERVER ACTION renewListing",
        "listingId:server-bound-owned-listing-id",
      ),
      marketplaceForm(
        "MARKETPLACE-DETAIL.FORM.SOLD",
        "SERVER ACTION markListingSold",
        "listingId:server-bound-owned-listing-id,status:active",
      ),
      marketplaceForm(
        "MARKETPLACE-DETAIL.FORM.WITHDRAW",
        "SERVER ACTION withdrawListing",
        "listingId:server-bound-owned-listing-id,status:active|pending_review",
      ),
      marketplaceForm(
        "MARKETPLACE-DETAIL.FORM.REPORT",
        "SERVER ACTION reportListing",
        "listingId:server-bound-listing-id,reason:spam|harassment|misinformation|illegal|other,description?:trimmed-string<=500",
      ),
      marketplaceForm(
        "MARKETPLACE-DETAIL.FORM.ENQUIRY",
        "POST /api/listings/[id]/enquiry",
        "listingId:path-bound-public-listing-id,message:trimmed-string(5..2000)",
      ),
    ],
  },
  "/marketplace/new": {
    queryParameters: ["dogId", "title", "price"],
    actions: [
      marketplaceAction(
        "MARKETPLACE-CREATE.ACTION.SUBMIT",
        "Submits a new marketplace item for moderator review and returns to the directory with review feedback.",
        "createListing requires the current profile and parses listingSchema; createListingForCurrentUser enforces paid access, dog and category rules, required acknowledgements, attachable media, moderation checks, and pending-review persistence.",
      ),
      marketplaceAction(
        "MARKETPLACE-CREATE.ACTION.MARKETPLACE.OPEN",
        "Returns to the marketplace directory without submitting.",
        "The fixed same-origin Link targets /marketplace.",
      ),
      marketplaceAction(
        "MARKETPLACE-CREATE.ACTION.PLAN.OPEN",
        "Opens plan information for a signed-in member without listing access.",
        "The non-Pro branch renders a fixed same-origin Link to /pricing, while the server-side create path independently enforces paid access.",
      ),
      marketplaceAction(
        "MARKETPLACE-CREATE.ACTION.SIGN-IN.OPEN",
        "Opens sign-in for a visitor who wants to create an item.",
        "The signed-out branch renders a fixed same-origin anchor to /sign-in; the server action independently requires the current profile.",
      ),
    ],
    forms: [
      marketplaceForm(
        "MARKETPLACE-CREATE.FORM.LISTING",
        "SERVER ACTION createListing",
        "type:listing-type,categoryId?:known-category-id,title:trimmed-string(5..100),description:trimmed-string(20..5000),price?:nonnegative-number,mediaIds<=11,attributes<=8,welfareAcknowledged:true,legalAcknowledged:true",
      ),
    ],
  },
  "/account": {
    queryParameters: ["checkout", "interval", "plan"],
    actions: [
      accountAction(
        "ACCOUNT.ACTION.PROFILE.UPDATE",
        "Saves the signed-in member's account profile and visibility settings, then returns to /account.",
        "updateProfile requires the current profile, parses profileUpdateSchema, enforces paid marketing fields, and writes through the request-scoped database context.",
      ),
      accountAction(
        "ACCOUNT.ACTION.PROFILE-STUDIO.OPEN",
        "Opens the signed-in member's Profile Studio at /account/profile.",
        "The fixed same-origin Link targets the registered /account/profile route.",
      ),
      accountAction(
        "ACCOUNT.ACTION.MEMBER-AREA.OPEN",
        "Opens a visible membership, settings, activity, support, managed-page, or authorised admin destination.",
        "Every destination is a fixed same-origin Link; the admin destination is rendered only when canAccessAdmin is true.",
      ),
      accountAction(
        "ACCOUNT.ACTION.DOG.OPEN",
        "Opens a dog linked to the current member, or the dog search when none is linked.",
        "Dog destinations use identifiers from the current profile's loaded ownership records; the empty-state Link is fixed to /dogs.",
      ),
      accountAction(
        "ACCOUNT.ACTION.DATA-EXPORT.REQUEST",
        "Requests and downloads the current member's bounded JSON data export.",
        "POST /api/users/me/export blocks cross-site requests, requires the current profile, applies a fail-closed rate limit, scopes reads to that profile, and returns private no-store output.",
      ),
      accountAction(
        "ACCOUNT.ACTION.DELETION.REQUEST",
        "Records an account-deletion request with the documented grace window.",
        "requestAccountDeletion requires the current profile and the service updates only that user while writing the corresponding audit record.",
      ),
      accountAction(
        "ACCOUNT.ACTION.CHECKOUT.CONTINUE",
        "Continues an allowlisted pending Pro plan and interval into Stripe Checkout.",
        "POST /api/billing/checkout parses checkoutRequestSchema, checks the trusted origin, preserves unauthenticated intent through an allowlisted returnTo, and applies a fail-closed per-user rate limit.",
      ),
      accountAction(
        "ACCOUNT.ACTION.SIGN-IN.OPEN",
        "Opens sign-in and returns to the allowlisted account plan intent when authentication completes.",
        "accountReturnTo serialises only parsed plan and interval values into a same-origin /account return path.",
      ),
    ],
    forms: [
      accountForm(
        "ACCOUNT.FORM.PROFILE",
        "SERVER ACTION updateProfile",
        "displayName:string(2..80),profileVisibility:public|members|connections|only_me,contactVisibility:public|members|connections|only_me,state:string<=8,bio:string<=1000,paidMarketingFields?:bounded",
      ),
      accountForm(
        "ACCOUNT.FORM.DATA-EXPORT",
        "POST /api/users/me/export",
        "authenticated current-user request; no client-selected subject",
      ),
      accountForm(
        "ACCOUNT.FORM.DELETION",
        "SERVER ACTION requestAccountDeletion",
        "authenticated current-user request; confirmation:DELETE; no client-selected subject",
      ),
      accountForm(
        "ACCOUNT.FORM.CHECKOUT",
        "POST /api/billing/checkout",
        "plan:pro,interval:monthly|yearly",
      ),
    ],
  },
  "/account/appearance": {
    queryParameters: ["app", "dock", "market", "sponsored"],
    actions: [
      accountAction(
        "ACCOUNT-APPEARANCE.ACTION.PREVIEW",
        "Applies the selected app template, dock skin, Marketplace template and sponsored-card visibility to URL-only preview state.",
        "The native GET form changes only the current URL; resolveAppearancePreviewState allowlists every value and the page explicitly states that no account, database, sponsored-delivery or billing setting is saved. In production the route remains unavailable unless ENABLE_DEVICE_PREVIEWS is explicitly true.",
      ),
      accountAction(
        "ACCOUNT-APPEARANCE.ACTION.APP-PREVIEW.OPEN",
        "Opens the selected mobile app template in the device-preview surface.",
        "The Link is built only from the allowlisted app and sponsored values returned by resolveAppearancePreviewState and targets the fixed same-origin /feed/device-preview route.",
      ),
      accountAction(
        "ACCOUNT-APPEARANCE.ACTION.DOCK-PREVIEW.OPEN",
        "Opens the selected dock skin in the Design Lab dock review surface.",
        "The Link is built only from the allowlisted dock value and targets the fixed same-origin /design-lab/dock-skins route.",
      ),
      accountAction(
        "ACCOUNT-APPEARANCE.ACTION.MARKETPLACE-PREVIEW.OPEN",
        "Opens the selected Marketplace template in its review surface.",
        "The Link is built only from the allowlisted Marketplace value and targets the fixed same-origin /marketplace/design-lab route.",
      ),
    ],
    forms: [
      accountForm(
        "ACCOUNT-APPEARANCE.FORM.PREVIEW",
        "GET /account/appearance",
        "app:known-prototype-variant,dock:known-dock-skin,market:known-marketplace-template,sponsored:on|off; URL-only and non-persistent",
      ),
    ],
  },
  "/account/billing": {
    queryParameters: ["billing", "checkout", "interval", "plan", "portal"],
    actions: [
      accountAction(
        "ACCOUNT-BILLING.ACTION.PORTAL.OPEN",
        "Opens the signed-in member's Stripe customer portal.",
        "POST /api/billing/portal checks the trusted origin, requires the current profile, applies a fail-closed rate limit, and creates a portal session for that billing identity.",
      ),
      accountAction(
        "ACCOUNT-BILLING.ACTION.PLAN.OPEN",
        "Opens the pricing screen to start or change a plan.",
        "The fixed same-origin Link targets /pricing; subscription state changes only after signed webhook settlement.",
      ),
      accountAction(
        "ACCOUNT-BILLING.ACTION.STATUS.REFRESH",
        "Reloads /account/billing after a checkout return so current billing state can be read again.",
        "The fixed same-origin Link targets /account/billing without trusting return parameters as settlement evidence.",
      ),
      accountAction(
        "ACCOUNT-BILLING.ACTION.CHECKOUT.RETRY",
        "Returns a cancelled, allowlisted Pro checkout choice to pricing for an explicit retry.",
        "URLSearchParams is populated only from parsed plan and monthly or yearly interval values.",
      ),
      accountAction(
        "ACCOUNT-BILLING.ACTION.ACCOUNT.OPEN",
        "Returns to the account overview.",
        "The fixed same-origin Link targets /account.",
      ),
      accountAction(
        "ACCOUNT-BILLING.ACTION.SIGN-IN.OPEN",
        "Opens sign-in before private billing details are shown.",
        "The fixed same-origin anchor targets /sign-in and the signed-in billing branch is selected only after getCurrentUser succeeds.",
      ),
    ],
    forms: [
      accountForm(
        "ACCOUNT-BILLING.FORM.PORTAL",
        "POST /api/billing/portal",
        "authenticated current-user request; no client-selected customer",
      ),
    ],
  },
  "/account/listings": {
    queryParameters: [],
    actions: [
      accountAction(
        "ACCOUNT-LISTINGS.ACTION.ACCOUNT.OPEN",
        "Returns to the account overview.",
        "The fixed same-origin Link targets /account after requireCurrentUserProfile has resolved the current member.",
      ),
      accountAction(
        "ACCOUNT-LISTINGS.ACTION.CREATE.OPEN",
        "Opens marketplace item creation.",
        "The fixed same-origin Link targets /marketplace/new, whose page and write path independently enforce authentication and Pro access.",
      ),
      accountAction(
        "ACCOUNT-LISTINGS.ACTION.VIEW.SELECT",
        "Moves among the all, draft, and archived owner views.",
        "VIEW_LINKS is a fixed same-origin allowlist; each destination independently resolves the current profile and owner-scoped query.",
      ),
      accountAction(
        "ACCOUNT-LISTINGS.ACTION.ITEM.OPEN",
        "Opens one listing returned by the current owner's bounded inventory query.",
        "The destination identifier comes from getSellerListingsForCurrentUser, which filters profileId to the server-resolved current profile.",
      ),
      accountAction(
        "ACCOUNT-LISTINGS.ACTION.ITEM.EDIT",
        "Opens the owner editor for a non-archived listing.",
        "The identifier comes from the owner-scoped inventory and the edit page independently rechecks Pro tier and ownership before rendering.",
      ),
    ],
    forms: [],
  },
  "/account/listings/archived": {
    queryParameters: [],
    actions: [
      accountAction(
        "ACCOUNT-LISTINGS-ARCHIVED.ACTION.ACCOUNT.OPEN",
        "Returns to the account overview.",
        "The fixed same-origin Link targets /account after requireCurrentUserProfile has resolved the current member.",
      ),
      accountAction(
        "ACCOUNT-LISTINGS-ARCHIVED.ACTION.CREATE.OPEN",
        "Opens marketplace item creation.",
        "The fixed same-origin Link targets /marketplace/new, whose page and write path independently enforce authentication and Pro access.",
      ),
      accountAction(
        "ACCOUNT-LISTINGS-ARCHIVED.ACTION.VIEW.SELECT",
        "Moves among the all, draft, and archived owner views.",
        "VIEW_LINKS is a fixed same-origin allowlist; each destination independently resolves the current profile and owner-scoped query.",
      ),
      accountAction(
        "ACCOUNT-LISTINGS-ARCHIVED.ACTION.ITEM.OPEN",
        "Opens one archived listing returned by the current owner's bounded inventory query.",
        "getSellerListingsForCurrentUser filters profileId to the server-resolved current profile and restricts this view to archived status.",
      ),
    ],
    forms: [],
  },
  "/account/listings/drafts": {
    queryParameters: [],
    actions: [
      accountAction(
        "ACCOUNT-LISTINGS-DRAFTS.ACTION.ACCOUNT.OPEN",
        "Returns to the account overview.",
        "The fixed same-origin Link targets /account after requireCurrentUserProfile has resolved the current member.",
      ),
      accountAction(
        "ACCOUNT-LISTINGS-DRAFTS.ACTION.CREATE.OPEN",
        "Opens marketplace item creation.",
        "The fixed same-origin Link targets /marketplace/new, whose page and write path independently enforce authentication and Pro access.",
      ),
      accountAction(
        "ACCOUNT-LISTINGS-DRAFTS.ACTION.VIEW.SELECT",
        "Moves among the all, draft, and archived owner views.",
        "VIEW_LINKS is a fixed same-origin allowlist; each destination independently resolves the current profile and owner-scoped query.",
      ),
      accountAction(
        "ACCOUNT-LISTINGS-DRAFTS.ACTION.ITEM.OPEN",
        "Opens one draft listing returned by the current owner's bounded inventory query.",
        "getSellerListingsForCurrentUser filters profileId to the server-resolved current profile and restricts this view to draft status.",
      ),
      accountAction(
        "ACCOUNT-LISTINGS-DRAFTS.ACTION.ITEM.EDIT",
        "Opens the owner editor for the selected draft.",
        "The identifier comes from the owner-scoped inventory and the edit page independently rechecks Pro tier and ownership before rendering.",
      ),
    ],
    forms: [],
  },
  "/account/notifications": {
    queryParameters: [],
    actions: [
      accountAction(
        "ACCOUNT-NOTIFICATIONS.ACTION.ALL.READ",
        "Marks every notification belonging to the current member as read.",
        "markAllNotificationsRead requires the current profile and delegates to the current-user notification service.",
      ),
      accountAction(
        "ACCOUNT-NOTIFICATIONS.ACTION.ITEM.READ",
        "Marks one visible notification belonging to the current member as read.",
        "The visible notification identifier is server-bound into markNotificationRead, which requires the current profile and enforces current-user ownership in the service.",
      ),
      accountAction(
        "ACCOUNT-NOTIFICATIONS.ACTION.ITEM.OPEN",
        "Opens the safe destination attached to a visible notification.",
        "Only href values returned by listNotificationsForUser are rendered as Links for the current member's records.",
      ),
      accountAction(
        "ACCOUNT-NOTIFICATIONS.ACTION.ACCOUNT.OPEN",
        "Returns to the account overview.",
        "The fixed same-origin Link targets /account.",
      ),
    ],
    forms: [
      accountForm(
        "ACCOUNT-NOTIFICATIONS.FORM.ALL-READ",
        "SERVER ACTION markAllNotificationsRead",
        "authenticated current-user request; no client-selected subject",
      ),
      accountForm(
        "ACCOUNT-NOTIFICATIONS.FORM.ITEM-READ",
        "SERVER ACTION markNotificationRead",
        "notificationId:server-bound visible record identifier",
      ),
    ],
  },
  "/account/pages": {
    queryParameters: ["bespoke"],
    actions: [
      accountAction(
        "ACCOUNT-PAGES.ACTION.MAIN.CREATE",
        "Creates an available trainer, punter, or business managed page and opens its editor.",
        "createCustomPageAction requires the current profile, applies a per-user rate limit, parses customPageCreateSchema, and the service enforces tier and ownership rules.",
      ),
      accountAction(
        "ACCOUNT-PAGES.ACTION.DOG.CREATE",
        "Creates a managed page for a verified dog owned by the current member.",
        "The dog identifier comes from listApprovedOwnedDogs and createCustomPageAction validates it through customPageCreateSchema and ownership-aware service logic.",
      ),
      accountAction(
        "ACCOUNT-PAGES.ACTION.MANAGED.OPEN",
        "Opens the selected owned managed page editor.",
        "Editor Links use identifiers from listCustomPagesForCurrentUser and the destination rechecks ownership.",
      ),
      accountAction(
        "ACCOUNT-PAGES.ACTION.PUBLIC.OPEN",
        "Opens the selected published public page.",
        "The Link is rendered only for a loaded page whose published flag is true and uses that page's handle.",
      ),
      accountAction(
        "ACCOUNT-PAGES.ACTION.BESPOKE.CHECKOUT",
        "Starts the fixed-price bespoke design Stripe Checkout flow.",
        "POST /api/billing/bespoke/checkout checks the trusted origin, requires the current profile, applies a fail-closed rate limit, and creates a server-priced Checkout Session.",
      ),
      accountAction(
        "ACCOUNT-PAGES.ACTION.PLAN.OPEN",
        "Opens pricing when managed pages are unavailable for the current tier.",
        "The fixed same-origin Link targets /pricing and the page renders the creation tools only when hasTier(current.tier, pro) is true.",
      ),
      accountAction(
        "ACCOUNT-PAGES.ACTION.CHECKOUT.RETRY",
        "Moves focus to the bespoke package after a cancelled checkout return.",
        "The fixed same-page anchor targets #bespoke-design; the bespoke query value is display-only and never settles payment.",
      ),
    ],
    forms: [
      accountForm(
        "ACCOUNT-PAGES.FORM.MAIN-CREATE",
        "SERVER ACTION createCustomPageAction",
        "pageType:trainer|punter|business,title:string",
      ),
      accountForm(
        "ACCOUNT-PAGES.FORM.DOG-CREATE",
        "SERVER ACTION createCustomPageAction",
        "pageType:dog,dogId:owned-dog-id,title:string",
      ),
      accountForm(
        "ACCOUNT-PAGES.FORM.BESPOKE-CHECKOUT",
        "POST /api/billing/bespoke/checkout",
        "authenticated current-user request; server-owned product and amount",
      ),
    ],
  },
  "/account/pages/[id]": {
    queryParameters: [],
    actions: [
      accountAction(
        "ACCOUNT-PAGE.ACTION.PUBLISH.TOGGLE",
        "Publishes or unpublishes the current member's managed page.",
        "The page identifier is server-bound and setCustomPagePublished rechecks current-user ownership before applying the parsed publish boolean.",
      ),
      accountAction(
        "ACCOUNT-PAGE.ACTION.UPDATE",
        "Saves the managed page content, contact visibility, media references, and focal positions.",
        "updateCustomPageAction requires the current profile, rate-limits updates, parses customPageUpdateSchema, and updates only an owned page.",
      ),
      accountAction(
        "ACCOUNT-PAGE.ACTION.DOG-CARD.GENERATE",
        "Generates or regenerates the current owned dog page's card when the platform flag permits it.",
        "The action is rendered only for dog pages when card generation is enabled; generateDogCardAction requires the current profile, rate-limits requests, and rechecks the bound page.",
      ),
      accountAction(
        "ACCOUNT-PAGE.ACTION.DELETE",
        "Permanently deletes the current member's managed page and returns to the page list.",
        "deleteCustomPageAction requires the current profile and deleteCustomPage enforces ownership for the server-bound page identifier.",
      ),
      accountAction(
        "ACCOUNT-PAGE.ACTION.PUBLIC.OPEN",
        "Opens the managed page's public profile when it is published.",
        "The Link is rendered only when the loaded owned page is published and uses that page's handle.",
      ),
      accountAction(
        "ACCOUNT-PAGE.ACTION.LIST.OPEN",
        "Returns to the owned managed-page list.",
        "The fixed same-origin Link targets /account/pages.",
      ),
      accountAction(
        "ACCOUNT-PAGE.ACTION.MEDIA-EDITOR.JUMP",
        "Moves focus to the page banner or avatar editor.",
        "Fixed same-page anchors target #page-banner-editor and #page-avatar-editor.",
      ),
    ],
    forms: [
      accountForm(
        "ACCOUNT-PAGE.FORM.PUBLISH",
        "SERVER ACTION publishCustomPageAction",
        "pageId:server-bound owned-page-id,publish:true|false",
      ),
      accountForm(
        "ACCOUNT-PAGE.FORM.UPDATE",
        "SERVER ACTION updateCustomPageAction",
        "pageId:server-bound owned-page-id,title:string,tagline?:string,about?:string,contactVisibility:enum,contact?:bounded,website?:url,media?:owned-media-ids,focalPositions?:bounded",
      ),
      accountForm(
        "ACCOUNT-PAGE.FORM.DOG-CARD",
        "SERVER ACTION generateDogCardAction",
        "pageId:server-bound owned-dog-page-id",
      ),
      accountForm(
        "ACCOUNT-PAGE.FORM.DELETE",
        "SERVER ACTION deleteCustomPageAction",
        "pageId:server-bound owned-page-id,confirmation:DELETE",
      ),
    ],
  },
  "/account/privacy": {
    queryParameters: [],
    actions: [
      accountAction(
        "ACCOUNT-PRIVACY.ACTION.ACCOUNT.OPEN",
        "Returns to the account overview after reviewing private records.",
        "The fixed same-origin Link targets /account; requirePrivacyProfile and request-scoped queries keep the displayed records bound to the current member.",
      ),
    ],
    forms: [],
  },
  "/account/profile": {
    queryParameters: [],
    actions: [
      accountAction(
        "ACCOUNT-PROFILE.ACTION.PUBLISH",
        "Publishes updated personal avatar and cover choices after server validation and media safety handling.",
        "updatePersonalIdentityMedia requires the current profile, parses personalActorMediaUpdateSchema, and delegates owned-media updates to updatePersonalActorMedia.",
      ),
      accountAction(
        "ACCOUNT-PROFILE.ACTION.CANCEL",
        "Returns to /account without submitting profile media changes.",
        "Both fixed same-origin cancel and back Links target /account.",
      ),
    ],
    forms: [
      accountForm(
        "ACCOUNT-PROFILE.FORM.MEDIA",
        "SERVER ACTION updatePersonalIdentityMedia",
        "avatarMediaId?:owned-media-id,coverMediaId?:owned-media-id,removeAvatar?:boolean,removeCover?:boolean,avatarFocalX/Y:bounded,avatarZoom:bounded,avatarRotation:bounded,coverFocalX/Y:bounded,coverZoom:bounded,coverRotation:bounded",
      ),
    ],
  },
  "/account/saved-listings": {
    queryParameters: [],
    actions: [
      accountAction(
        "ACCOUNT-SAVED.ACTION.LISTING.OPEN",
        "Opens a saved active marketplace listing.",
        "Listing Links use identifiers returned by getSavedListingsForCurrentUser for the current profile and target the registered marketplace detail route.",
      ),
      accountAction(
        "ACCOUNT-SAVED.ACTION.MARKETPLACE.OPEN",
        "Opens the marketplace directory from the empty state.",
        "The fixed same-origin Link targets /marketplace.",
      ),
      accountAction(
        "ACCOUNT-SAVED.ACTION.ACCOUNT.OPEN",
        "Returns to the account overview.",
        "The fixed same-origin Link targets /account.",
      ),
    ],
    forms: [],
  },
  "/account/security": {
    queryParameters: [],
    actions: [
      accountAction(
        "ACCOUNT-SECURITY.ACTION.SIGN-IN.OPEN",
        "Opens the configured sign-in and identity-management entry point.",
        "The fixed same-origin anchor targets /sign-in; private account details render only after requireCurrentUserProfile succeeds.",
      ),
      accountAction(
        "ACCOUNT-SECURITY.ACTION.PRIVACY.OPEN",
        "Opens the current member's privacy records.",
        "The fixed same-origin Link targets /account/privacy, whose page independently requires the current profile.",
      ),
      accountAction(
        "ACCOUNT-SECURITY.ACTION.ACCOUNT.OPEN",
        "Returns to the account overview.",
        "The fixed same-origin Link targets /account.",
      ),
    ],
    forms: [],
  },
  "/account/support": {
    queryParameters: ["q", "ticket"],
    actions: [
      accountAction(
        "ACCOUNT-SUPPORT.ACTION.HELP.SEARCH",
        "Filters the current member's available help topics and guided tours without changing server data.",
        "The native GET form targets the fixed /account/support route; normalizeHelpSearchQuery selects only the first value, trims it and bounds it to 80 characters before matching the static help catalogue.",
      ),
      accountAction(
        "ACCOUNT-SUPPORT.ACTION.CONTACT.OPEN",
        "Opens the contact flow to create a support ticket.",
        "Both fixed same-origin contact Links target /contact; the ticket query is display-only and recognises only the created value.",
      ),
      accountAction(
        "ACCOUNT-SUPPORT.ACTION.ACCOUNT.OPEN",
        "Returns to the account overview.",
        "The fixed same-origin Link targets /account; support records are loaded through the current profile's request context.",
      ),
    ],
    forms: [
      accountForm(
        "ACCOUNT-SUPPORT.FORM.HELP.SEARCH",
        "GET /account/support",
        "q?:first-query-value,trimmed-string<=80",
      ),
    ],
  },
  "/account/support/[id]": {
    queryParameters: [],
    actions: [
      accountAction(
        "ACCOUNT-SUPPORT-DETAIL.ACTION.SUPPORT.OPEN",
        "Returns to the current member's support-ticket index.",
        "The fixed same-origin Link targets /account/support after the page requires the current profile and performs an owner-scoped ticket lookup.",
      ),
    ],
    forms: [],
  },
  ...PRODUCTION_SCREEN_ADMIN_CORE_INTERACTION_CONTRACTS,
  ...PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_CONTRACTS,
  ...PRODUCTION_SCREEN_ADMIN_MODERATION_INTERACTION_CONTRACTS,
  ...PRODUCTION_SCREEN_PROFILE_MESSAGING_INTERACTION_CONTRACTS,
  ...PRODUCTION_SCREEN_COMMERCE_INTERACTION_CONTRACTS,
  ...PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_CONTRACTS,
  ...PRODUCTION_SCREEN_PUBLIC_NAVIGATION_INTERACTION_CONTRACTS,
} as const satisfies Readonly<
  Record<string, ProductionScreenInteractionContract>
>;

export const PRODUCTION_SCREEN_FORM_EXCLUSION_ROUTES = [
  "/",
  "/about",
  "/auth/error",
  "/privacy",
  "/responsible-use",
  "/terms",
  "/breeding",
  "/dogs",
  "/races/[id]",
  "/meetings/[id]",
  "/statistics",
  "/tracks/[id]",
  "/forum",
  "/groups",
  "/messages/friends",
  "/pulse/friends",
  "/feed/device-preview",
  "/marketplace/design-lab",
  "/account/privacy",
  "/account/listings",
  "/account/listings/archived",
  "/account/listings/drafts",
  "/account/saved-listings",
  "/account/security",
  "/account/support/[id]",
  "/account/usage",
  "/admin",
  "/admin/actions",
  "/admin/audit",
  "/admin/compliance",
] as const;

export const PRODUCTION_SCREEN_ACTION_EXCLUSION_ROUTES = [
  "/statistics",
  "/admin/actions",
  "/admin/audit",
  "/admin/compliance",
] as const;

const formExclusionRoutes = new Set<string>(
  PRODUCTION_SCREEN_FORM_EXCLUSION_ROUTES,
);
const actionExclusionRoutes = new Set<string>(
  PRODUCTION_SCREEN_ACTION_EXCLUSION_ROUTES,
);
const accountInteractionRoutes = new Set<string>(
  PRODUCTION_SCREEN_ACCOUNT_INTERACTION_ROUTES,
);
const communityInteractionRoutes = new Set<string>(
  PRODUCTION_SCREEN_COMMUNITY_INTERACTION_ROUTES,
);
const publicRacingInteractionRoutes = new Set<string>(
  PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_ROUTES,
);
const adminCoreInteractionRoutes = new Set<string>(
  PRODUCTION_SCREEN_ADMIN_CORE_INTERACTION_ROUTES,
);
const adminOperationsInteractionRoutes = new Set<string>(
  PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_ROUTES,
);
const adminModerationInteractionRoutes = new Set<string>(
  PRODUCTION_SCREEN_ADMIN_MODERATION_INTERACTION_ROUTES,
);
const profileMessagingInteractionRoutes = new Set<string>(
  PRODUCTION_SCREEN_PROFILE_MESSAGING_INTERACTION_ROUTES,
);
const commerceInteractionRoutes = new Set<string>(
  PRODUCTION_SCREEN_COMMERCE_INTERACTION_ROUTES,
);
const memberSupportInteractionRoutes = new Set<string>(
  PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_ROUTES,
);
const publicNavigationInteractionRoutes = new Set<string>(
  PRODUCTION_SCREEN_PUBLIC_NAVIGATION_INTERACTION_ROUTES,
);
const marketplaceInteractionRoutes = new Set<string>(
  PRODUCTION_SCREEN_MARKETPLACE_INTERACTION_ROUTES,
);
const publicPermissionContractByRoute = new Map<
  string,
  (typeof PUBLIC_SCREEN_PERMISSION_CONTRACTS)[number]
>(
  PUBLIC_SCREEN_PERMISSION_CONTRACTS.map(
    (contract) => [contract.route, contract] as const,
  ),
);
const productionStateContractByRoute = new Map<
  string,
  (typeof PRODUCTION_SCREEN_STATE_CONTRACTS)[number]
>(
  PRODUCTION_SCREEN_STATE_CONTRACTS.map(
    (contract) => [contract.route, contract] as const,
  ),
);
const adminAccessStateContractByRoute = new Map<
  string,
  (typeof PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_CONTRACTS)[number]
>(
  PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_CONTRACTS.map(
    (contract) => [contract.route, contract] as const,
  ),
);
const messagingPermissionContractByRoute = new Map<
  string,
  (typeof PRODUCTION_SCREEN_MESSAGING_PERMISSION_CONTRACTS)[number]
>(
  PRODUCTION_SCREEN_MESSAGING_PERMISSION_CONTRACTS.map(
    (contract) => [contract.route, contract] as const,
  ),
);
const messagingStateContractByRoute = new Map<
  string,
  (typeof PRODUCTION_SCREEN_MESSAGING_STATE_CONTRACTS)[number]
>(
  PRODUCTION_SCREEN_MESSAGING_STATE_CONTRACTS.map(
    (contract) => [contract.route, contract] as const,
  ),
);
const memberPermissionContractByRoute = new Map<
  string,
  (typeof PRODUCTION_SCREEN_MEMBER_PERMISSION_CONTRACTS)[number]
>(
  PRODUCTION_SCREEN_MEMBER_PERMISSION_CONTRACTS.map(
    (contract) => [contract.route, contract] as const,
  ),
);
const memberStateContractByRoute = new Map<
  string,
  (typeof PRODUCTION_SCREEN_MEMBER_STATE_CONTRACTS)[number]
>(
  PRODUCTION_SCREEN_MEMBER_STATE_CONTRACTS.map(
    (contract) => [contract.route, contract] as const,
  ),
);

export function productionScreenCoverage({
  screenId,
  route,
  concreteRoute,
  sourcePath,
  routeAuditPassed,
}: {
  screenId: string;
  route: string;
  concreteRoute: string;
  sourcePath: string;
  routeAuditPassed: boolean;
}) {
  const interactionContract =
    PRODUCTION_SCREEN_INTERACTION_CONTRACTS[
      route as keyof typeof PRODUCTION_SCREEN_INTERACTION_CONTRACTS
    ];
  const onboardingRedirectExclusion =
    PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS[
      route as keyof typeof PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS
    ];
  const adminOnboardingTour = getAdminOnboardingRouteTour(route);
  const accountOnboardingTour = getAccountOnboardingRouteTour(route);
  const racingOnboardingTour = getRacingOnboardingRouteTour(route);
  const communityOnboardingTour = getCommunityOnboardingRouteTour(route);
  const publicOnboardingTour = getPublicOnboardingRouteTour(route);
  const marketplaceOnboardingTour = getMarketplaceOnboardingRouteTour(route);
  const agentsOnboardingTour = getAgentsOnboardingRouteTour(route);
  const designLabOnboardingTour = getDesignLabOnboardingRouteTour(route);
  const adminAccessStateContract = adminAccessStateContractByRoute.get(route);
  const messagingPermissionContract =
    messagingPermissionContractByRoute.get(route);
  const messagingStateContract = messagingStateContractByRoute.get(route);
  const memberPermissionContract = memberPermissionContractByRoute.get(route);
  const memberStateContract = memberStateContractByRoute.get(route);
  const permissionContract =
    publicPermissionContractByRoute.get(route) ??
    messagingPermissionContract ??
    adminAccessStateContract ??
    memberPermissionContract;
  const stateContract =
    productionStateContractByRoute.get(route) ??
    messagingStateContract ??
    adminAccessStateContract ??
    memberStateContract;
  const permissionEvidenceTest = messagingPermissionContract
    ? PRODUCTION_SCREEN_MESSAGING_ACCESS_STATE_EVIDENCE_TEST
    : adminAccessStateContract
      ? PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_EVIDENCE_TEST
      : memberPermissionContract
        ? PRODUCTION_SCREEN_MEMBER_ACCESS_STATE_EVIDENCE_TEST
      : SCREEN_PERMISSION_EVIDENCE_TEST;
  const stateEvidenceTest = messagingStateContract
    ? PRODUCTION_SCREEN_MESSAGING_ACCESS_STATE_EVIDENCE_TEST
    : adminAccessStateContract
      ? PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_EVIDENCE_TEST
      : memberStateContract
        ? PRODUCTION_SCREEN_MEMBER_ACCESS_STATE_EVIDENCE_TEST
      : SCREEN_STATE_EVIDENCE_TEST;
  const baseTestEvidence = {
    kind: "test",
    path: TEST_PATH,
    testId: TEST_ID,
  } as const;
  const interactionTestEvidence = accountInteractionRoutes.has(route)
    ? ({
        kind: "test",
        path: PRODUCTION_SCREEN_ACCOUNT_INTERACTION_EVIDENCE_TEST.path,
        testId: PRODUCTION_SCREEN_ACCOUNT_INTERACTION_EVIDENCE_TEST.id,
      } as const)
    : communityInteractionRoutes.has(route)
      ? ({
          kind: "test",
          path: PRODUCTION_SCREEN_COMMUNITY_INTERACTION_EVIDENCE_TEST.path,
          testId: PRODUCTION_SCREEN_COMMUNITY_INTERACTION_EVIDENCE_TEST.id,
        } as const)
      : publicRacingInteractionRoutes.has(route)
        ? ({
            kind: "test",
            path: PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_EVIDENCE_TEST.path,
            testId:
              PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_EVIDENCE_TEST.id,
          } as const)
        : adminCoreInteractionRoutes.has(route)
          ? ({
              kind: "test",
              path: PRODUCTION_SCREEN_ADMIN_CORE_INTERACTION_EVIDENCE_TEST.path,
              testId: PRODUCTION_SCREEN_ADMIN_CORE_INTERACTION_EVIDENCE_TEST.id,
            } as const)
          : adminOperationsInteractionRoutes.has(route)
            ? ({
                kind: "test",
                path: PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_EVIDENCE_TEST.path,
                testId:
                  PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_EVIDENCE_TEST.id,
              } as const)
            : adminModerationInteractionRoutes.has(route)
              ? ({
                  kind: "test",
                  path: PRODUCTION_SCREEN_ADMIN_MODERATION_INTERACTION_EVIDENCE_TEST.path,
                  testId:
                    PRODUCTION_SCREEN_ADMIN_MODERATION_INTERACTION_EVIDENCE_TEST.id,
                } as const)
              : profileMessagingInteractionRoutes.has(route)
                ? ({
                    kind: "test",
                    path: PRODUCTION_SCREEN_PROFILE_MESSAGING_INTERACTION_EVIDENCE_TEST.path,
                    testId:
                      PRODUCTION_SCREEN_PROFILE_MESSAGING_INTERACTION_EVIDENCE_TEST.id,
                  } as const)
                : commerceInteractionRoutes.has(route)
                  ? ({
                      kind: "test",
                      path: PRODUCTION_SCREEN_COMMERCE_INTERACTION_EVIDENCE_TEST.path,
                      testId:
                        PRODUCTION_SCREEN_COMMERCE_INTERACTION_EVIDENCE_TEST.id,
                    } as const)
                  : memberSupportInteractionRoutes.has(route)
                    ? ({
                        kind: "test",
                        path: PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_EVIDENCE_TEST.path,
                        testId:
                          PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_EVIDENCE_TEST.id,
                      } as const)
                    : publicNavigationInteractionRoutes.has(route)
                      ? ({
                          kind: "test",
                          path: PRODUCTION_SCREEN_PUBLIC_NAVIGATION_INTERACTION_EVIDENCE_TEST.path,
                          testId:
                            PRODUCTION_SCREEN_PUBLIC_NAVIGATION_INTERACTION_EVIDENCE_TEST.id,
                        } as const)
                      : marketplaceInteractionRoutes.has(route)
                        ? ({
                            kind: "test",
                            path: PRODUCTION_SCREEN_MARKETPLACE_INTERACTION_EVIDENCE_TEST.path,
                            testId:
                              PRODUCTION_SCREEN_MARKETPLACE_INTERACTION_EVIDENCE_TEST.id,
                          } as const)
                        : baseTestEvidence;
  const sourceEvidence = { kind: "source", path: sourcePath } as const;
  const routeEvidence = {
    kind: "route-audit",
    path: ROUTE_AUDIT_PATH,
    route,
  } as const;
  const forms: CoverageClaim | undefined = formExclusionRoutes.has(route)
    ? {
        status: "excluded",
        exclusion: {
          kind: "not-applicable",
          owner: "Product Engineering",
          rationale:
            "The recursive page import closure contains no form submission primitive.",
        },
        evidence: [sourceEvidence, interactionTestEvidence],
      }
    : interactionContract
      ? {
          status: "verified",
          evidence: [sourceEvidence, interactionTestEvidence],
        }
      : undefined;
  const actions: CoverageClaim | undefined = actionExclusionRoutes.has(route)
    ? {
        status: "excluded",
        exclusion: {
          kind: "not-applicable",
          owner: "Product Engineering",
          rationale:
            "The recursive page import closure contains no page-owned user-action primitive.",
        },
        evidence: [sourceEvidence, interactionTestEvidence],
      }
    : interactionContract
      ? {
          status: "verified",
          evidence: [sourceEvidence, interactionTestEvidence],
        }
      : undefined;
  const permissions: CoverageClaim | undefined = permissionContract
    ? {
        status: "tested",
        evidence: [
          sourceEvidence,
          {
            kind: "test",
            path: permissionEvidenceTest.path,
            testId: permissionEvidenceTest.id,
          },
        ],
      }
    : undefined;
  const states: CoverageClaim | undefined = stateContract
    ? {
        status: "verified",
        evidence: [
          sourceEvidence,
          {
            kind: "test",
            path: stateEvidenceTest.path,
            testId: stateEvidenceTest.id,
          },
        ],
      }
    : undefined;
  const stateInventory =
    stateContract?.states.map((state) => ({
      id: state.id,
      testIds: state.testIds,
      ...(state.recoveryActionId
        ? { recoveryActionId: state.recoveryActionId }
        : {}),
    })) ?? [];
  const designLab: CoverageClaim = routeAuditPassed
    ? {
        status: "tested",
        evidence: [sourceEvidence, baseTestEvidence, routeEvidence],
      }
    : {
        status: "captured",
        evidence: [sourceEvidence, baseTestEvidence, routeEvidence],
      };
  const onboarding: CoverageClaim | undefined = onboardingRedirectExclusion
    ? {
        status: "excluded",
        exclusion: {
          kind: "not-applicable",
          owner: "Product Engineering",
          rationale: `Next.js permanently redirects this legacy route through ${onboardingRedirectExclusion.redirectSource} to ${onboardingRedirectExclusion.redirectDestination}; the canonical destination owns onboarding.`,
        },
        evidence: [
          { kind: "source", path: NEXT_CONFIG_PATH },
          {
            kind: "test",
            path: PRODUCTION_SCREEN_ONBOARDING_EVIDENCE_TEST.path,
            testId: PRODUCTION_SCREEN_ONBOARDING_EVIDENCE_TEST.id,
          },
        ],
      }
    : adminOnboardingTour
      ? {
          status: "tested",
          evidence: [
            {
              kind: "source",
              path: "src/components/onboarding-tour-registry.ts",
            },
            {
              kind: "source",
              path: "src/components/interactive-help.tsx",
            },
            {
              kind: "test",
              path: PRODUCTION_SCREEN_ADMIN_ONBOARDING_EVIDENCE_TEST.path,
              testId: PRODUCTION_SCREEN_ADMIN_ONBOARDING_EVIDENCE_TEST.id,
            },
          ],
        }
      : accountOnboardingTour
        ? {
            status: "tested",
            evidence: [
              {
                kind: "source",
                path: "src/components/onboarding-tour-registry.ts",
              },
              {
                kind: "source",
                path: "src/components/interactive-help.tsx",
              },
              { kind: "source", path: "src/app/account/layout.tsx" },
              { kind: "source", path: "src/components/site-header.tsx" },
              {
                kind: "test",
                path: PRODUCTION_SCREEN_ACCOUNT_ONBOARDING_EVIDENCE_TEST.path,
                testId: PRODUCTION_SCREEN_ACCOUNT_ONBOARDING_EVIDENCE_TEST.id,
              },
            ],
          }
        : racingOnboardingTour
          ? {
              status: "tested",
              evidence: [
                {
                  kind: "source",
                  path: "src/components/racing-onboarding-tour-registry.ts",
                },
                {
                  kind: "source",
                  path: "src/components/interactive-help.tsx",
                },
                { kind: "source", path: "src/app/layout.tsx" },
                { kind: "source", path: "src/components/site-header.tsx" },
                {
                  kind: "test",
                  path: PRODUCTION_SCREEN_RACING_ONBOARDING_EVIDENCE_TEST.path,
                  testId: PRODUCTION_SCREEN_RACING_ONBOARDING_EVIDENCE_TEST.id,
                },
              ],
            }
          : communityOnboardingTour
            ? {
                status: "tested",
                evidence: [
                  {
                    kind: "source",
                    path: "src/components/community-onboarding-tour-registry.ts",
                  },
                  {
                    kind: "source",
                    path: "src/components/interactive-help.tsx",
                  },
                  { kind: "source", path: "src/app/layout.tsx" },
                  { kind: "source", path: "src/components/site-header.tsx" },
                  {
                    kind: "test",
                    path: PRODUCTION_SCREEN_COMMUNITY_ONBOARDING_EVIDENCE_TEST.path,
                    testId:
                      PRODUCTION_SCREEN_COMMUNITY_ONBOARDING_EVIDENCE_TEST.id,
                  },
                ],
              }
            : publicOnboardingTour
              ? {
                  status: "tested",
                  evidence: [
                    {
                      kind: "source",
                      path: "src/components/public-onboarding-tour-registry.ts",
                    },
                    {
                      kind: "source",
                      path: "src/components/interactive-help.tsx",
                    },
                    { kind: "source", path: "src/app/layout.tsx" },
                    { kind: "source", path: "src/components/site-header.tsx" },
                    {
                      kind: "test",
                      path: PRODUCTION_SCREEN_PUBLIC_ONBOARDING_EVIDENCE_TEST.path,
                      testId: PRODUCTION_SCREEN_PUBLIC_ONBOARDING_EVIDENCE_TEST.id,
                    },
                  ],
                }
              : marketplaceOnboardingTour
                ? {
                    status: "tested",
                    evidence: [
                      {
                        kind: "source",
                        path: "src/components/marketplace-onboarding-tour-registry.ts",
                      },
                      {
                        kind: "source",
                        path: "src/components/interactive-help.tsx",
                      },
                      { kind: "source", path: "src/app/layout.tsx" },
                      {
                        kind: "source",
                        path: "src/components/site-header.tsx",
                      },
                      {
                        kind: "test",
                        path: PRODUCTION_SCREEN_MARKETPLACE_ONBOARDING_EVIDENCE_TEST.path,
                        testId:
                          PRODUCTION_SCREEN_MARKETPLACE_ONBOARDING_EVIDENCE_TEST.id,
                      },
                    ],
                  }
                : agentsOnboardingTour
                  ? {
                      status: "tested",
                      evidence: [
                        {
                          kind: "source",
                          path: "src/components/agents-onboarding-tour-registry.ts",
                        },
                        {
                          kind: "source",
                          path: "src/components/interactive-help.tsx",
                        },
                        { kind: "source", path: "src/app/layout.tsx" },
                        {
                          kind: "source",
                          path: "src/components/site-header.tsx",
                        },
                        {
                          kind: "test",
                          path: PRODUCTION_SCREEN_AGENTS_ONBOARDING_EVIDENCE_TEST.path,
                          testId:
                            PRODUCTION_SCREEN_AGENTS_ONBOARDING_EVIDENCE_TEST.id,
                        },
                      ],
                    }
                  : designLabOnboardingTour
                    ? {
                        status: "tested",
                        evidence: [
                          {
                            kind: "source",
                            path: "src/components/design-lab-onboarding-tour-registry.ts",
                          },
                          {
                            kind: "source",
                            path: "src/components/interactive-help.tsx",
                          },
                          { kind: "source", path: "src/app/layout.tsx" },
                          {
                            kind: "source",
                            path: "src/components/site-header.tsx",
                          },
                          {
                            kind: "test",
                            path:
                              PRODUCTION_SCREEN_DESIGN_LAB_ONBOARDING_EVIDENCE_TEST.path,
                            testId:
                              PRODUCTION_SCREEN_DESIGN_LAB_ONBOARDING_EVIDENCE_TEST.id,
                          },
                        ],
                      }
                    : undefined;

  return {
    actions,
    forms,
    queryParameters: interactionContract?.queryParameters ?? [],
    actionInventory: interactionContract?.actions ?? [],
    formInventory: interactionContract?.forms ?? [],
    permissionInventory: permissionContract?.permissions ?? [],
    stateInventory,
    permissions,
    states,
    designLab,
    onboarding,
    onboardingTourId:
      adminOnboardingTour?.tourId ??
      accountOnboardingTour?.tourId ??
      racingOnboardingTour?.tourId ??
      communityOnboardingTour?.tourId ??
      publicOnboardingTour?.tourId ??
      marketplaceOnboardingTour?.tourId ??
      agentsOnboardingTour?.tourId ??
      designLabOnboardingTour?.tourId,
    fixture: {
      fixtureId: `DL.DEFAULT:${route}`,
      screenId,
      route: concreteRoute,
    },
  } as const;
}
