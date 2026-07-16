import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import { TRACE_IDENTIFIER_EXAMPLE_BINDINGS } from "./trace-identifier-example-evidence";
import {
  MANDATORY_LISTING_DRAFT_TRACE,
  MANDATORY_LISTING_DRAFT_TRACE_FACTS,
  MANDATORY_LISTING_DRAFT_TRACE_ID,
  MANDATORY_LISTING_DRAFT_TRACE_MASTER_EVIDENCE,
  MANDATORY_LISTING_DRAFT_TRACE_REQUIREMENT_ID,
  buildMandatoryListingDraftTraceMasterEvidence,
  type MandatoryListingDraftTraceFacts,
} from "./mandatory-listing-draft-trace-evidence";

const requirement = SECURITY_MASTER_REQUIREMENTS.find(
  ({ id }) => id === MANDATORY_LISTING_DRAFT_TRACE_REQUIREMENT_ID,
);
assert.ok(requirement, "immutable listing-draft trace requirement missing");
assert.equal(requirement.requirement, "Trace a seller creating a listing draft.");

const traceExample = TRACE_IDENTIFIER_EXAMPLE_BINDINGS.find(
  ({ traceId }) => traceId === MANDATORY_LISTING_DRAFT_TRACE_ID,
);
assert.ok(traceExample, "stable marketplace listing-create trace ID missing");
assert.equal(traceExample.action, "Create a marketplace listing");

const newListing = source("src/app/listings/new/page.tsx");
for (const marker of [
  "action={createListing}",
  'name="submissionIntent"',
  'value="draft"',
  "Save as draft",
]) {
  assert.ok(newListing.includes(marker), `frontend trace marker missing: ${marker}`);
}

const actions = source("src/app/actions.ts");
const schema = sourceBetween(actions, "const listingSchema =", "const listingArchiveSchema");
for (const marker of [
  'submissionIntent: z.enum(["draft", "review"])',
  "mediaIds: z.array",
  ".max(11)",
  "attributes: z",
  ".max(8)",
]) {
  assert.ok(schema.includes(marker), `draft schema marker missing: ${marker}`);
}
const action = functionSource(actions, "createListing");
assertOrdered(action, [
  "requireCurrentUserProfile()",
  "checkRateLimit(",
  "FAIL_CLOSED_RATE_LIMIT",
  "listingSchema.parse({",
  'submissionIntent: field(formData, "submissionIntent") || "review"',
  "createListingForCurrentUser(current, {",
  "submissionIntent: parsed.submissionIntent",
  'parsed.submissionIntent === "draft"',
  '"/account/listings/drafts?created=1"',
]);

const listingService = source("src/lib/listing-service.ts");
const service = functionSource(listingService, "createListingForCurrentUser");
assertOrdered(service, [
  "assertPaidFeatureAccess(current)",
  "assertDogListingAllowed(current, input)",
  "assertListingAcknowledgements(input)",
  "assertListingMediaAttachable(current, mediaIds)",
  'input.submissionIntent === "draft"',
  "withDbRequestContext(current, async (tx)",
  "tx.listing.create({",
  "status: nextStatus",
  "tx.listingStatusHistory.create({",
  '"Owner saved listing as draft"',
  'isDraft ? "listing.draft.create" : "listing.create"',
]);
assert.match(
  functionSource(listingService, "auditListing"),
  /createAuditLog\(\{[\s\S]*actorId: current\.dbUserId[\s\S]*targetType: "listing"[\s\S]*targetId: listingId/,
);

const rls = source(
  "prisma/migrations/20260706223000_add_rls_entitlement_policies/migration.sql",
);
assert.match(
  rls,
  /CREATE POLICY giq_listing_insert[\s\S]*public\.giq_is_pro\(\)[\s\S]*"profileId" = public\.giq_current_profile_id\(\)/,
);
assert.match(
  rls,
  /CREATE POLICY giq_listing_history_insert[\s\S]*public\.giq_is_pro\(\)[\s\S]*"actorProfileId" = public\.giq_current_profile_id\(\)/,
);

assert.equal(MANDATORY_LISTING_DRAFT_TRACE.traceId, "MARKETPLACE.LISTING.CREATE");
assert.equal(MANDATORY_LISTING_DRAFT_TRACE.trustBoundaries.length, 4);
assert.ok(MANDATORY_LISTING_DRAFT_TRACE.controls.length >= 7);
const evidence =
  MANDATORY_LISTING_DRAFT_TRACE_MASTER_EVIDENCE[
    MANDATORY_LISTING_DRAFT_TRACE_REQUIREMENT_ID
  ];
assert.equal(evidence?.status, "verified");
for (const path of evidence?.evidence ?? []) {
  assert.ok(existsSync(path), `missing listing-draft trace evidence: ${path}`);
}

for (const fact of Object.keys(
  MANDATORY_LISTING_DRAFT_TRACE_FACTS,
) as Array<keyof MandatoryListingDraftTraceFacts>) {
  const incomplete = { ...MANDATORY_LISTING_DRAFT_TRACE_FACTS, [fact]: false };
  assert.equal(
    buildMandatoryListingDraftTraceMasterEvidence(incomplete)[
      MANDATORY_LISTING_DRAFT_TRACE_REQUIREMENT_ID
    ],
    undefined,
    `${fact}: incomplete listing-draft trace must fail closed`,
  );
}

console.log(
  "Mandatory listing-draft trace passed: browser intent through authenticated validation, owner/entitlement controls, transactional draft/history persistence, RLS, audit and seller outcome.",
);

function source(path: string) {
  return readFileSync(path, "utf8");
}

function functionSource(value: string, name: string) {
  const file = ts.createSourceFile(
    "source.ts",
    value,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const match = file.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  assert.ok(match, `missing function: ${name}`);
  return match.getText(file);
}

function sourceBetween(value: string, start: string, end: string) {
  const startIndex = value.indexOf(start);
  const endIndex = value.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0, `missing start marker: ${start}`);
  assert.ok(endIndex > startIndex, `missing end marker: ${end}`);
  return value.slice(startIndex, endIndex);
}

function assertOrdered(value: string, markers: readonly string[]) {
  let offset = -1;
  for (const marker of markers) {
    const next = value.indexOf(marker, offset + 1);
    assert.ok(next > offset, `missing or out-of-order marker: ${marker}`);
    offset = next;
  }
}
