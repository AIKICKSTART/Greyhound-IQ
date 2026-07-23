import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

import { buildListingPatchPayload } from "./listing-edit-form";
import {
  PRODUCT_MARKETPLACE_EDIT_ROUTE_EVIDENCE_FILE,
  PRODUCT_MARKETPLACE_EDIT_ROUTE_EXPECTED_GAIN,
  PRODUCT_MARKETPLACE_EDIT_ROUTE_MASTER_EVIDENCE,
  PRODUCT_MARKETPLACE_EDIT_ROUTE_REQUIREMENT_IDS,
  PRODUCT_MARKETPLACE_EDIT_ROUTE_SCOPE,
  PRODUCT_MARKETPLACE_EDIT_ROUTE_TEST_FILE,
} from "./product-marketplace-edit-route-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-MARKETPLACE-EDIT-ROUTE

const REQUIREMENT_ID = "ROUTE.MARKET.edit-route" as const;
const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  ({ id }) => id === REQUIREMENT_ID,
);
assert.ok(requirement, REQUIREMENT_ID);
assert.equal(requirement.requirement, "Discover or create listing-edit routes.");
assert.deepEqual(PRODUCT_MARKETPLACE_EDIT_ROUTE_REQUIREMENT_IDS, [
  REQUIREMENT_ID,
]);
assert.equal(PRODUCT_MARKETPLACE_EDIT_ROUTE_EXPECTED_GAIN, 1);
assert.deepEqual(Object.keys(PRODUCT_MARKETPLACE_EDIT_ROUTE_MASTER_EVIDENCE), [
  REQUIREMENT_ID,
]);

const evidence = PRODUCT_MARKETPLACE_EDIT_ROUTE_MASTER_EVIDENCE[REQUIREMENT_ID];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_MARKETPLACE_EDIT_ROUTE_EVIDENCE_FILE,
  PRODUCT_MARKETPLACE_EDIT_ROUTE_TEST_FILE,
]);
assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
evidence.evidence.forEach((path) => assert.equal(existsSync(path), true, path));

assert.match(PRODUCT_MARKETPLACE_EDIT_ROUTE_SCOPE, /source and unit/i);
assert.match(PRODUCT_MARKETPLACE_EDIT_ROUTE_SCOPE, /owner-only/i);
assert.match(PRODUCT_MARKETPLACE_EDIT_ROUTE_SCOPE, /duplicate-click controls/i);
assert.match(PRODUCT_MARKETPLACE_EDIT_ROUTE_SCOPE, /does not prove hydrated/i);
assert.match(PRODUCT_MARKETPLACE_EDIT_ROUTE_SCOPE, /route-registry integration/i);

const payloadForm = new FormData();
payloadForm.set("title", "Updated listing title");
payloadForm.set(
  "description",
  "Updated listing description that remains within the server contract.",
);
payloadForm.set("contactPreference", "message");
payloadForm.set("price", "0");
assert.equal(buildListingPatchPayload(payloadForm).price, 0);

const pageSource = source("src/app/listings/[id]/edit/page.tsx");
const pageFunction = functionSource(pageSource, "ListingEditPage", ts.ScriptKind.TSX);
for (const assertion of [
  "const current = await requireListingEditorProfile(id)",
  'hasTier(current.tier, "pro")',
  "getOwnedListingForCurrentUser(current, id)",
  'error.message === "listing.not_found"',
  "notFound()",
  "<ListingEditForm",
]) {
  assert.ok(pageFunction.includes(assertion), assertion);
}
assert.match(pageSource, /robots: \{ index: false, follow: false \}/);

const aliasSource = source("src/app/marketplace/[id]/edit/page.tsx");
assert.match(aliasSource, /from "\.\.\/\.\.\/\.\.\/listings\/\[id\]\/edit\/page"/);
assert.match(aliasSource, /export default ListingEditPage/);

const detailSource = functionSource(
  source("src/app/listings/[id]/page.tsx"),
  "ListingDetailPage",
  ts.ScriptKind.TSX,
);
assert.match(detailSource, /href=\{`\/marketplace\/\$\{listing\.id\}\/edit`\}/);
assert.match(detailSource, /Edit listing/);

const formSource = source("src/components/listing-edit-form.tsx");
assert.equal(formSource.startsWith('"use client";'), true);
for (const assertion of [
  "if (requestInFlight.current) return",
  "requestInFlight.current = true",
  "buildListingPatchPayload(new FormData(event.currentTarget))",
  "`/api/listings/${encodeURIComponent(initial.id)}`",
  'method: "PATCH"',
  'disabled={status === "saving"}',
  'role="status"',
  'aria-live="polite"',
]) {
  assert.ok(formSource.includes(assertion), assertion);
}

const serviceSource = functionSource(
  source("src/lib/listing-service.ts"),
  "getOwnedListingForCurrentUser",
);
assert.match(serviceSource, /withDbRequestContext\(current/);
assert.match(serviceSource, /profileId: current\.profileId/);
assert.match(serviceSource, /throw new Error\("listing\.not_found"\)/);

const evidenceSource = source(PRODUCT_MARKETPLACE_EDIT_ROUTE_EVIDENCE_FILE);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Marketplace edit-route evidence passed in isolation: canonical and legacy owner-only edit routes, safe entry, bounded PATCH form, and explicit unproven runtime scope are ready for exact +1 central wiring.",
);

function source(path: string) {
  return readFileSync(path, "utf8");
}

function functionSource(value: string, name: string, kind = ts.ScriptKind.TS) {
  const sourceFile = ts.createSourceFile(
    "evidence.ts",
    value,
    ts.ScriptTarget.Latest,
    true,
    kind,
  );
  const match = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  assert.ok(match, `Missing function ${name}`);
  return match.getText(sourceFile);
}
