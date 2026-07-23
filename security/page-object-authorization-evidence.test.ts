import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import ts from "typescript";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import {
  PAGE_OBJECT_AUTHORIZATION_MASTER_EVIDENCE,
  PAGE_OBJECT_AUTHORIZATION_REQUIREMENT_IDS,
  PAGE_OBJECT_AUTHORIZATION_SCOPE,
} from "./page-object-authorization-evidence";

const expectedIds = [
  "security.object-authorization.page-id",
  "security.server-authority.page",
] as const;

assert.deepEqual(PAGE_OBJECT_AUTHORIZATION_REQUIREMENT_IDS, expectedIds);
assert.deepEqual(
  Object.keys(PAGE_OBJECT_AUTHORIZATION_MASTER_EVIDENCE),
  expectedIds,
);
for (const marker of [
  /current profile on the server/i,
  /before a protected read or effect/i,
  /does not claim deployed-database parity/i,
  /cross-user runtime testing/i,
  /other object types/i,
]) {
  assert.match(PAGE_OBJECT_AUTHORIZATION_SCOPE, marker);
}

const customPages = read("src/lib/custom-page-service.ts");
const ownerLookup = functionSource(customPages, "requireOwnedPage");
assert.match(
  ownerLookup,
  /where:\s*\{\s*id: pageId,\s*ownerProfileId: current\.profileId\s*\}/,
);
assert.match(ownerLookup, /if \(!page\) throw new Error\("custom_page\.not_found"\)/);

for (const name of [
  "updateCustomPage",
  "setCustomPagePublished",
  "deleteCustomPage",
]) {
  const source = functionSource(customPages, name);
  assertInOrder(source, ["requireOwnedPage(current, pageId)", "page.id"]);
  assert.doesNotMatch(source, /where:\s*\{\s*id:\s*pageId\s*\}/);
}

const ownedRead = functionSource(customPages, "getOwnedCustomPage");
assert.match(
  ownedRead,
  /where:\s*\{\s*id: pageId,\s*ownerProfileId: current\.profileId\s*\}/,
);

const feed = functionSource(
  read("src/lib/feed-service.ts"),
  "createFeedPostForCurrentUser",
);
assertInOrder(feed, [
  "id: pageId",
  "ownerProfileId: current.profileId",
  'if (!owned) throw new Error("feed.page_not_owned")',
  "tx.feedPost.create",
]);
assert.match(feed, /ensureOwnedPageActor\(current, pageId, tx\)/);

const pageActor = functionSource(
  read("src/lib/social-actor-service.ts"),
  "ensureOwnedPageActor",
);
assert.match(
  pageActor,
  /where:\s*\{\s*id: pageId,\s*ownerProfileId: current\.profileId\s*\}/,
);
assertInOrder(pageActor, [
  'if (!page) throw new Error("actor.page_not_owned")',
  "client.socialActor.upsert",
]);

const dogCard = functionSource(
  read("src/lib/dog-card-service.ts"),
  "generateDogCard",
);
assertInOrder(dogCard, [
  'id: pageId, ownerProfileId: current.profileId, pageType: "dog"',
  'throw new Error("dog_card.page_not_found")',
  "fetch(OPENAI_IMAGE_EDITS_URL",
  "objectStorage.putObject",
]);

const actions = read("src/app/actions.ts");
for (const [name, delegate] of [
  ["updateCustomPageAction", "updateCustomPage(current, pageId, parsed)"],
  [
    "publishCustomPageAction",
    'setCustomPagePublished(current, pageId, parsed.publish === "true")',
  ],
  ["deleteCustomPageAction", "deleteCustomPage(current, pageId)"],
  ["generateDogCardAction", "generateDogCard(current, pageId)"],
] as const) {
  assertInOrder(functionSource(actions, name), [
    "requireCurrentUserProfile()",
    delegate,
  ]);
}

const editPage = functionSource(
  read("src/app/account/pages/[id]/page.tsx"),
  "EditCustomPage",
  ts.ScriptKind.TSX,
);
assertInOrder(editPage, [
  "requireCurrentUserProfile()",
  "getOwnedCustomPage(current, id)",
  "if (!page) notFound()",
  "updateCustomPageAction.bind(null, page.id)",
]);

const feedRoute = functionSource(read("src/app/api/feed/route.ts"), "POST");
assertInOrder(feedRoute, [
  "requireCurrentUserProfile()",
  "feedPostWriteSchema.parse(await readBoundedJsonRequest(request))",
  "createFeedPostForCurrentUser(current, parsed)",
]);
assert.match(
  read("src/lib/feed-validation.ts"),
  /pageId: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(120\)\.optional\(\)\.nullable\(\)/,
);

for (const requirementId of expectedIds) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: immutable requirement missing`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    PAGE_OBJECT_AUTHORIZATION_MASTER_EVIDENCE[requirementId],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
  for (const evidencePath of PAGE_OBJECT_AUTHORIZATION_MASTER_EVIDENCE[
    requirementId
  ].evidence) {
    assert.equal(existsSync(evidencePath), true, evidencePath);
  }
}

console.log(
  "Page object authorization evidence passed: two server-owned page-identifier controls verified",
);

function read(path: string) {
  return readFileSync(path, "utf8");
}

function functionSource(
  source: string,
  name: string,
  kind: ts.ScriptKind = ts.ScriptKind.TS,
) {
  const sourceFile = ts.createSourceFile(
    "page-object-authorization-source.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    kind,
  );
  const matches: ts.FunctionLikeDeclaration[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
      matches.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  assert.equal(matches.length, 1, `${name}: expected one function`);
  return matches[0].getText(sourceFile);
}

function assertInOrder(source: string, expected: readonly string[]) {
  let previous = -1;
  for (const value of expected) {
    const index = source.indexOf(value);
    assert.ok(index > previous, `missing or out of order: ${value}`);
    previous = index;
  }
}
