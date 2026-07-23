import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import ts from "typescript";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import {
  CONVERSATION_OBJECT_AUTHORIZATION_MASTER_EVIDENCE,
  CONVERSATION_OBJECT_AUTHORIZATION_REQUIREMENT_IDS,
  CONVERSATION_OBJECT_AUTHORIZATION_SCOPE,
} from "./conversation-object-authorization-evidence";

const routeExpectations = {
  "src/app/api/conversations/[id]/route.ts": ["getConversationForProfile"],
  "src/app/api/conversations/[id]/block/route.ts": ["setConversationBlock"],
  "src/app/api/conversations/[id]/delivered/route.ts": [
    "markConversationDelivered",
  ],
  "src/app/api/conversations/[id]/messages/route.ts": [
    "getConversationForProfile",
    "sendConversationMessage",
  ],
  "src/app/api/conversations/[id]/messages/[msgId]/route.ts": [
    "softDeleteConversationMessage",
  ],
  "src/app/api/conversations/[id]/read/route.ts": ["markConversationRead"],
  "src/app/api/conversations/[id]/search/route.ts": [
    "searchConversationMessages",
  ],
} as const;

assert.match(CONVERSATION_OBJECT_AUTHORIZATION_SCOPE, /every HTTP handler/i);
assert.match(CONVERSATION_OBJECT_AUTHORIZATION_SCOPE, /does not claim deployed-database/i);
assert.equal(new Set(CONVERSATION_OBJECT_AUTHORIZATION_REQUIREMENT_IDS).size, 2);
assert.deepEqual(
  Object.keys(CONVERSATION_OBJECT_AUTHORIZATION_MASTER_EVIDENCE).toSorted(),
  [...CONVERSATION_OBJECT_AUTHORIZATION_REQUIREMENT_IDS].toSorted(),
);

for (const [path, serviceCalls] of Object.entries(routeExpectations)) {
  const source = read(path);
  assert.match(source, /requireCurrentUserProfile\(\)/, `${path}: current profile`);
  for (const serviceCall of serviceCalls) {
    assert.match(source, new RegExp(`\\b${serviceCall}\\(`), `${path}: ${serviceCall}`);
  }
}

const conversationSource = read("src/lib/conversation-service.ts");
const getConversation = exportedFunction(conversationSource, "getConversationForProfile");
assert.match(
  getConversation,
  /tx\.conversation\.findFirst\(/,
);
assertInOrder(getConversation, [
  "id: conversationId",
  "OR: [",
  "participantAId: current.profileId",
  "participantBId: current.profileId",
]);
assert.match(getConversation, /throw new Error\("conversation\.not_found"\)/);
assert.match(
  getConversation,
  /tx\.message\.findFirst\([\s\S]*where: \{ id: opts\.before, conversationId \}/,
);

for (const name of [
  "sendConversationMessage",
  "markConversationRead",
  "markConversationDelivered",
  "softDeleteConversationMessage",
  "setConversationBlock",
  "toggleConversationMessageReaction",
]) {
  const source = exportedFunction(conversationSource, name);
  const accessIndex = source.indexOf("getConversationForProfile(");
  const databaseIndex = source.search(/tx\.(?:conversation|message)\.(?:find|create|update|upsert|delete)/);
  assert.ok(accessIndex >= 0, `${name}: conversation access check missing`);
  assert.ok(
    databaseIndex < 0 || accessIndex < databaseIndex,
    `${name}: conversation access must precede its database operation`,
  );
}

const deleteMessage = exportedFunction(
  conversationSource,
  "softDeleteConversationMessage",
);
assert.match(deleteMessage, /where: \{ id: messageId, conversationId \}/);
assert.ok(
  deleteMessage.indexOf("message.senderId !== current.profileId") <
    deleteMessage.indexOf("tx.message.update"),
  "message participant authorization must precede deletion",
);

const reaction = exportedFunction(
  conversationSource,
  "toggleConversationMessageReaction",
);
assert.match(
  reaction,
  /id: messageId,[\s\S]*conversationId: conversation\.id/,
);
assertInOrder(reaction, [
  "senderId: current.profileId",
  "recipientId: current.profileId",
]);
assert.match(reaction, /throw new Error\("message\.not_found"\)/);

const realtimeAuthorizationTest = read("src/lib/realtime-authorization.test.ts");
assert.match(
  realtimeAuthorizationTest,
  /canProfileAccessConversationRealtime\("profile-c", openConversation\),[\s\S]*false/,
);
assert.match(
  realtimeAuthorizationTest,
  /non-participants must not receive conversation grants/,
);

for (const requirementId of CONVERSATION_OBJECT_AUTHORIZATION_REQUIREMENT_IDS) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: immutable requirement missing`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    CONVERSATION_OBJECT_AUTHORIZATION_MASTER_EVIDENCE[requirementId],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
  for (const evidencePath of CONVERSATION_OBJECT_AUTHORIZATION_MASTER_EVIDENCE[
    requirementId
  ].evidence) {
    assert.equal(existsSync(evidencePath), true, evidencePath);
  }
}

console.log(
  "Conversation object authorization evidence passed: seven current-profile API handlers and message-to-conversation binding verified",
);

function read(path: string) {
  return readFileSync(path, "utf8");
}

function exportedFunction(source: string, name: string) {
  const sourceFile = ts.createSourceFile(
    "conversation-service.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const match = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  assert.ok(match, `${name}: exported function missing`);
  return match.getText(sourceFile);
}

function assertInOrder(source: string, expected: readonly string[]) {
  let previous = -1;
  for (const value of expected) {
    const index = source.indexOf(value);
    assert.ok(index > previous, `missing or out of order: ${value}`);
    previous = index;
  }
}
