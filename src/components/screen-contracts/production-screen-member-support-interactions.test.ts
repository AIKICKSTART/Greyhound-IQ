import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SCREEN_CONTRACT_BY_ROUTE } from "../demo-experience-registry";
import {
  PRODUCTION_SCREEN_ACTION_EXCLUSION_ROUTES,
  PRODUCTION_SCREEN_FORM_EXCLUSION_ROUTES,
  PRODUCTION_SCREEN_INTERACTION_CONTRACTS,
  PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS,
} from "./production-screen-coverage";
import {
  PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_CONTRACTS,
  PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_ROUTES,
} from "./production-screen-member-support-interactions";
import {
  findFormSubmissionSignals,
  findUserActionSignals,
  getLocalSourceClosure,
} from "./screen-contract-source-audit";

// screen-evidence-test-id: PRODUCTION-SCREEN-MEMBER-SUPPORT-INTERACTIONS

const TEST_ID = PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_EVIDENCE_TEST.id;
const TEST_PATH =
  PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_EVIDENCE_TEST.path;
const actionExclusions = new Set<string>(
  PRODUCTION_SCREEN_ACTION_EXCLUSION_ROUTES,
);
const formExclusions = new Set<string>(PRODUCTION_SCREEN_FORM_EXCLUSION_ROUTES);
const onboardingExclusions = new Set(
  Object.keys(PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS),
);

const EXPECTED_MEMBER_SUPPORT_INTERACTIONS = {
  "/forum": {
    authentication: "optional",
    queryParameters: [],
    actionIds: [
      "GROUPS.ACTION.GROUP.OPEN",
      "GROUPS.ACTION.THREAD.OPEN",
      "GROUPS.ACTION.THREAD-CREATE.OPEN",
      "GROUPS.ACTION.MARKETPLACE.OPEN",
    ],
    forms: [],
    onboarding: "excluded",
    canonicalRoute: "/groups",
    sourceAssertions: [
      "getForumOverview()",
      "getRecentThreads(8)",
      "href={`/groups/${category.slug}`}",
      "href={`/groups/threads/${thread.id}`}",
      'href="/marketplace"',
    ],
  },
  "/forum/[slug]": {
    authentication: "optional",
    queryParameters: [],
    actionIds: [
      "GROUP.ACTION.THREAD.CREATE",
      "GROUP.ACTION.THREAD.OPEN",
      "GROUP.ACTION.GROUPS.OPEN",
      "GROUP.ACTION.SIGN-IN.OPEN",
    ],
    forms: [
      ["GROUP.FORM.THREAD-CREATE", "SERVER ACTION createForumThread"],
    ],
    onboarding: "excluded",
    canonicalRoute: "/groups/[slug]",
    sourceAssertions: [
      "getForumCategoryBySlug(slug)",
      "if (!category) notFound();",
      'href="/groups"',
      "href={`/groups/threads/${thread.id}`}",
      "<form action={createForumThread}",
      'name="categoryId"',
      'name="title"',
      'name="body"',
      'href="/sign-in"',
    ],
  },
  "/forum/threads/[id]": {
    authentication: "optional",
    queryParameters: [],
    actionIds: [
      "GROUP-THREAD.ACTION.REPLY",
      "GROUP-THREAD.ACTION.GROUP.OPEN",
      "GROUP-THREAD.ACTION.SIGN-IN.OPEN",
    ],
    forms: [
      ["GROUP-THREAD.FORM.REPLY", "SERVER ACTION replyToForumThread"],
    ],
    onboarding: "excluded",
    canonicalRoute: "/groups/threads/[id]",
    sourceAssertions: [
      "getForumThreadById(id)",
      "if (!thread) notFound();",
      "replyToForumThread.bind(null, thread.id)",
      "href={`/groups/${thread.category.slug}`}",
      "<form action={replyAction}",
      'name="body"',
      'href="/sign-in"',
    ],
  },
  "/agents": {
    authentication: "required",
    queryParameters: [],
    actionIds: [
      "AGENTS.ACTION.PLAN.OPEN",
      "AGENTS.ACTION.STATISTICS.OPEN",
      "AGENTS.ACTION.RUN",
    ],
    forms: [["AGENTS.FORM.RUN", "SERVER ACTION createAgentRun"]],
    onboarding: "tested",
    canonicalRoute: null,
    sourceAssertions: [
      "const user = await getCurrentUser();",
      "getAgentRuns(",
      'href="/pricing"',
      'href="/statistics"',
      '<ProGate minTier="pro" feature="Live agent execution">',
      "action={createAgentRun}",
      'name="agentType"',
      'name="input"',
      "minLength={10}",
      "maxLength={5000}",
    ],
  },
  "/contact": {
    authentication: "public",
    queryParameters: ["ticket"],
    actionIds: [
      "CONTACT.ACTION.TICKET.CREATE",
      "CONTACT.ACTION.SIGN-IN.OPEN",
    ],
    forms: [["CONTACT.FORM.TICKET", "SERVER ACTION createSupportTicket"]],
    onboarding: "tested",
    canonicalRoute: null,
    sourceAssertions: [
      "searchParams: Promise<{ ticket?: string | string[] }>",
      'const ticketCreated = params.ticket === "created";',
      "<form action={createSupportTicket}",
      'name="category"',
      'name="body"',
      "minLength={20}",
      "maxLength={5000}",
      'href="/sign-in"',
    ],
  },
  "/account/usage": {
    authentication: "required",
    queryParameters: [],
    actionIds: [
      "ACCOUNT-USAGE.ACTION.ACCOUNT.OPEN",
      "ACCOUNT-USAGE.ACTION.PLAN.OPEN",
      "ACCOUNT-USAGE.ACTION.SIGN-IN.OPEN",
    ],
    forms: [],
    onboarding: "tested",
    canonicalRoute: null,
    sourceAssertions: [
      "const user = await getCurrentUser();",
      "getEntitlementLimitsForCurrentUser(user)",
      "getUsageEventsForUser(user)",
      "if (!user.dbUserId || !user.profileId) return Promise.resolve([]);",
      "withDbRequestContext(",
      "where: { userId }",
      "take: 10",
      'href="/account"',
      'href="/pricing"',
      'href="/sign-in"',
    ],
  },
  "/account/team": {
    authentication: "required",
    queryParameters: [
      "invitation?:single-base64url-token",
      "team?:allowlisted-mutation-result",
    ],
    actionIds: [
      "ACCOUNT-TEAM.ACTION.ACCOUNT.OPEN",
      "ACCOUNT-TEAM.ACTION.INVITATION.COPY",
    ],
    forms: [
      [
        "ACCOUNT-TEAM.FORM.INVITATION.CREATE",
        "SERVER ACTION createTeamInvitationAction",
      ],
      [
        "ACCOUNT-TEAM.FORM.INVITATION.ACCEPT",
        "SERVER ACTION decideTeamInvitationAction",
      ],
      [
        "ACCOUNT-TEAM.FORM.INVITATION.REJECT",
        "SERVER ACTION decideTeamInvitationAction",
      ],
      ["ACCOUNT-TEAM.FORM.LEAVE", "SERVER ACTION leaveTeamAction"],
      [
        "ACCOUNT-TEAM.FORM.MEMBER.ROLE",
        "SERVER ACTION changeTeamMemberRoleAction",
      ],
      [
        "ACCOUNT-TEAM.FORM.OWNER.TRANSFER",
        "SERVER ACTION changeTeamMemberRoleAction",
      ],
      [
        "ACCOUNT-TEAM.FORM.MEMBER.REMOVE",
        "SERVER ACTION removeTeamMemberAction",
      ],
    ],
    onboarding: "tested",
    canonicalRoute: null,
    sourceAssertions: [
      "const current = await requireTeamProfile(returnTo);",
      "listOrganizationTeams(current)",
      "getOrganizationTeamInvitation(current, invitationToken)",
      "return await requireCurrentUserProfile();",
      "redirect(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);",
      "<TeamInvitationReview",
      "<TeamManagement organizations={organizations} />",
      'href="/account"',
    ],
  },
} as const;

assert.deepEqual(
  PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_ROUTES,
  Object.keys(EXPECTED_MEMBER_SUPPORT_INTERACTIONS),
  "the member-support batch must fail closed on route additions or removals",
);
assert.deepEqual(
  Object.keys(PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_CONTRACTS),
  PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_ROUTES,
  "the owned module may contain only the reviewed member-support routes",
);
assert.equal(PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_ROUTES.length, 7);

let actionInventoryCount = 0;
let structuredFormCount = 0;
let zeroFormExclusionCount = 0;

for (const route of PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_ROUTES) {
  const expected = EXPECTED_MEMBER_SUPPORT_INTERACTIONS[route];
  const ownedInteraction =
    PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_CONTRACTS[route];
  const interaction = Object.entries(PRODUCTION_SCREEN_INTERACTION_CONTRACTS).find(
    ([candidateRoute]) => candidateRoute === route,
  )?.[1];
  const screen = SCREEN_CONTRACT_BY_ROUTE.get(route);
  assert.ok(screen, `${route}: missing production screen contract`);
  assert.equal(screen.productionEnabled, true);
  assert.equal(screen.authentication, expected.authentication);
  assert.equal(
    onboardingExclusions.has(route),
    expected.onboarding === "excluded",
  );
  assert.equal(screen.coverage.onboarding.status, expected.onboarding);
  assert.equal(actionExclusions.has(route), false);
  assert.equal(formExclusions.has(route), expected.forms.length === 0);
  assert.ok(interaction, `${route}: missing central interaction contract`);
  assert.equal(interaction, ownedInteraction);

  assert.deepEqual(interaction.queryParameters, expected.queryParameters);
  assert.deepEqual(
    interaction.actions.map((candidate) => candidate.id),
    expected.actionIds,
  );
  assert.deepEqual(
    interaction.forms.map((candidate) => [candidate.id, candidate.submitsTo]),
    expected.forms,
  );
  assert.deepEqual(screen.queryParameters, [...expected.queryParameters]);
  assert.deepEqual(screen.primaryActions, [...expected.actionIds]);
  assert.deepEqual(
    screen.forms,
    expected.forms.map(([id, submitsTo]) => `${id} -> ${submitsTo}`),
  );

  if (expected.canonicalRoute) {
    const canonicalInteraction = Object.entries(
      PRODUCTION_SCREEN_INTERACTION_CONTRACTS,
    ).find(([candidateRoute]) => candidateRoute === expected.canonicalRoute)?.[1];
    assert.ok(canonicalInteraction, `${route}: missing canonical interaction`);
    assert.deepEqual(
      interaction.queryParameters,
      canonicalInteraction.queryParameters,
    );
    assert.deepEqual(
      interaction.actions.map((candidate) => candidate.id),
      canonicalInteraction.actions.map((candidate) => candidate.id),
    );
    assert.deepEqual(
      interaction.forms.map((candidate) => [candidate.id, candidate.submitsTo]),
      canonicalInteraction.forms.map((candidate) => [
        candidate.id,
        candidate.submitsTo,
      ]),
    );
  }

  const closure = getLocalSourceClosure(screen.sourceFiles[0]);
  const formSignals = [...closure].flatMap(findFormSubmissionSignals);
  const actionSignals = [...closure].flatMap(findUserActionSignals);
  const sourceForms = formSignals.filter((signal) => signal.endsWith(":<form>"));
  assert.equal(
    sourceForms.length,
    expected.forms.length,
    `${route}: every source-owned form must have exactly one manifest entry\n${sourceForms.join("\n")}`,
  );
  assert.ok(
    actionSignals.length > 0,
    `${route}: verified actions require a source-owned interaction signal`,
  );
  if (expected.forms.length === 0) {
    assert.deepEqual(
      formSignals,
      [],
      `${route}: excluded form closure must stay empty`,
    );
    zeroFormExclusionCount += 1;
  }

  assert.equal(screen.coverage.actions.status, "verified");
  assert.equal(
    screen.coverage.forms.status,
    expected.forms.length === 0 ? "excluded" : "verified",
  );
  assert.ok(screen.coverage.actions.evidence.includes(TEST_PATH));
  assert.ok(screen.coverage.forms.evidence.includes(TEST_PATH));
  for (const candidate of interaction.actions) {
    assert.ok(candidate.result.length > 0);
    assert.ok(candidate.enforcement && candidate.enforcement.length > 0);
    assert.deepEqual(candidate.testIds, [TEST_ID]);
  }
  for (const candidate of interaction.forms) {
    assert.match(candidate.submitsTo, /^(?:GET|POST) \/|^SERVER ACTION /);
    assert.ok(candidate.schema && candidate.schema.length > 0);
    assert.deepEqual(candidate.testIds, [TEST_ID]);
  }

  const source = readFileSync(screen.sourceFiles[0], "utf8");
  for (const assertion of expected.sourceAssertions) {
    assert.ok(
      source.includes(assertion),
      `${route}: source assertion is absent: ${assertion}`,
    );
  }

  actionInventoryCount += interaction.actions.length;
  structuredFormCount += interaction.forms.length;
}

assert.equal(actionInventoryCount, 21);
assert.equal(structuredFormCount, 11);
assert.equal(zeroFormExclusionCount, 2);

const actionsSource = readFileSync("src/app/actions.ts", "utf8");
for (const assertion of [
  "const agentFormSchema = z.object({",
  "input: agentRequestSchema.shape.input",
  "const supportTicketSchema = z.object({",
  'category: z.enum(["general", "billing", "technical", "feedback"])',
  "body: z.string().trim().min(20).max(5_000)",
  "const current = await requireCurrentUserProfile();",
  "assertPaidFeatureAccess(current);",
  "forumThreadSchema.parse({",
  "forumReplySchema.parse({ body: field(formData, \"body\") })",
  "if (!thread || thread.locked) throw new Error(\"forum.thread_unavailable\")",
  "withDbRequestContext(current, async (tx) =>",
  "const parsed = agentFormSchema.parse({",
  "normalizeAgentType(parsed.agentType)",
  "runAgentForCurrentUser(current, agentType, {",
  "const rateLimit = await checkRateLimit(",
  "SUPPORT_TICKET_RATE_LIMIT",
  "const parsed = supportTicketSchema.parse({",
  "userId: current.dbUserId",
  "body: cleanText(parsed.body)",
]) {
  assert.ok(
    actionsSource.includes(assertion),
    `member-support actions must preserve ${assertion}`,
  );
}

const agentServiceSource = readFileSync("src/lib/agent-service.ts", "utf8");
for (const assertion of [
  "export const AGENT_TYPES = {",
  'export { agentRunSchema } from "@/lib/agent-validation";',
  "isEmergencyControlActive(process.env.AI_DISABLED)",
  "assertAgentTier(current, agentType);",
  "await recordUsageEvent({",
  "await createAuditLog({",
]) {
  assert.ok(
    agentServiceSource.includes(assertion),
    `agent service must preserve ${assertion}`,
  );
}

const agentValidationSource = readFileSync(
  "src/lib/agent-validation.ts",
  "utf8",
);
assert.ok(
  agentValidationSource.includes(
    "input: z.string().trim().min(10).max(5_000).transform(cleanText)",
  ),
  "agent validation must preserve the bounded cleaned input schema",
);

console.log(
  "Member-support interaction coverage passed: 7 action routes, 5 verified form routes, 2 exact zero-form exclusions, 21 action entries, 11 structured forms, account onboarding retained",
);
