import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import ts from "typescript";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { listingPatchSchema } from "../src/lib/listing-validation";
import {
  LISTING_EDIT_AUTHORIZATION_TRACES,
  LISTING_OBJECT_AUTHORIZATION_EVIDENCE_FILE,
  LISTING_OBJECT_AUTHORIZATION_EXPECTED_GAIN,
  LISTING_OBJECT_AUTHORIZATION_MASTER_EVIDENCE,
  LISTING_OBJECT_AUTHORIZATION_REQUIREMENT_IDS,
  LISTING_OBJECT_AUTHORIZATION_SCOPE,
  LISTING_OBJECT_AUTHORIZATION_TEST_FILE,
} from "./listing-object-authorization-evidence";

assert.equal(LISTING_OBJECT_AUTHORIZATION_EXPECTED_GAIN, 4);
assert.equal(new Set(LISTING_OBJECT_AUTHORIZATION_REQUIREMENT_IDS).size, 4);
assert.deepEqual(
  Object.keys(LISTING_OBJECT_AUTHORIZATION_MASTER_EVIDENCE),
  LISTING_OBJECT_AUTHORIZATION_REQUIREMENT_IDS,
);
assert.match(LISTING_OBJECT_AUTHORIZATION_SCOPE, /source and unit evidence/i);
assert.match(LISTING_OBJECT_AUTHORIZATION_SCOPE, /current server profile/i);
assert.match(LISTING_OBJECT_AUTHORIZATION_SCOPE, /listing\.not_found/i);
assert.match(LISTING_OBJECT_AUTHORIZATION_SCOPE, /does not claim deployed-database/i);
assert.match(LISTING_OBJECT_AUTHORIZATION_SCOPE, /other object types/i);

for (const requirementId of LISTING_OBJECT_AUTHORIZATION_REQUIREMENT_IDS) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) =>
      candidate.prompt === "security" && candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: immutable requirement missing`);
  assert.equal(SECURITY_MASTER_EVIDENCE[requirementId]?.status, "verified");
  assert.equal(isMasterRequirementComplete(requirement), true);

  const evidence = LISTING_OBJECT_AUTHORIZATION_MASTER_EVIDENCE[requirementId];
  assert.deepEqual(evidence.evidence.slice(0, 2), [
    LISTING_OBJECT_AUTHORIZATION_EVIDENCE_FILE,
    LISTING_OBJECT_AUTHORIZATION_TEST_FILE,
  ]);
  assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
  evidence.evidence.forEach((path) => assert.equal(existsSync(path), true, path));
}

assert.deepEqual(
  LISTING_EDIT_AUTHORIZATION_TRACES.map(({ requirementId, expectedResult }) => ({
    requirementId,
    expectedResult,
  })),
  [
    { requirementId: "security.trace.30.listing-edit", expectedResult: "allowed" },
    {
      requirementId: "security.trace.31.unauthorised-other-seller-edit",
      expectedResult: "denied",
    },
  ],
);
for (const trace of LISTING_EDIT_AUTHORIZATION_TRACES) {
  assert.ok(trace.actor.length > 20, `${trace.requirementId}: actor missing`);
  assert.ok(trace.steps.length >= 2, `${trace.requirementId}: trace too short`);
  for (const step of trace.steps) {
    for (const [field, value] of Object.entries(step)) {
      assert.ok(value.trim(), `${trace.requirementId}: ${field} missing`);
    }
    assert.equal(existsSync(step.sourceFile), true, step.sourceFile);
    assert.equal(existsSync(step.test), true, step.test);
  }
}

assert.equal(
  listingPatchSchema.safeParse({
    title: "Safe title",
    profileId: "another-seller",
    status: "active",
  }).success,
  false,
  "listing patches must reject client ownership and status authority fields",
);

const routeSource = functionSource(
  read("src/app/api/listings/[id]/route.ts"),
  "PATCH",
);
for (const assertion of [
  "requireCurrentUserProfile()",
  "listingPatchSchema.parse(await readBoundedJsonRequest(request))",
  "updateListingForCurrentUser(current, id, parsed)",
  'jsonError(err, "Could not update listing")',
]) {
  assert.ok(routeSource.includes(assertion), assertion);
}
assert.ok(
  routeSource.indexOf("requireCurrentUserProfile()") <
    routeSource.indexOf("updateListingForCurrentUser(current, id, parsed)"),
  "server authentication must precede the listing update",
);

const serviceFile = read("src/lib/listing-service.ts");
const updateSource = functionSource(serviceFile, "updateListingForCurrentUser");
const ownerSource = functionSource(serviceFile, "getOwnedListing");
assert.ok(
  updateSource.indexOf("await getOwnedListing(current, listingId)") <
    updateSource.indexOf("tx.listing.update"),
  "owner resolution must precede every listing edit write",
);
assert.match(
  ownerSource,
  /where: \{ id: listingId, profileId: current\.profileId \}/,
);
assert.match(ownerSource, /throw new Error\("listing\.not_found"\)/);
assert.match(
  updateSource,
  /existing\.status === LISTING_STATUS_ACTIVE[\s\S]*LISTING_STATUS_PENDING_REVIEW/,
);
assert.match(updateSource, /auditListing\(current, "listing\.update", listing\.id\)/);

console.log(
  "Listing object authorization evidence passed: owner-scoped listing id, stored status authority, and authorized/foreign-owner edit traces verified",
);

function read(path: string) {
  return readFileSync(path, "utf8");
}

function functionSource(source: string, name: string) {
  const sourceFile = ts.createSourceFile(
    "listing-evidence.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let match: ts.FunctionDeclaration | undefined;
  const walk = (node: ts.Node) => {
    if (
      !match &&
      ts.isFunctionDeclaration(node) &&
      node.name?.text === name
    ) {
      match = node;
    }
    node.forEachChild(walk);
  };
  walk(sourceFile);
  assert.ok(match, `Missing function ${name}`);
  return match.getText(sourceFile);
}
