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
  PRODUCTION_SCREEN_PROFILE_MESSAGING_INTERACTION_CONTRACTS,
  PRODUCTION_SCREEN_PROFILE_MESSAGING_INTERACTION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_PROFILE_MESSAGING_INTERACTION_ROUTES,
} from "./production-screen-profile-messaging-interactions";
import {
  findFormSubmissionSignals,
  findUserActionSignals,
  getLocalSourceClosure,
} from "./screen-contract-source-audit";

// screen-evidence-test-id: PRODUCTION-SCREEN-PROFILE-MESSAGING-INTERACTIONS

const TEST_ID =
  PRODUCTION_SCREEN_PROFILE_MESSAGING_INTERACTION_EVIDENCE_TEST.id;
const TEST_PATH =
  PRODUCTION_SCREEN_PROFILE_MESSAGING_INTERACTION_EVIDENCE_TEST.path;
const actionExclusions = new Set<string>(
  PRODUCTION_SCREEN_ACTION_EXCLUSION_ROUTES,
);
const formExclusions = new Set<string>(PRODUCTION_SCREEN_FORM_EXCLUSION_ROUTES);
const onboardingExclusions = new Set(
  Object.keys(PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS),
);

const EXPECTED_PROFILE_MESSAGING_INTERACTIONS = {
  "/messages": {
    queryParameters: [],
    actionIds: [
      "MESSAGES.ACTION.CONVERSATION.OPEN",
      "MESSAGES.ACTION.MESSAGE.SEND",
      "MESSAGES.ACTION.FRIENDS.OPEN",
      "MESSAGES.ACTION.FRIEND.CONVERSATION.OPEN",
      "MESSAGES.ACTION.SIGN-IN.OPEN",
    ],
    forms: [["MESSAGES.FORM.MESSAGE", "SERVER ACTION sendMessage"]],
    onboarding: "excluded",
    sourceAssertions: [
      "const user = await getCurrentUser();",
      "listConversationsForProfile(dbContext)",
      "href={`/pulse/${conversation.id}`}",
      'href="/pulse/friends"',
      "<form action={sendMessage}",
      "<RecipientPicker />",
      "<MediaAttachmentFields compact />",
    ],
  },
  "/messages/[id]": {
    queryParameters: ["call"],
    actionIds: [
      "MESSAGE-THREAD.ACTION.MESSAGE.SEND",
      "MESSAGE-THREAD.ACTION.CALL.MANAGE",
      "MESSAGE-THREAD.ACTION.REACTION.TOGGLE",
      "MESSAGE-THREAD.ACTION.MESSAGE.DELETE",
      "MESSAGE-THREAD.ACTION.MESSAGE.REPORT",
      "MESSAGE-THREAD.ACTION.ATTACHMENT.OPEN",
      "MESSAGE-THREAD.ACTION.CONVERSATION.OPEN",
      "MESSAGE-THREAD.ACTION.FRIEND.RESPOND",
      "MESSAGE-THREAD.ACTION.FRIEND.FIND",
      "MESSAGE-THREAD.ACTION.INBOX.OPEN",
      "MESSAGE-THREAD.ACTION.SIGN-IN.OPEN",
    ],
    forms: [
      [
        "MESSAGE-THREAD.FORM.MESSAGE",
        "POST /api/conversations/[id]/messages",
      ],
      [
        "MESSAGE-THREAD.FORM.FRIEND-ACCEPT",
        "SERVER ACTION respondToFriendRequestAction",
      ],
      [
        "MESSAGE-THREAD.FORM.FRIEND-DECLINE",
        "SERVER ACTION respondToFriendRequestAction",
      ],
    ],
    onboarding: "excluded",
    sourceAssertions: [
      "<PulseThreadSurface",
      "<ConversationCallPanel",
      'hasTier(user.tier, "pro_plus")',
    ],
  },
  "/messages/friends": {
    queryParameters: [],
    actionIds: [
      "MESSAGES-FRIENDS.ACTION.INBOX.OPEN",
      "MESSAGES-FRIENDS.ACTION.CONVERSATION.OPEN",
      "MESSAGES-FRIENDS.ACTION.SIGN-IN.OPEN",
    ],
    forms: [
      [
        "MESSAGES-FRIENDS.FORM.REQUEST-ACCEPT",
        "SERVER ACTION respondToFriendRequestAction",
      ],
      [
        "MESSAGES-FRIENDS.FORM.REQUEST-DECLINE",
        "SERVER ACTION respondToFriendRequestAction",
      ],
    ],
    onboarding: "excluded",
    sourceAssertions: [
      "const user = await getCurrentUser();",
      "listFriendsForProfile(dbContext)",
      'href="/pulse"',
      'href="/sign-in"',
      "href={`/pulse/${friend.conversationId}`}",
    ],
  },
  "/p/[handle]": {
    queryParameters: [],
    actionIds: [
      "PROFILE.ACTION.MANAGE.OPEN",
      "PROFILE.ACTION.SIGN-IN.OPEN",
      "PROFILE.ACTION.FRIEND.REQUEST",
      "PROFILE.ACTION.FRIENDS.OPEN",
      "PROFILE.ACTION.CHAT.START",
      "PROFILE.ACTION.FOLLOW.TOGGLE",
      "PROFILE.ACTION.CONTENT.OPEN",
      "PROFILE.ACTION.CONTACT.OPEN",
    ],
    forms: [
      [
        "PROFILE.FORM.PRIVATE-FRIEND-REQUEST",
        "SERVER ACTION sendFriendRequestAction",
      ],
      [
        "PROFILE.FORM.FRIEND-REQUEST",
        "SERVER ACTION sendFriendRequestAction",
      ],
      ["PROFILE.FORM.PERSONAL-CHAT", "SERVER ACTION startChatAction"],
      [
        "PROFILE.FORM.PAGE-FOLLOW",
        "SERVER ACTION toggleActorFollowAction",
      ],
      ["PROFILE.FORM.PAGE-CHAT", "SERVER ACTION startChatAction"],
    ],
    onboarding: "tested",
    sourceAssertions: [
      "const profile = await getSocialActorProfileByHandle(handle, viewer);",
      "<form action={sendFriendRequestAction}",
      "<form action={startChatAction}",
      "action={toggleActorFollowAction}",
      'href="/pulse/friends"',
      'href="/sign-in"',
      "href={`mailto:${contact.email}`}",
      'rel="noopener noreferrer nofollow"',
    ],
  },
} as const;

assert.deepEqual(
  PRODUCTION_SCREEN_PROFILE_MESSAGING_INTERACTION_ROUTES,
  Object.keys(EXPECTED_PROFILE_MESSAGING_INTERACTIONS),
  "the profile-messaging batch must fail closed on route additions or removals",
);
assert.deepEqual(
  Object.keys(PRODUCTION_SCREEN_PROFILE_MESSAGING_INTERACTION_CONTRACTS),
  PRODUCTION_SCREEN_PROFILE_MESSAGING_INTERACTION_ROUTES,
  "the owned module may contain only the reviewed profile-messaging routes",
);
assert.equal(PRODUCTION_SCREEN_PROFILE_MESSAGING_INTERACTION_ROUTES.length, 4);

let actionInventoryCount = 0;
let structuredFormCount = 0;

for (const route of PRODUCTION_SCREEN_PROFILE_MESSAGING_INTERACTION_ROUTES) {
  const expected = EXPECTED_PROFILE_MESSAGING_INTERACTIONS[route];
  const ownedInteraction =
    PRODUCTION_SCREEN_PROFILE_MESSAGING_INTERACTION_CONTRACTS[route];
  const interaction = Object.entries(PRODUCTION_SCREEN_INTERACTION_CONTRACTS).find(
    ([candidateRoute]) => candidateRoute === route,
  )?.[1];
  const screen = SCREEN_CONTRACT_BY_ROUTE.get(route);
  assert.ok(screen, `${route}: missing production screen contract`);
  assert.equal(screen.productionEnabled, true);
  assert.equal(screen.authentication, "optional");
  assert.equal(
    onboardingExclusions.has(route),
    expected.onboarding === "excluded",
  );
  assert.equal(screen.coverage.onboarding.status, expected.onboarding);
  assert.equal(actionExclusions.has(route), false);
  assert.equal(formExclusions.has(route), (expected.forms.length as number) === 0);
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

  const closure = getLocalSourceClosure(screen.sourceFiles[0]);
  const formSignals = [...closure].flatMap(findFormSubmissionSignals);
  const actionSignals = [...closure].flatMap(findUserActionSignals);
  const sourceForms = formSignals.filter((signal) =>
    signal.endsWith(":<form>"),
  );
  assert.equal(
    sourceForms.length,
    expected.forms.length,
    `${route}: every source-owned form must have exactly one manifest entry\n${sourceForms.join("\n")}`,
  );
  assert.ok(
    actionSignals.length > 0,
    `${route}: verified actions require a source-owned interaction signal`,
  );

  assert.equal(screen.coverage.actions.status, "verified");
  assert.equal(
    screen.coverage.forms.status,
    (expected.forms.length as number) === 0 ? "excluded" : "verified",
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

assert.equal(actionInventoryCount, 27);
assert.equal(structuredFormCount, 11);

const actionsSource = readFileSync("src/app/actions.ts", "utf8");
for (const assertion of [
  "export async function sendMessage(formData: FormData)",
  "const parsed = messageSchema.parse({",
  "export async function markConversationReadAction(",
  "export async function blockConversation(",
  "export async function unblockConversation(",
  "export async function toggleMessageReaction(",
  "export async function reportConversationMessage(",
  "export async function sendFriendRequestAction(formData: FormData)",
  "const parsed = friendTargetSchema.parse({",
  "export async function startChatAction(formData: FormData)",
]) {
  assert.ok(
    actionsSource.includes(assertion),
    `message/profile action boundary must preserve ${assertion}`,
  );
}

const messageRouteSource = readFileSync(
  "src/app/api/conversations/[id]/messages/route.ts",
  "utf8",
);
for (const assertion of [
  "requireCurrentUserProfile()",
  "const MESSAGE_SEND_RATE_LIMIT = 10",
  "conversationMessageSchema.parse(await readBoundedJsonRequest(request))",
  "await sendConversationMessage(current, id, parsed)",
]) {
  assert.ok(
    messageRouteSource.includes(assertion),
    `message API boundary must preserve ${assertion}`,
  );
}

const conversationSource = readFileSync(
  "src/lib/conversation-service.ts",
  "utf8",
);
for (const assertion of [
  "export async function startOrGetConversation(",
  "const recipient = await resolveConversationRecipient(",
  "await assertProfilesCanInteract(",
  "export async function sendConversationMessage(",
  "export async function markConversationRead(",
  "export async function setConversationBlock(",
  "export async function toggleConversationMessageReaction(",
]) {
  assert.ok(
    conversationSource.includes(assertion),
    `conversation service must preserve ${assertion}`,
  );
}

const profileActionSource = readFileSync(
  "src/app/p/[handle]/actions.ts",
  "utf8",
);
for (const assertion of [
  "const followSchema = z.object({",
  "const current = await requireCurrentUserProfile();",
  "`actor:follow:${current.dbUserId}`",
  "const parsed = followSchema.parse({",
  "await toggleActorFollow(current, parsed.actorId)",
]) {
  assert.ok(
    profileActionSource.includes(assertion),
    `profile follow boundary must preserve ${assertion}`,
  );
}

const socialActorSource = readFileSync(
  "src/lib/social-actor-service.ts",
  "utf8",
);
for (const assertion of [
  "if (!/^[a-z0-9-]{1,80}$/.test(normalizedHandle)) return null;",
  "where: { handle: normalizedHandle, published: true }",
  "if (blockState?.blocked) return null;",
  "const canViewContact = canViewAudience(contactAudience, {",
  "export async function toggleActorFollow(",
  'kind: "page",',
  "published: true,",
  'if (blocked) throw new Error("actor.follow_blocked")',
]) {
  assert.ok(
    socialActorSource.includes(assertion),
    `social actor service must preserve ${assertion}`,
  );
}

const friendSource = readFileSync("src/lib/friend-service.ts", "utf8");
for (const assertion of [
  "export async function sendFriendRequest(",
  'throw new Error("friend.cannot_add_self")',
  "await assertProfilesCanInteract(",
  'throw new Error("friend.profile_unavailable")',
  'action: "friend.request.send"',
]) {
  assert.ok(
    friendSource.includes(assertion),
    `friend request service must preserve ${assertion}`,
  );
}

console.log(
  "Profile-messaging interaction coverage passed: 4 action routes, 4 verified form routes, 0 zero-form exclusions, 27 action entries, 11 structured forms, onboarding unchanged",
);
