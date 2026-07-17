import type { FamilyScreenManifest } from "./types";

export const PRODUCTION_SCREEN_ADMIN_MODERATION_INTERACTION_EVIDENCE_TEST = {
  id: "PRODUCTION-SCREEN-ADMIN-MODERATION-INTERACTIONS",
  path: "src/components/screen-contracts/production-screen-admin-moderation-interactions.test.ts",
} as const;

const TEST_IDS = [
  PRODUCTION_SCREEN_ADMIN_MODERATION_INTERACTION_EVIDENCE_TEST.id,
] as const;

type InteractionContract = {
  queryParameters: readonly string[];
  actions: FamilyScreenManifest["actions"];
  forms: FamilyScreenManifest["forms"];
};

type InteractionAction = FamilyScreenManifest["actions"][number];
type InteractionForm = FamilyScreenManifest["forms"][number];

function action(
  id: string,
  result: string,
  enforcement: string,
): InteractionAction {
  return { id, result, enforcement, testIds: TEST_IDS };
}

function form(id: string, submitsTo: string, schema: string): InteractionForm {
  return { id, submitsTo, schema, testIds: TEST_IDS };
}

export const PRODUCTION_SCREEN_ADMIN_MODERATION_INTERACTION_ROUTES = [
  "/admin/feed",
  "/admin/safety",
  "/admin/listings",
  "/admin/reports",
] as const;

export const PRODUCTION_SCREEN_ADMIN_MODERATION_INTERACTION_CONTRACTS = {
  "/admin/feed": {
    queryParameters: [],
    actions: [
      action(
        "ADMIN-FEED.ACTION.TOPIC.CREATE",
        "Creates an active feed topic and returns to the feed moderation queue.",
        "createFeedTopic requires a moderator profile, parses the bounded topic schema, then the moderator service rechecks the role, writes through the request context, records an admin audit event, and broadcasts a topic update.",
      ),
      action(
        "ADMIN-FEED.ACTION.TOPIC.ACTIVE.SET",
        "Activates or deactivates a loaded feed topic.",
        "The form binds the loaded topic identifier and inverse active value on the server; setFeedTopicActive requires a moderator profile, and the service rechecks the role before its request-context update, audit event, and realtime broadcast.",
      ),
      action(
        "ADMIN-FEED.ACTION.POST.MODERATE",
        "Pins, unpins, hides, removes, or restores a loaded feed post.",
        "moderateFeedPost requires a moderator profile and parses the fixed action enum plus an optional 500-character reason; the service rechecks the role, updates through the request context, audits the decision, and broadcasts public-post changes.",
      ),
    ],
    forms: [
      form(
        "ADMIN-FEED.FORM.TOPIC-CREATE",
        "SERVER ACTION createFeedTopic",
        "name:string(min2,max80),slug?:string(max80),rules?:string(max2000),sortOrder:integer(min0,max9999,default0)",
      ),
      form(
        "ADMIN-FEED.FORM.TOPIC-ACTIVE",
        "SERVER ACTION setFeedTopicActive",
        "topicId:loaded-topic-id,active:server-bound-boolean",
      ),
      form(
        "ADMIN-FEED.FORM.POST-MODERATION",
        "SERVER ACTION moderateFeedPost",
        "postId:loaded-post-id,action:pin|unpin|hide|remove|restore,reason?:string(max500)",
      ),
    ],
  },
  "/admin/safety": {
    queryParameters: [],
    actions: [
      action(
        "ADMIN-SAFETY.ACTION.PHRASE.CREATE",
        "Creates or reactivates a banned-phrase rule for the selected content surface.",
        "createBannedPhrase requires a moderator profile and parses the bounded phrase, target, action, and reason schema before a request-context upsert and admin audit event.",
      ),
      action(
        "ADMIN-SAFETY.ACTION.PHRASE.ACTIVE.SET",
        "Activates or deactivates a loaded banned-phrase rule.",
        "The form binds the loaded phrase identifier and inverse active value on the server; setBannedPhraseActive requires a moderator profile before the request-context update and admin audit event.",
      ),
      action(
        "ADMIN-SAFETY.ACTION.FLAG.RESOLVE",
        "Marks a loaded open trust-and-safety flag as resolved.",
        "The form binds the loaded flag identifier on the server; resolveTrustSafetyFlag requires a moderator profile, then stores the resolver and timestamp through the request context and records an admin audit event.",
      ),
    ],
    forms: [
      form(
        "ADMIN-SAFETY.FORM.PHRASE-CREATE",
        "SERVER ACTION createBannedPhrase",
        "phrase:string(min2,max120),target:all|listing|feed|message,action:review|block,reason?:string(max500)",
      ),
      form(
        "ADMIN-SAFETY.FORM.PHRASE-ACTIVE",
        "SERVER ACTION setBannedPhraseActive",
        "phraseId:loaded-phrase-id,active:server-bound-boolean",
      ),
      form(
        "ADMIN-SAFETY.FORM.FLAG-RESOLUTION",
        "SERVER ACTION resolveTrustSafetyFlag",
        "flagId:loaded-open-flag-id",
      ),
    ],
  },
  "/admin/listings": {
    queryParameters: [],
    actions: [
      action(
        "ADMIN-LISTINGS.ACTION.LISTING.OPEN",
        "Opens the public detail route for a loaded marketplace listing.",
        "The listing identifier comes from the moderator-loaded queue, and the Link builds only the fixed same-origin /marketplace/[id] destination.",
      ),
      action(
        "ADMIN-LISTINGS.ACTION.CATEGORY.CREATE",
        "Creates an active marketplace category and returns to the moderation queue.",
        "createMarketplaceCategory requires a moderator profile and parses the bounded category schema; the service rechecks the role, writes through the request context, and records an admin audit event.",
      ),
      action(
        "ADMIN-LISTINGS.ACTION.CATEGORY.ACTIVE.SET",
        "Activates or deactivates a loaded marketplace category.",
        "The form binds the loaded category identifier and inverse active value on the server; the action requires a moderator profile, and the service rechecks the role before its request-context update and audit event.",
      ),
      action(
        "ADMIN-LISTINGS.ACTION.LISTING.APPROVE",
        "Approves a loaded pending listing and makes it active.",
        "The form binds the loaded listing identifier on the server; both action and service enforce moderator access, while the service verifies the record, writes status history through the request context, and records moderation audit evidence.",
      ),
      action(
        "ADMIN-LISTINGS.ACTION.LISTING.REJECT",
        "Rejects a loaded pending listing with the supplied moderation reason.",
        "The form binds the loaded listing identifier on the server; both action and service enforce moderator access, the action cleans the reason or supplies its fixed fallback, and the service verifies the record, writes status history, and records moderation audit evidence.",
      ),
      action(
        "ADMIN-LISTINGS.ACTION.LISTING.REMOVE",
        "Removes a loaded active listing with the supplied moderation reason.",
        "The form binds the loaded listing identifier on the server; both action and service enforce moderator access, the action cleans the reason or supplies its fixed fallback, and the service verifies the record, archives it with status history, and records moderation audit evidence.",
      ),
    ],
    forms: [
      form(
        "ADMIN-LISTINGS.FORM.CATEGORY-CREATE",
        "SERVER ACTION createMarketplaceCategory",
        "name:string(min2,max80),slug?:string(max80),description?:string(max500),sortOrder:integer(min0,max9999,default0)",
      ),
      form(
        "ADMIN-LISTINGS.FORM.CATEGORY-ACTIVE",
        "SERVER ACTION setMarketplaceCategoryActive",
        "categoryId:loaded-category-id,active:server-bound-boolean",
      ),
      form(
        "ADMIN-LISTINGS.FORM.APPROVE",
        "SERVER ACTION approveListing",
        "listingId:loaded-pending-listing-id",
      ),
      form(
        "ADMIN-LISTINGS.FORM.REJECT",
        "SERVER ACTION rejectListing",
        "listingId:loaded-pending-listing-id,reason:string(ui-min3,ui-max500;server-cleaned-or-fixed-fallback)",
      ),
      form(
        "ADMIN-LISTINGS.FORM.REMOVE",
        "SERVER ACTION removeListing",
        "listingId:loaded-active-listing-id,reason:string(ui-min3,ui-max500;server-cleaned-or-fixed-fallback)",
      ),
    ],
  },
  "/admin/reports": {
    queryParameters: [],
    actions: [
      action(
        "ADMIN-REPORTS.ACTION.REPORT.RESOLVE",
        "Resolves or dismisses a loaded report with the selected moderation outcome.",
        "resolveReport binds the loaded report identifier, requires a moderator profile, applies a per-moderator 30-per-minute limit, and parses the allowlisted outcome plus bounded notes; the service writes through the request context, protects admin-ban operations, and records an admin audit event.",
      ),
    ],
    forms: [
      form(
        "ADMIN-REPORTS.FORM.RESOLUTION",
        "SERVER ACTION resolveReport",
        "reportId:loaded-report-id,action:dismiss|hide_content|warn_user|ban_user|delete_content,notes?:string(max1000)",
      ),
    ],
  },
} as const satisfies Readonly<Record<string, InteractionContract>>;
