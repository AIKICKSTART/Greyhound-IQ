import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import { RATE_LIMITS } from "./rate-limits";
import {
  OPEN_SENSITIVE_BUSINESS_FLOW_GAPS,
  SENSITIVE_BUSINESS_FLOW_ACTION_BINDINGS,
  SENSITIVE_BUSINESS_FLOW_API_BINDINGS,
  SENSITIVE_BUSINESS_FLOW_MASTER_EVIDENCE,
  VERIFIED_SENSITIVE_BUSINESS_FLOW_IDS,
} from "./sensitive-business-flow-evidence";

const expectedIds = new Set(
  SECURITY_MASTER_REQUIREMENTS.filter(
    (requirement) => requirement.section === "sensitive-business-flow",
  ).map((requirement) => requirement.id),
);
const actionSource = readFileSync("src/app/actions.ts", "utf8");
const teamActionSource = readFileSync(
  "src/app/account/team/actions.ts",
  "utf8",
);
const rateLimitsByOperation = new Map(
  RATE_LIMITS.map((entry) => [`${entry.method} ${entry.route}`, entry]),
);

assert.equal(VERIFIED_SENSITIVE_BUSINESS_FLOW_IDS.length, 20);
assert.equal(new Set(VERIFIED_SENSITIVE_BUSINESS_FLOW_IDS).size, 20);
for (const requirementId of VERIFIED_SENSITIVE_BUSINESS_FLOW_IDS) {
  assert.ok(expectedIds.has(requirementId), `${requirementId}: requirement missing`);
  const apiBindings = SENSITIVE_BUSINESS_FLOW_API_BINDINGS[requirementId] ?? [];
  const actionBindings =
    SENSITIVE_BUSINESS_FLOW_ACTION_BINDINGS[requirementId] ?? [];
  assert.ok(
    apiBindings.length > 0 || actionBindings.length > 0,
    `${requirementId}: control binding missing`,
  );

  for (const operation of apiBindings) {
    const control = rateLimitsByOperation.get(operation);
    assert.ok(control, `${requirementId}: ${operation} missing rate-limit record`);
    assert.equal(control.limiterKind, "database-distributed", operation);
    assert.equal(control.failMode, "closed", operation);
    assert.ok(control.maximum > 0, operation);
    assert.ok(control.windowMilliseconds > 0, operation);
    assert.ok(existsSync(control.sourceFile), control.sourceFile);
  }

  for (const functionName of actionBindings) {
    const delegatedTeamLimiter =
      requirementId === "security.sensitive-business-flow.invitation-creation";
    const body = exportedActionBody(
      delegatedTeamLimiter ? teamActionSource : actionSource,
      functionName,
    );
    assert.match(body, /requireCurrentUserProfile\(\)/, functionName);
    if (delegatedTeamLimiter) {
      assert.match(body, /requireTeamRateLimit\(/, functionName);
      assertOrdered(body, [
        "requireCurrentUserProfile()",
        "await requireTeamRateLimit(",
        "await createOrganizationTeamInvitation(",
      ]);
    } else {
      assert.match(body, /checkRateLimit\(/, functionName);
      assert.match(body, /FAIL_CLOSED_RATE_LIMIT/, functionName);
      assert.match(body, /if \(!(?:rateLimit|rl)\.allowed\)/, functionName);
    }
  }

  const evidence = SENSITIVE_BUSINESS_FLOW_MASTER_EVIDENCE[requirementId];
  assert.equal(evidence?.status, "verified", requirementId);
  for (const path of evidence?.evidence ?? []) {
    assert.ok(existsSync(path), `${requirementId}: missing ${path}`);
  }
}

const teamLimiter = between(
  teamActionSource,
  "async function requireTeamRateLimit",
  "function teamActionErrorOutcome",
);
assert.match(teamLimiter, /checkRateLimit\(/);
assert.match(teamLimiter, /FAIL_CLOSED_RATE_LIMIT/);
assert.match(teamLimiter, /if \(!result\.allowed\)/);

const listingService = readFileSync("src/lib/listing-service.ts", "utf8");
const createListing = between(
  listingService,
  "export async function createListingForCurrentUser",
  "export async function updateListingForCurrentUser",
);
assert.match(createListing, /input\.submissionIntent === "draft"/);
assert.match(createListing, /\? LISTING_STATUS_DRAFT\s+: LISTING_STATUS_PENDING_REVIEW/);
assert.match(createListing, /status: nextStatus/);
assert.match(createListing, /moderationStatus: nextStatus/);
const approveListing = between(
  listingService,
  "export async function approveListingForModerator",
  "export async function rejectListingForModerator",
);
assertOrdered(approveListing, [
  "assertModerator(current)",
  "tx.listing.findUnique",
  "tx.listing.update",
  "status: LISTING_STATUS_ACTIVE",
  "reviewedById: current.profileId",
]);

assert.deepEqual(
  Object.keys(OPEN_SENSITIVE_BUSINESS_FLOW_GAPS).toSorted(),
  [...expectedIds]
    .filter(
      (id) =>
        !VERIFIED_SENSITIVE_BUSINESS_FLOW_IDS.includes(
          id as (typeof VERIFIED_SENSITIVE_BUSINESS_FLOW_IDS)[number],
        ),
    )
    .toSorted(),
  "every unverified sensitive flow must retain an explicit gap",
);

console.log(
  `Sensitive business-flow evidence passed: ${VERIFIED_SENSITIVE_BUSINESS_FLOW_IDS.length} fail-closed abuse controls; ${Object.keys(OPEN_SENSITIVE_BUSINESS_FLOW_GAPS).length} explicit gaps.`,
);

function exportedActionBody(source: string, functionName: string) {
  const start = source.indexOf(`export async function ${functionName}`);
  assert.ok(start >= 0, `${functionName}: action missing`);
  const next = source.indexOf("\nexport async function ", start + 1);
  return source.slice(start, next < 0 ? source.length : next);
}

function between(source: string, startMarker: string, endMarker: string) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `missing ${startMarker}`);
  assert.ok(end > start, `missing ${endMarker}`);
  return source.slice(start, end);
}

function assertOrdered(source: string, markers: readonly string[]) {
  let offset = -1;
  for (const marker of markers) {
    const next = source.indexOf(marker, offset + 1);
    assert.ok(next > offset, `missing/out-of-order ${marker}`);
    offset = next;
  }
}
