import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  PRODUCT_MESSAGE_EDIT_EXCLUSION,
  PRODUCT_MESSAGE_EDIT_EXCLUSION_EVIDENCE_FILE,
  PRODUCT_MESSAGE_EDIT_EXCLUSION_MASTER_EVIDENCE,
  PRODUCT_MESSAGE_EDIT_EXCLUSION_REQUIREMENT_ID,
  PRODUCT_MESSAGE_EDIT_EXCLUSION_SCOPE,
  PRODUCT_MESSAGE_EDIT_EXCLUSION_TEST_FILE,
  type ProductMessageEditActionContract,
  type ProductMessageEditSupportInventory,
  findMessageEditExclusionIssues,
} from "./product-message-edit-exclusion-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCTION_SCREEN_INTERACTION_CONTRACTS,
} from "./screen-contracts/production-screen-coverage";
import { getLocalSourceClosure } from "./screen-contracts/screen-contract-source-audit";
import { SCREEN_CONTRACTS } from "./demo-experience-registry";

// screen-evidence-test-id: PRODUCT-MESSAGE-EDIT-EXCLUSION

const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  ({ id }) => id === PRODUCT_MESSAGE_EDIT_EXCLUSION_REQUIREMENT_ID,
);
assert.equal(
  requirement?.requirement,
  "Support editing messages where supported.",
);
const evidence =
  PRODUCT_MESSAGE_EDIT_EXCLUSION_MASTER_EVIDENCE[
    PRODUCT_MESSAGE_EDIT_EXCLUSION_REQUIREMENT_ID
  ];
assert.equal(evidence.status, "excluded");
assert.equal(evidence.owner, PRODUCT_MESSAGE_EDIT_EXCLUSION.owner);
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_MESSAGE_EDIT_EXCLUSION_EVIDENCE_FILE,
  PRODUCT_MESSAGE_EDIT_EXCLUSION_TEST_FILE,
]);
for (const evidencePath of evidence.evidence) {
  assert.equal(existsSync(evidencePath), true, evidencePath);
}
assert.match(PRODUCT_MESSAGE_EDIT_EXCLUSION.rationale, /where supported/iu);
assert.match(PRODUCT_MESSAGE_EDIT_EXCLUSION.rationale, /explicitly excluded/iu);
assert.match(PRODUCT_MESSAGE_EDIT_EXCLUSION_SCOPE, /fails closed/iu);
assert.match(PRODUCT_MESSAGE_EDIT_EXCLUSION_SCOPE, /does not prove/iu);

const itemRoutePath =
  "src/app/api/conversations/[id]/messages/[msgId]/route.ts";
const itemRoute = readFileSync(itemRoutePath, "utf8");
const itemRouteMethods = [
  ...itemRoute.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b/gu),
].map((match) => match[1]);
assert.deepEqual(itemRouteMethods, ["DELETE"]);

const schema = readFileSync("prisma/schema.prisma", "utf8");
const messageBlock = schema.match(/model Message \{([\s\S]*?)\n\}/u)?.[1];
assert.ok(messageBlock, "Message schema block missing");
const messageSchemaFields = messageBlock
  .split(/\r?\n/u)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("@@") && !line.startsWith("//"))
  .map((line) => line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s/u)?.[1])
  .filter((field): field is string => Boolean(field));
assert.deepEqual(messageSchemaFields, [
  "id",
  "conversationId",
  "conversation",
  "senderId",
  "sender",
  "senderActorId",
  "senderActor",
  "recipientId",
  "recipient",
  "recipientActorId",
  "recipientActor",
  "body",
  "mediaIdsJson",
  "read",
  "readAt",
  "deletedBySenderAt",
  "deletedByRecipientAt",
  "createdAt",
  "media",
  "deliveryReceipts",
  "readReceipts",
  "reactions",
  "moderationActions",
]);

const allActions: ProductMessageEditActionContract[] = [];
for (const [route, contract] of Object.entries(
  PRODUCTION_SCREEN_INTERACTION_CONTRACTS,
)) {
  for (const action of contract.actions) {
    const combined = `${action.id}\n${action.result}\n${action.enforcement ?? ""}`;
    if (!/message/iu.test(combined)) continue;
    allActions.push({
      route,
      id: action.id,
      result: action.result,
      enforcement: action.enforcement ?? "",
    });
  }
}
assert.equal(allActions.length, 41);
assert.equal(new Set(allActions.map(({ route, id }) => `${route}:${id}`)).size, 41);

const messageRoutes = new Set([
  "/pulse",
  "/pulse/[id]",
  "/messages",
  "/messages/[id]",
]);
const messageRuntimeFiles = [
  ...new Set(
    SCREEN_CONTRACTS.filter(({ route }) => messageRoutes.has(route)).flatMap(
      ({ sourceFiles }) =>
        sourceFiles.flatMap((sourceFile) => [
          ...getLocalSourceClosure(sourceFile),
        ]),
    ),
  ),
]
  .filter((path) => path.startsWith("src/"))
  .filter((path) => /\.[cm]?[jt]sx?$/u.test(path))
  .filter((path) => !/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(path))
  .filter((path) => !/\/product-[^/]*evidence\.ts$/u.test(path))
  .toSorted((left, right) => left.localeCompare(right));
assert.ok(messageRuntimeFiles.length > 20);

const runtimeEditPatterns = [
  /\beditMessage\b/giu,
  /\bupdateMessage\b/giu,
  /\bedit(?:ed|ing)?\s+(?:this\s+)?message\b/giu,
  /\bmessage[-_.:]edit\b/giu,
] as const;
const runtimeEditSignals = messageRuntimeFiles.flatMap((path) => {
  const source = readFileSync(path, "utf8");
  return runtimeEditPatterns.flatMap((pattern) =>
    [...source.matchAll(pattern)].map((match) => ({
      path,
      signal: match[0],
    })),
  );
});

const currentInventory: ProductMessageEditSupportInventory = {
  itemRouteMethods,
  messageSchemaFields,
  messageActionContracts: allActions,
  runtimeEditSignals,
};
assert.deepEqual(findMessageEditExclusionIssues(currentInventory), []);
assert.deepEqual(runtimeEditSignals, []);

const negativeFixtures = [
  {
    name: "vacuous inventory",
    inventory: {
      itemRouteMethods: [],
      messageSchemaFields: [],
      messageActionContracts: [],
      runtimeEditSignals: [],
    },
    expectedCode: "MESSAGE_BASELINE_INCOMPLETE",
  },
  {
    name: "edit route introduced",
    inventory: {
      ...currentInventory,
      itemRouteMethods: [...itemRouteMethods, "PATCH"],
    },
    expectedCode: "EDIT_ITEM_METHOD_DECLARED",
  },
  {
    name: "edit history introduced",
    inventory: {
      ...currentInventory,
      messageSchemaFields: [...messageSchemaFields, "editedAt"],
    },
    expectedCode: "EDIT_HISTORY_FIELD_DECLARED",
  },
  {
    name: "edit action introduced",
    inventory: {
      ...currentInventory,
      messageActionContracts: [
        ...allActions,
        {
          route: "/pulse/[id]",
          id: "PULSE-THREAD.ACTION.MESSAGE.EDIT",
          result: "Edits a sent message.",
          enforcement: "PATCHes the owned message.",
        },
      ],
    },
    expectedCode: "EDIT_ACTION_DECLARED",
  },
  {
    name: "edit control introduced",
    inventory: {
      ...currentInventory,
      runtimeEditSignals: [
        { path: "src/components/message-row.tsx", signal: "editMessage" },
      ],
    },
    expectedCode: "EDIT_RUNTIME_SIGNAL_DECLARED",
  },
] as const;

for (const fixture of negativeFixtures) {
  assert.equal(
    findMessageEditExclusionIssues(fixture.inventory).some(
      ({ code }) => code === fixture.expectedCode,
    ),
    true,
    fixture.name,
  );
}

const evidenceSource = readFileSync(
  PRODUCT_MESSAGE_EDIT_EXCLUSION_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/u);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/u);

console.log(
  `Message-edit exclusion passed: DELETE-only item route, ${messageSchemaFields.length} immutable Message fields, ${allActions.length} message-related action contracts and ${messageRuntimeFiles.length} reachable runtime files contain no edit capability; all introduction fixtures fail closed.`,
);
