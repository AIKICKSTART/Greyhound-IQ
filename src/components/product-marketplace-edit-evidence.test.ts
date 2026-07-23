import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

import { listingPatchSchema } from "../lib/listing-validation";
import {
  PRODUCT_MARKETPLACE_EDIT_EVIDENCE_FILE,
  PRODUCT_MARKETPLACE_EDIT_EXPECTED_GAIN,
  PRODUCT_MARKETPLACE_EDIT_MASTER_EVIDENCE,
  PRODUCT_MARKETPLACE_EDIT_REQUIREMENT_IDS,
  PRODUCT_MARKETPLACE_EDIT_SCOPE,
  PRODUCT_MARKETPLACE_EDIT_TEST_FILE,
} from "./product-marketplace-edit-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-MARKETPLACE-EDIT

const REQUIREMENT_ID = "ROUTE.MARKET.edit" as const;
const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  ({ id }) => id === REQUIREMENT_ID,
);
assert.ok(requirement, REQUIREMENT_ID);
assert.equal(requirement.requirement, "Support editing.");
assert.deepEqual(PRODUCT_MARKETPLACE_EDIT_REQUIREMENT_IDS, [REQUIREMENT_ID]);
assert.equal(PRODUCT_MARKETPLACE_EDIT_EXPECTED_GAIN, 1);
assert.deepEqual(Object.keys(PRODUCT_MARKETPLACE_EDIT_MASTER_EVIDENCE), [
  REQUIREMENT_ID,
]);

const evidence = PRODUCT_MARKETPLACE_EDIT_MASTER_EVIDENCE[REQUIREMENT_ID];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_MARKETPLACE_EDIT_EVIDENCE_FILE,
  PRODUCT_MARKETPLACE_EDIT_TEST_FILE,
]);
assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
evidence.evidence.forEach((path) => assert.equal(existsSync(path), true, path));

assert.match(PRODUCT_MARKETPLACE_EDIT_SCOPE, /source and unit/i);
assert.match(PRODUCT_MARKETPLACE_EDIT_SCOPE, /strict bounded patch schema/i);
assert.match(PRODUCT_MARKETPLACE_EDIT_SCOPE, /server-side/i);
assert.match(PRODUCT_MARKETPLACE_EDIT_SCOPE, /fraud gates/i);
assert.match(PRODUCT_MARKETPLACE_EDIT_SCOPE, /does not prove a browser edit screen/i);
assert.match(PRODUCT_MARKETPLACE_EDIT_SCOPE, /separate edit-route requirement/i);

assert.equal(listingPatchSchema.safeParse({}).success, false);
assert.deepEqual(listingPatchSchema.parse({ negotiable: true }), {
  negotiable: true,
});
assert.equal(
  listingPatchSchema.safeParse({ title: "Updated listing", unknown: true })
    .success,
  false,
);

const routeSource = functionSource(
  source("src/app/api/listings/[id]/route.ts"),
  "PATCH",
);
for (const assertion of [
  "requireCurrentUserProfile()",
  "`listing:update:${current.dbUserId}:${id}`",
  "rateLimitExceededResponse(",
  "listingPatchSchema.parse(await readBoundedJsonRequest(request))",
  "updateListingForCurrentUser(current, id, parsed)",
  'jsonError(err, "Could not update listing")',
]) {
  assert.ok(routeSource.includes(assertion), assertion);
}

const serviceSource = functionSource(
  source("src/lib/listing-service.ts"),
  "updateListingForCurrentUser",
);
for (const assertion of [
  "const existing = await getOwnedListing(current, listingId)",
  "if (isDogListingType(nextType))",
  "await assertDogListingAllowed(current, {",
  "await assertListingMediaAttachable(current, input.mediaIds)",
  "status: nextStatus",
  "tx.listingStatusHistory.create",
  'await auditListing(current, "listing.update", listing.id)',
]) {
  assert.ok(serviceSource.includes(assertion), assertion);
}
assert.match(serviceSource, /existing\.status === LISTING_STATUS_ACTIVE/);
assert.match(serviceSource, /LISTING_STATUS_PENDING_REVIEW/);

const evidenceSource = source(PRODUCT_MARKETPLACE_EDIT_EVIDENCE_FILE);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Marketplace edit evidence passed in isolation: strict non-empty authenticated PATCH, owner enforcement, dog fraud revalidation, moderation transition and audit are ready for exact +1 central wiring; the edit-screen route remains open.",
);

function source(path: string) {
  return readFileSync(path, "utf8");
}

function functionSource(value: string, name: string) {
  const sourceFile = ts.createSourceFile(
    "evidence.ts",
    value,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const match = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  assert.ok(match, `Missing function ${name}`);
  return match.getText(sourceFile);
}
