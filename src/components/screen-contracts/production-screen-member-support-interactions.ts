import type { FamilyScreenManifest } from "./types";

export const PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_EVIDENCE_TEST = {
  id: "PRODUCTION-SCREEN-MEMBER-SUPPORT-INTERACTIONS",
  path: "src/components/screen-contracts/production-screen-member-support-interactions.test.ts",
} as const;

const TEST_IDS = [
  PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_EVIDENCE_TEST.id,
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

export const PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_ROUTES = [
  "/forum",
  "/forum/[slug]",
  "/forum/threads/[id]",
  "/agents",
  "/contact",
  "/account/usage",
  "/account/team",
] as const;

export const PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_CONTRACTS = {
  "/forum": {
    queryParameters: [],
    actions: [
      action(
        "GROUPS.ACTION.GROUP.OPEN",
        "Opens a selected public group.",
        "Group destinations use slugs returned by the public group query and the registered dynamic route owns the destination.",
      ),
      action(
        "GROUPS.ACTION.THREAD.OPEN",
        "Opens a selected public group thread.",
        "Thread destinations use identifiers returned by public overview or recent-thread queries.",
      ),
      action(
        "GROUPS.ACTION.THREAD-CREATE.OPEN",
        "Opens the first available group where a member can start a thread.",
        "The destination uses a loaded category slug; the group page and server action independently enforce availability and identity.",
      ),
      action(
        "GROUPS.ACTION.MARKETPLACE.OPEN",
        "Opens the marketplace directory from the community header.",
        "The fixed same-origin Link targets /marketplace.",
      ),
    ],
    forms: [],
  },
  "/forum/[slug]": {
    queryParameters: [],
    actions: [
      action(
        "GROUP.ACTION.THREAD.CREATE",
        "Creates a validated thread in the loaded group and opens it.",
        "createForumThread requires the current profile and paid access, parses forumThreadSchema, verifies the loaded category, and writes through the request context.",
      ),
      action(
        "GROUP.ACTION.THREAD.OPEN",
        "Opens a selected thread in the current group.",
        "Thread destinations use identifiers returned with the loaded public category.",
      ),
      action(
        "GROUP.ACTION.GROUPS.OPEN",
        "Returns to the groups directory.",
        "The fixed same-origin Link targets /groups.",
      ),
      action(
        "GROUP.ACTION.SIGN-IN.OPEN",
        "Opens sign-in for a visitor who wants to start a thread.",
        "The signed-out branch renders a fixed same-origin anchor to /sign-in; the server action independently requires the current profile.",
      ),
    ],
    forms: [
      form(
        "GROUP.FORM.THREAD-CREATE",
        "SERVER ACTION createForumThread",
        "categoryId:loaded-group-id,title:trimmed-string(5..200),body:trimmed-string(20..20000)",
      ),
    ],
  },
  "/forum/threads/[id]": {
    queryParameters: [],
    actions: [
      action(
        "GROUP-THREAD.ACTION.REPLY",
        "Adds a validated reply to the loaded unlocked thread.",
        "replyToForumThread requires the current profile and paid access, parses forumReplySchema, and rechecks that the server-bound thread exists and is unlocked.",
      ),
      action(
        "GROUP-THREAD.ACTION.GROUP.OPEN",
        "Returns to the thread's owning group.",
        "The destination uses the category slug returned with the loaded thread.",
      ),
      action(
        "GROUP-THREAD.ACTION.SIGN-IN.OPEN",
        "Opens sign-in for a visitor who wants to reply.",
        "The signed-out unlocked branch renders a fixed same-origin anchor to /sign-in; the server action independently requires the current profile.",
      ),
    ],
    forms: [
      form(
        "GROUP-THREAD.FORM.REPLY",
        "SERVER ACTION replyToForumThread",
        "threadId:server-bound-unlocked-thread-id,body:trimmed-string(20..20000)",
      ),
    ],
  },
  "/agents": {
    queryParameters: [],
    actions: [
      action(
        "AGENTS.ACTION.PLAN.OPEN",
        "Opens pricing information for supported AI agent access.",
        "The fixed same-origin Link targets /pricing; the run path independently enforces the current member and agent-specific tier.",
      ),
      action(
        "AGENTS.ACTION.STATISTICS.OPEN",
        "Opens the racing statistics workspace.",
        "The fixed same-origin Link targets the registered /statistics route.",
      ),
      action(
        "AGENTS.ACTION.RUN",
        "Creates and records a supported AI agent run for the current member.",
        "createAgentRun requires the current profile, validates the bounded request, allowlists the agent type, and delegates emergency-control, tier, usage, and audit enforcement to runAgentForCurrentUser.",
      ),
    ],
    forms: [
      form(
        "AGENTS.FORM.RUN",
        "SERVER ACTION createAgentRun",
        "agentType:race_analyst|breeding_advisor|form_reader,input:trimmed-string(10..5000)",
      ),
    ],
  },
  "/contact": {
    queryParameters: ["ticket"],
    actions: [
      action(
        "CONTACT.ACTION.TICKET.CREATE",
        "Creates an account-scoped support ticket and initial message.",
        "createSupportTicket requires the current profile, applies a per-user rate limit, validates the allowlisted category and bounded body, and writes the ticket and message through the request context.",
      ),
      action(
        "CONTACT.ACTION.SIGN-IN.OPEN",
        "Opens sign-in for a visitor who wants to create a support ticket.",
        "The signed-out branch renders a fixed same-origin anchor to /sign-in; ticket creation independently requires the current profile.",
      ),
    ],
    forms: [
      form(
        "CONTACT.FORM.TICKET",
        "SERVER ACTION createSupportTicket",
        "category:general|billing|technical|feedback,body:trimmed-string(20..5000)",
      ),
    ],
  },
  "/account/usage": {
    queryParameters: [],
    actions: [
      action(
        "ACCOUNT-USAGE.ACTION.ACCOUNT.OPEN",
        "Returns to the account overview.",
        "The signed-in header and signed-out boundary use fixed same-origin Links to /account.",
      ),
      action(
        "ACCOUNT-USAGE.ACTION.PLAN.OPEN",
        "Opens plan information for the member's usage limits.",
        "The signed-in and signed-out branches use fixed same-origin Links to /pricing; usage reads remain scoped to the current account.",
      ),
      action(
        "ACCOUNT-USAGE.ACTION.SIGN-IN.OPEN",
        "Opens sign-in for a visitor who wants to view account usage.",
        "The signed-out branch renders a fixed same-origin anchor to /sign-in.",
      ),
    ],
    forms: [],
  },
  "/account/team": {
    queryParameters: [
      "invitation?:single-base64url-token",
      "team?:allowlisted-mutation-result",
    ],
    actions: [
      action(
        "ACCOUNT-TEAM.ACTION.ACCOUNT.OPEN",
        "Returns to the account overview.",
        "The fixed same-origin Link targets /account after the page requires the current profile and scopes all organization reads to active membership or ownership.",
      ),
      action(
        "ACCOUNT-TEAM.ACTION.INVITATION.COPY",
        "Copies the newly created one-time invitation URL for delivery to the intended account.",
        "The client builds the URL from window.location.origin plus the server-returned same-origin path; the raw token is returned only to the authorized creator and is not stored in the database or audit metadata.",
      ),
    ],
    forms: [
      form(
        "ACCOUNT-TEAM.FORM.INVITATION.CREATE",
        "SERVER ACTION createTeamInvitationAction",
        "organizationId:id(10..80),email:normalized-email<=254,role:member|admin",
      ),
      form(
        "ACCOUNT-TEAM.FORM.INVITATION.ACCEPT",
        "SERVER ACTION decideTeamInvitationAction",
        "token:base64url(43),decision:accept",
      ),
      form(
        "ACCOUNT-TEAM.FORM.INVITATION.REJECT",
        "SERVER ACTION decideTeamInvitationAction",
        "token:base64url(43),decision:reject",
      ),
      form(
        "ACCOUNT-TEAM.FORM.LEAVE",
        "SERVER ACTION leaveTeamAction",
        "organizationId:id(10..80),confirmation:LEAVE",
      ),
      form(
        "ACCOUNT-TEAM.FORM.MEMBER.ROLE",
        "SERVER ACTION changeTeamMemberRoleAction",
        "organizationId:id(10..80),targetUserId:id(10..80),role:member|admin,confirmation:CHANGE_ROLE",
      ),
      form(
        "ACCOUNT-TEAM.FORM.OWNER.TRANSFER",
        "SERVER ACTION changeTeamMemberRoleAction",
        "organizationId:id(10..80),targetUserId:id(10..80),role:owner,confirmation:TRANSFER",
      ),
      form(
        "ACCOUNT-TEAM.FORM.MEMBER.REMOVE",
        "SERVER ACTION removeTeamMemberAction",
        "organizationId:id(10..80),targetUserId:id(10..80),confirmation:REMOVE",
      ),
    ],
  },
} as const satisfies Readonly<Record<string, InteractionContract>>;
