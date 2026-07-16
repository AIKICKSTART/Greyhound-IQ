import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

import {
  PRODUCT_MARKETPLACE_DRAFT_ARCHIVE_EVIDENCE_FILE,
  PRODUCT_MARKETPLACE_DRAFT_ARCHIVE_EXPECTED_GAIN,
  PRODUCT_MARKETPLACE_DRAFT_ARCHIVE_MASTER_EVIDENCE,
  PRODUCT_MARKETPLACE_DRAFT_ARCHIVE_REQUIREMENT_IDS,
  PRODUCT_MARKETPLACE_DRAFT_ARCHIVE_SCOPE,
  PRODUCT_MARKETPLACE_DRAFT_ARCHIVE_TEST_FILE,
} from "./product-marketplace-draft-archive-evidence";
import { PRODUCT_MASTER_EVIDENCE } from "./master-audit-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-MARKETPLACE-DRAFT-ARCHIVE

const EXPECTED_REQUIREMENTS = {
  "ROUTE.MARKET.draft": "Support creating a draft.",
  "ROUTE.MARKET.archive": "Support archiving.",
} as const;

assert.deepEqual(
  PRODUCT_MARKETPLACE_DRAFT_ARCHIVE_REQUIREMENT_IDS,
  Object.keys(EXPECTED_REQUIREMENTS),
);
assert.equal(PRODUCT_MARKETPLACE_DRAFT_ARCHIVE_EXPECTED_GAIN, 2);
assert.deepEqual(
  Object.keys(PRODUCT_MARKETPLACE_DRAFT_ARCHIVE_MASTER_EVIDENCE),
  Object.keys(EXPECTED_REQUIREMENTS),
);

for (const [id, requirementText] of Object.entries(EXPECTED_REQUIREMENTS)) {
  const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
    (candidate) => candidate.id === id,
  );
  assert.ok(requirement, id);
  assert.equal(requirement.requirement, requirementText);
  const evidence =
    PRODUCT_MARKETPLACE_DRAFT_ARCHIVE_MASTER_EVIDENCE[
      id as keyof typeof PRODUCT_MARKETPLACE_DRAFT_ARCHIVE_MASTER_EVIDENCE
    ];
  assert.equal(evidence.status, "tested");
  assert.deepEqual(PRODUCT_MASTER_EVIDENCE[id], evidence);
  assert.deepEqual(evidence.evidence.slice(0, 2), [
    PRODUCT_MARKETPLACE_DRAFT_ARCHIVE_EVIDENCE_FILE,
    PRODUCT_MARKETPLACE_DRAFT_ARCHIVE_TEST_FILE,
  ]);
  assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
  evidence.evidence.forEach((path) => assert.equal(existsSync(path), true, path));
}

assert.match(PRODUCT_MARKETPLACE_DRAFT_ARCHIVE_SCOPE, /authenticated listing owners/i);
assert.match(PRODUCT_MARKETPLACE_DRAFT_ARCHIVE_SCOPE, /explicitly confirm/i);
assert.match(PRODUCT_MARKETPLACE_DRAFT_ARCHIVE_SCOPE, /allowlisted lifecycle transitions/i);
assert.match(PRODUCT_MARKETPLACE_DRAFT_ARCHIVE_SCOPE, /does not prove a deployed database mutation/i);

const actionsSource = source("src/app/actions.ts");
const createAction = functionSource(actionsSource, "createListing");
for (const assertion of [
  'submissionIntent: field(formData, "submissionIntent") || "review"',
  "submissionIntent: parsed.submissionIntent",
  'parsed.submissionIntent === "draft"',
  '"/account/listings/drafts?created=1"',
]) {
  assert.ok(createAction.includes(assertion), assertion);
}

const submitDraftAction = functionSource(actionsSource, "submitListingForReview");
for (const assertion of [
  "requireCurrentUserProfile()",
  "submitDraftListingForCurrentUser(current, listingId)",
  'revalidatePath("/account/listings/drafts")',
]) {
  assert.ok(submitDraftAction.includes(assertion), assertion);
}

const archiveAction = functionSource(actionsSource, "archiveListing");
for (const assertion of [
  "requireCurrentUserProfile()",
  "listingArchiveSchema.parse",
  "archiveListingForCurrentUser(current, listingId)",
  'revalidatePath("/account/listings/archived")',
]) {
  assert.ok(archiveAction.includes(assertion), assertion);
}

const serviceSource = source("src/lib/listing-service.ts");
const createService = functionSource(serviceSource, "createListingForCurrentUser");
for (const assertion of [
  'input.submissionIntent === "draft"',
  "status: nextStatus",
  "moderationStatus: nextStatus",
  '"listing.draft.create"',
]) {
  assert.ok(createService.includes(assertion), assertion);
}

const submitDraftService = functionSource(
  serviceSource,
  "submitDraftListingForCurrentUser",
);
for (const assertion of [
  "getOwnedListing(current, listingId)",
  "existing.status !== LISTING_STATUS_DRAFT",
  "!existing.welfareAcknowledgedAt || !existing.legalAcknowledgedAt",
  "status: LISTING_STATUS_PENDING_REVIEW",
  "listingStatusHistory.create",
  '"listing.draft.submit"',
]) {
  assert.ok(submitDraftService.includes(assertion), assertion);
}

const archiveService = functionSource(
  serviceSource,
  "archiveListingForCurrentUser",
);
for (const assertion of [
  "getOwnedListing(current, listingId)",
  "ARCHIVE_ALLOWED_FROM_STATUSES.includes(existing.status)",
  "status: LISTING_STATUS_ARCHIVED",
  "archivedAt",
  "listingStatusHistory.create",
  '"listing.archive"',
]) {
  assert.ok(archiveService.includes(assertion), assertion);
}

const newListingSource = source("src/app/listings/new/page.tsx");
for (const assertion of [
  'name="submissionIntent"',
  'value="review"',
  'value="draft"',
  "Submit for review",
  "Save as draft",
]) {
  assert.ok(newListingSource.includes(assertion), assertion);
}

const detailSource = source("src/app/listings/[id]/page.tsx");
for (const assertion of [
  "submitListingForReview.bind(null, listing.id)",
  "archiveListing.bind(null, listing.id)",
  'listing.status === "draft"',
  'name="confirmation"',
  'value="archive"',
  "Confirm this listing should leave active inventory.",
  "Submit for review",
  "Archive",
]) {
  assert.ok(detailSource.includes(assertion), assertion);
}

const evidenceSource = source(PRODUCT_MARKETPLACE_DRAFT_ARCHIVE_EVIDENCE_FILE);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Marketplace draft/archive evidence passed in isolation: owner-scoped draft creation, draft submission, explicit archive confirmation, lifecycle history and audit events are ready for exact +2 central wiring.",
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
