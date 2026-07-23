import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

import {
  SCREEN_CONTRACT_BY_ROUTE,
  SCREEN_CONTRACTS,
} from "../demo-experience-registry";
import {
  PRODUCT_MESSAGING_ACCESS_STATE_MASTER_EVIDENCE,
  PRODUCT_MESSAGING_ACCESS_STATE_OPEN_REQUIREMENT_IDS,
  PRODUCT_MESSAGING_ACCESS_STATE_REQUIREMENT_IDS,
} from "../product-messaging-access-state-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "../product-master-requirements";
import { PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_CONTRACTS } from "./production-screen-admin-access-state-evidence";
import {
  PRODUCTION_SCREEN_MESSAGING_ACCESS_STATE_EVIDENCE_TEST,
  PRODUCTION_SCREEN_MESSAGING_PERMISSION_CONTRACTS,
  PRODUCTION_SCREEN_MESSAGING_PERMISSION_ROUTES,
  PRODUCTION_SCREEN_MESSAGING_STATE_CONTRACTS,
  PRODUCTION_SCREEN_MESSAGING_STATE_ROUTES,
  PRODUCTION_SCREEN_REMAINING_OPEN_PERMISSION_ROUTES,
  PRODUCTION_SCREEN_REMAINING_OPEN_STATE_ROUTES,
} from "./production-screen-messaging-access-state-evidence";
import { PUBLIC_SCREEN_PERMISSION_CONTRACTS } from "./screen-permission-evidence";
import { PRODUCTION_SCREEN_STATE_CONTRACTS } from "./screen-state-evidence";

// screen-evidence-test-id: PRODUCTION-SCREEN-MESSAGING-ACCESS-STATE-EVIDENCE

const TEST_ID = PRODUCTION_SCREEN_MESSAGING_ACCESS_STATE_EVIDENCE_TEST.id;
const TEST_PATH = PRODUCTION_SCREEN_MESSAGING_ACCESS_STATE_EVIDENCE_TEST.path;

assert.deepEqual(
  PRODUCTION_SCREEN_MESSAGING_PERMISSION_CONTRACTS.map(({ route }) => route),
  PRODUCTION_SCREEN_MESSAGING_PERMISSION_ROUTES,
);
assert.deepEqual(
  PRODUCTION_SCREEN_MESSAGING_STATE_CONTRACTS.map(({ route }) => route),
  PRODUCTION_SCREEN_MESSAGING_STATE_ROUTES,
);
assert.equal(PRODUCTION_SCREEN_MESSAGING_PERMISSION_CONTRACTS.length, 6);
assert.equal(PRODUCTION_SCREEN_MESSAGING_STATE_CONTRACTS.length, 5);

const previousPermissionRoutes = new Set<string>(
  PUBLIC_SCREEN_PERMISSION_CONTRACTS.map(({ route }) => route),
);
const previousStateRoutes = new Set<string>([
  ...PRODUCTION_SCREEN_STATE_CONTRACTS.map(({ route }) => route),
  ...PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_CONTRACTS.map(({ route }) => route),
]);
const previousStateIds = new Set(
  [
    ...PRODUCTION_SCREEN_STATE_CONTRACTS,
    ...PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_CONTRACTS,
  ].flatMap(({ states }) => states.map(({ id }) => id)),
);

let permissionRuleCount = 0;
for (const contract of PRODUCTION_SCREEN_MESSAGING_PERMISSION_CONTRACTS) {
  const screen = SCREEN_CONTRACT_BY_ROUTE.get(contract.route);
  assert.ok(screen, `${contract.route}: missing screen registry entry`);
  assert.equal(screen.productionEnabled, true);
  assert.equal(screen.authentication, "optional");
  assert.equal(contract.sourcePath, screen.sourceFiles[0]);
  assert.equal(existsSync(contract.sourcePath), true);
  assert.equal(existsSync(contract.canonicalSourcePath), true);
  assert.equal(previousPermissionRoutes.has(contract.route), false);
  assert.equal(screen.coverage.permissions.status, "tested");
  assert.deepEqual(screen.permissionRules, contract.permissions);
  assert.ok(screen.coverage.permissions.evidence.includes(TEST_PATH));

  for (const permission of contract.permissions) {
    assert.ok(permission.actor.length > 0);
    assert.ok(permission.enforcedBy.length > 0);
    assert.deepEqual(permission.testIds, [TEST_ID]);
  }
  permissionRuleCount += contract.permissions.length;
}
assert.equal(permissionRuleCount, 16);

const newStateIds = new Set<string>();
let stateRuleCount = 0;
for (const contract of PRODUCTION_SCREEN_MESSAGING_STATE_CONTRACTS) {
  const screen = SCREEN_CONTRACT_BY_ROUTE.get(contract.route);
  assert.ok(screen, `${contract.route}: missing screen registry entry`);
  assert.equal(contract.sourcePath, screen.sourceFiles[0]);
  assert.equal(existsSync(contract.sourcePath), true);
  assert.equal(previousStateRoutes.has(contract.route), false);
  assert.equal(screen.coverage.states.status, "verified");
  assert.ok(screen.coverage.states.evidence.includes(TEST_PATH));
  assert.deepEqual(
    screen.stateRules,
    contract.states.map(({ id, testIds, recoveryActionId }) => ({
      id,
      testIds,
      ...(recoveryActionId ? { recoveryActionId } : {}),
    })),
  );

  for (const state of contract.states) {
    assert.match(
      state.id,
      /^PRODUCTION\.STATE\.(?:MESSAGE|MESSAGES|PULSE)[A-Z0-9-]*\.[A-Z0-9-]+$/,
    );
    assert.equal(previousStateIds.has(state.id), false, `${state.id} is reused`);
    assert.equal(newStateIds.has(state.id), false, `${state.id} is duplicated`);
    newStateIds.add(state.id);
    assert.deepEqual(state.testIds, [TEST_ID]);
    assert.ok(state.sourceAssertions.length > 0);
    if (state.id.endsWith(".RECOVERABLE-ERROR")) {
      assert.ok(state.recoveryActionId, `${state.id} needs recovery`);
    }

    for (const assertion of state.sourceAssertions) {
      assert.equal(existsSync(assertion.sourcePath), true);
      assertOrdered(
        readFileSync(assertion.sourcePath, "utf8"),
        assertion.orderedText,
        `${state.id}: ${assertion.sourcePath}`,
      );
    }
  }
  stateRuleCount += contract.states.length;
}
assert.equal(stateRuleCount, 27);
assert.equal(newStateIds.size, 27);

assert.deepEqual(
  SCREEN_CONTRACTS.filter(
    ({ coverage }) => coverage.permissions.status === "captured",
  ).map(({ route }) => route),
  PRODUCTION_SCREEN_REMAINING_OPEN_PERMISSION_ROUTES,
  "the permission wave must retain an exact, explicit residual partition",
);
assert.deepEqual(
  SCREEN_CONTRACTS.filter(
    ({ coverage }) => coverage.states.status === "captured",
  ).map(({ route }) => route),
  PRODUCTION_SCREEN_REMAINING_OPEN_STATE_ROUTES,
  "the state wave must retain an exact, explicit residual partition",
);
assert.equal(PRODUCTION_SCREEN_REMAINING_OPEN_PERMISSION_ROUTES.length, 0);
// Six post-decommission registrations await a dedicated state wave.
assert.equal(PRODUCTION_SCREEN_REMAINING_OPEN_STATE_ROUTES.length, 6);

const messagesPage = functionSource(
  "src/app/messages/page.tsx",
  "MessagesPage",
);
assertOrdered(
  messagesPage,
  [
    "const user = await getCurrentUser();",
    "const dbContext =",
    "dbContext ? listConversationsForProfile(dbContext) : []",
    "dbContext ? listFriendsForProfile(dbContext) : []",
  ],
  "the inbox must withhold every private read from signed-out callers",
);

const friendsPage = functionSource(
  "src/app/messages/friends/page.tsx",
  "PulseFriendsPage",
);
assertOrdered(
  friendsPage,
  [
    "const user = await getCurrentUser();",
    "const dbContext =",
    "const [friends, requests] = dbContext",
  ],
  "the friends page must withhold its private read from signed-out callers",
);

const threadPage = functionSource(
  "src/app/messages/[id]/page.tsx",
  "MessageThreadPage",
);
assertOrdered(
  threadPage,
  [
    "getCurrentUser(),",
    "if (!user?.profileId || !user.dbUserId) return <SignedOutThread />;",
    "conversation = await getConversationForProfile(",
    "} catch {",
    "notFound();",
  ],
  "thread authorization must precede records and collapse inaccessible IDs",
);

const listConversations = functionSource(
  "src/lib/conversation-service.ts",
  "listConversationsForProfile",
);
assertOrdered(
  listConversations,
  [
    "tx.conversation.findMany({",
    "OR: [",
    "{ participantAId: current.profileId },",
    "{ participantBId: current.profileId },",
  ],
  "the inbox query must be participant scoped",
);

const getConversation = functionSource(
  "src/lib/conversation-service.ts",
  "getConversationForProfile",
);
assertOrdered(
  getConversation,
  [
    "tx.conversation.findFirst({",
    "id: conversationId,",
    "{ participantAId: current.profileId },",
    "{ participantBId: current.profileId },",
    'if (!conversation) throw new Error("conversation.not_found");',
    "tx.message.findMany({",
  ],
  "a thread ID must not authorize its records",
);

const searchMessages = functionSource(
  "src/lib/conversation-service.ts",
  "searchConversationMessages",
);
assertOrdered(
  searchMessages,
  [
    "tx.conversation.findFirst({",
    "id: conversationId,",
    "{ participantAId: current.profileId },",
    "{ participantBId: current.profileId },",
    'if (!conversation) throw new Error("conversation.not_found");',
    "tx.message.findMany({",
  ],
  "conversation search must repeat the participant boundary",
);

const listFriends = functionSource(
  "src/lib/friend-service.ts",
  "listFriendsForProfile",
);
assertOrdered(
  listFriends,
  [
    "tx.friendship.findMany({",
    'status: "accepted",',
    "{ profileAId: current.profileId },",
    "{ profileBId: current.profileId },",
  ],
  "the friends query must be accepted and current-profile scoped",
);

for (const [functionName, protectedEffect] of [
  ["sendMessage", "startOrGetConversation("],
  ["replyToConversation", "sendConversationMessage("],
  ["deleteConversationMessage", "softDeleteConversationMessage("],
  ["markConversationReadAction", "markConversationRead("],
  ["blockConversation", "setConversationBlock("],
  ["unblockConversation", "setConversationBlock("],
  ["toggleMessageReaction", "toggleConversationMessageReactionForCurrentUser("],
  ["reportConversationMessage", "tx.message.findFirst({"],
] as const) {
  assertOrdered(
    functionSource("src/app/actions.ts", functionName),
    ["requireCurrentUserProfile()", protectedEffect],
    `${functionName} must authenticate before its protected effect`,
  );
}

const sendConversation = functionSource(
  "src/lib/conversation-service.ts",
  "sendConversationMessage",
);
assertOrdered(
  sendConversation,
  [
    "getConversationForProfile(",
    "assertNotBlocked(conversation.blockedById);",
    "tx.message.create({",
  ],
  "blocked conversations must fail before message creation",
);

const setBlock = functionSource(
  "src/lib/conversation-service.ts",
  "setConversationBlock",
);
assertOrdered(
  setBlock,
  [
    "getConversationForProfile(",
    "if (!blocked && conversation.blockedById !== current.profileId)",
    'throw new Error("auth.forbidden");',
    "tx.conversation.update({",
  ],
  "only the block owner may clear a conversation block",
);

const createCall = functionSource(
  "src/lib/call-service.ts",
  "createCallRoomForConversation",
);
assertOrdered(
  createCall,
  [
    "getConversationForProfile(",
    'if (conversation.blockedById) throw new Error("call.blocked");',
    "findActiveCallRoom(",
    "tx.callRoom.create({",
  ],
  "blocked conversations must fail before call-room creation",
);

const aliasImports = {
  "/pulse": [
    "src/app/pulse/page.tsx",
    'import PulsePage, { metadata } from "../messages/page";',
  ],
  "/pulse/[id]": [
    "src/app/pulse/[id]/page.tsx",
    '} from "../../messages/[id]/page";',
  ],
  "/pulse/friends": [
    "src/app/pulse/friends/page.tsx",
    'import PulseFriendsPage, { metadata } from "../../messages/friends/page";',
  ],
} as const;
for (const [route, [sourcePath, expectedImport]] of Object.entries(
  aliasImports,
)) {
  assert.ok(
    readFileSync(sourcePath, "utf8").includes(expectedImport),
    `${route} must remain a thin alias of the reviewed canonical page`,
  );
}

const knownRequirementIds = new Set(
  PRODUCT_MASTER_REQUIREMENTS.map(({ id }) => id),
);
assert.deepEqual(
  Object.keys(PRODUCT_MESSAGING_ACCESS_STATE_MASTER_EVIDENCE),
  PRODUCT_MESSAGING_ACCESS_STATE_REQUIREMENT_IDS,
);
for (const requirementId of PRODUCT_MESSAGING_ACCESS_STATE_REQUIREMENT_IDS) {
  assert.equal(knownRequirementIds.has(requirementId), true);
  const record = PRODUCT_MESSAGING_ACCESS_STATE_MASTER_EVIDENCE[requirementId];
  assert.equal(record.status, "tested");
  assert.ok(record.evidence.includes(TEST_PATH));
  for (const evidencePath of record.evidence) {
    assert.equal(existsSync(evidencePath), true, evidencePath);
  }
}
for (const requirementId of PRODUCT_MESSAGING_ACCESS_STATE_OPEN_REQUIREMENT_IDS) {
  assert.equal(knownRequirementIds.has(requirementId), true);
  assert.equal(
    requirementId in PRODUCT_MESSAGING_ACCESS_STATE_MASTER_EVIDENCE,
    false,
    `${requirementId} must remain explicitly unproven by this focused wave`,
  );
}

console.log(
  "Messaging access/state evidence passed: 6 permission cells, 16 permission rules, 5 state cells, 27 explicit states, 0 permission and 0 state cells remain open",
);

function functionSource(sourcePath: string, name: string) {
  const source = readFileSync(sourcePath, "utf8");
  const sourceFile = ts.createSourceFile(
    sourcePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    sourcePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const declaration = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  assert.ok(declaration, `${sourcePath} must export ${name}`);
  return declaration.getText(sourceFile);
}

function assertOrdered(
  source: string,
  needles: readonly string[],
  message: string,
) {
  let cursor = 0;
  for (const needle of needles) {
    const index = source.indexOf(needle, cursor);
    assert.notEqual(index, -1, `${message}. Missing: ${needle}`);
    cursor = index + needle.length;
  }
}
