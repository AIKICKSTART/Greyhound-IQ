export type TraceIdentifierExampleBinding = {
  requirementId: string;
  traceId: string;
  action: string;
  sourceAnchors: readonly {
    file: string;
    symbol: string;
    needle: string;
  }[];
};

/**
 * Canonical identifiers for implemented product actions requested by the
 * security master. These bindings prove stable identifier assignment only;
 * the richer end-to-end SecurityTraceContract gates remain independent.
 */
export const TRACE_IDENTIFIER_EXAMPLE_BINDINGS = [
  {
    requirementId:
      "security.trace-identifier-example.public-home-start-sign-in",
    traceId: "PUBLIC.HOME.START_SIGN_IN",
    action: "Start sign-in from the public site header",
    sourceAnchors: [
      {
        file: "src/components/site-header.tsx",
        symbol: "SiteHeader",
        needle: 'href="/sign-in"',
      },
      {
        file: "src/app/sign-in/route.ts",
        symbol: "GET",
        needle: "export const GET = async",
      },
    ],
  },
  {
    requirementId: "security.trace-identifier-example.racing-open-dog",
    traceId: "RACING.RACE_DETAIL.OPEN_DOG",
    action: "Open a dog from race detail",
    sourceAnchors: [
      {
        file: "src/app/races/[id]/page.tsx",
        symbol: "RacePage",
        needle: "href={`/dogs/${winner.dog.id}`}",
      },
    ],
  },
  {
    requirementId: "security.trace-identifier-example.community-create-post",
    traceId: "COMMUNITY.FEED.CREATE_POST",
    action: "Create a community Feed post",
    sourceAnchors: [
      {
        file: "src/app/actions.ts",
        symbol: "createFeedPost",
        needle: "export async function createFeedPost",
      },
    ],
  },
  {
    requirementId: "security.trace-identifier-example.community-add-comment",
    traceId: "COMMUNITY.POST.ADD_COMMENT",
    action: "Add a comment to a community post",
    sourceAnchors: [
      {
        file: "src/app/actions.ts",
        symbol: "replyToFeedPost",
        needle: "export async function replyToFeedPost",
      },
    ],
  },
  {
    requirementId: "security.trace-identifier-example.pulse-send-message",
    traceId: "PULSE.THREAD.SEND_MESSAGE",
    action: "Send a message in a Pulse conversation thread",
    sourceAnchors: [
      {
        file: "src/app/actions.ts",
        symbol: "sendMessage",
        needle: "export async function sendMessage",
      },
    ],
  },
  {
    requirementId: "security.trace-identifier-example.marketplace-save",
    traceId: "MARKETPLACE.LISTING.SAVE",
    action: "Save a marketplace listing",
    sourceAnchors: [
      {
        file: "src/app/actions.ts",
        symbol: "toggleSavedListing",
        needle: "export async function toggleSavedListing",
      },
    ],
  },
  {
    requirementId: "security.trace-identifier-example.marketplace-create",
    traceId: "MARKETPLACE.LISTING.CREATE",
    action: "Create a marketplace listing",
    sourceAnchors: [
      {
        file: "src/app/actions.ts",
        symbol: "createListing",
        needle: "export async function createListing",
      },
    ],
  },
  {
    requirementId: "security.trace-identifier-example.account-profile-update",
    traceId: "ACCOUNT.PROFILE.UPDATE",
    action: "Update the current account profile",
    sourceAnchors: [
      {
        file: "src/app/actions.ts",
        symbol: "updateProfile",
        needle: "export async function updateProfile",
      },
    ],
  },
  {
    requirementId: "security.trace-identifier-example.account-team-role",
    traceId: "ACCOUNT.TEAM.CHANGE_ROLE",
    action: "Change a member role or transfer organization ownership",
    sourceAnchors: [
      {
        file: "src/app/account/team/actions.ts",
        symbol: "changeTeamMemberRoleAction",
        needle: "export async function changeTeamMemberRoleAction",
      },
      {
        file: "src/lib/organization-team-service.ts",
        symbol: "ACCOUNT_TEAM_CHANGE_ROLE_TRACE_ID",
        needle:
          'export const ACCOUNT_TEAM_CHANGE_ROLE_TRACE_ID = "ACCOUNT.TEAM.CHANGE_ROLE"',
      },
    ],
  },
  {
    requirementId: "security.trace-identifier-example.billing-checkout",
    traceId: "BILLING.CHECKOUT.START",
    action: "Start a Stripe checkout session",
    sourceAnchors: [
      {
        file: "src/app/api/billing/checkout/route.ts",
        symbol: "POST",
        needle: "export async function POST",
      },
    ],
  },
  {
    requirementId: "security.trace-identifier-example.admin-user-status",
    traceId: "ADMIN.USERS.CHANGE_STATUS",
    action: "Change a user's administrative access status",
    sourceAnchors: [
      {
        file: "src/app/admin/mutations.ts",
        symbol: "updateAdminUserAccessAction",
        needle: "export async function updateAdminUserAccessAction",
      },
    ],
  },
  {
    requirementId: "security.trace-identifier-example.ai-start-run",
    traceId: "AI.AGENT.START_RUN",
    action: "Start an AI agent run",
    sourceAnchors: [
      {
        file: "src/app/actions.ts",
        symbol: "createAgentRun",
        needle: "export async function createAgentRun",
      },
    ],
  },
  {
    requirementId: "security.trace-identifier-example.design-lab-simulate",
    traceId: "DESIGN_LAB.SCREEN.SIMULATE_ACTION",
    action: "Simulate a destructive Design Lab action without side effects",
    sourceAnchors: [
      {
        file: "src/components/design-lab-scenario-controls.tsx",
        symbol: "ScenarioControlPanel",
        needle: "data-scenario-simulate-destructive",
      },
    ],
  },
] as const satisfies readonly TraceIdentifierExampleBinding[];

export const OPEN_TRACE_IDENTIFIER_EXAMPLE_GAPS = {} as const;

export const TRACE_IDENTIFIER_EXAMPLE_MASTER_EVIDENCE = Object.fromEntries(
  TRACE_IDENTIFIER_EXAMPLE_BINDINGS.map((binding) => [
    binding.requirementId,
    {
      status: "verified" as const,
      evidence: [
        "security/trace-identifier-example-evidence.ts",
        "security/trace-identifier-example-evidence.test.ts",
        ...new Set(binding.sourceAnchors.map((anchor) => anchor.file)),
      ],
    },
  ]),
);
