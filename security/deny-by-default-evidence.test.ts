import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import { assertSubscriptionStatusTransition } from "../src/lib/billing/subscription-state-machine";
import { canAccessMediaByOwnership } from "../src/lib/media-service";
import {
  canInviteTeamRole,
  resolveTeamAuthority,
} from "../src/lib/organization-team-policy";
import { assertPaidFeatureAccess, hasTier } from "../src/lib/tier-access";
import {
  DENY_BY_DEFAULT_EXPECTED_GAIN,
  DENY_BY_DEFAULT_MASTER_EVIDENCE,
  DENY_BY_DEFAULT_REQUIREMENT_IDS,
} from "./deny-by-default-evidence";

const requirementIds = new Set(
  SECURITY_MASTER_REQUIREMENTS.map((requirement) => requirement.id),
);

assert.equal(DENY_BY_DEFAULT_REQUIREMENT_IDS.length, 7);
assert.equal(DENY_BY_DEFAULT_EXPECTED_GAIN, 7);
assert.deepEqual(
  Object.keys(DENY_BY_DEFAULT_MASTER_EVIDENCE).toSorted(),
  [...DENY_BY_DEFAULT_REQUIREMENT_IDS].toSorted(),
);
for (const requirementId of DENY_BY_DEFAULT_REQUIREMENT_IDS) {
  assert.ok(requirementIds.has(requirementId), `${requirementId}: immutable requirement missing`);
  assert.equal(DENY_BY_DEFAULT_MASTER_EVIDENCE[requirementId].status, "verified");
}

assert.equal(
  resolveTeamAuthority({
    actorUserId: "member",
    organizationOwnerId: "owner",
    membership: null,
  }),
  "none",
);
assert.equal(
  resolveTeamAuthority({
    actorUserId: "removed-admin",
    organizationOwnerId: "owner",
    membership: { role: "admin", status: "removed" },
  }),
  "none",
);
assert.equal(canInviteTeamRole("none", "member"), false);

assert.equal(canAccessMediaByOwnership("owner", null), false);
assert.equal(canAccessMediaByOwnership("owner", { dbUserId: "other" }), false);
assert.equal(canAccessMediaByOwnership("owner", { dbUserId: "owner" }), true);

assert.equal(hasTier(null, "pro"), false);
assert.equal(hasTier("forged-tier", "pro"), false);
assert.throws(
  () => assertPaidFeatureAccess({ tier: "free" }),
  /payment\.required/,
);

assert.throws(
  () =>
    assertSubscriptionStatusTransition({
      provider: "lago",
      previousStatus: "active",
      nextStatus: "pending",
    }),
  /billing\.subscription_transition_illegal:lago/,
);
assert.throws(
  () =>
    assertSubscriptionStatusTransition({
      provider: "lago",
      previousStatus: null,
      nextStatus: "forged-state",
    }),
  /billing\.subscription_status_unknown:lago/,
);

const listingService = read("src/lib/listing-service.ts");
assert.match(listingService, /profileId: current\.profileId, status: "approved"/);
assert.match(listingService, /if \(requireOwnership && !\(await owns\(input\.dogId\)\)\)/);
assert.match(listingService, /throw new Error\("listing\.dog_not_owned"\)/);

const conversationService = read("src/lib/conversation-service.ts");
assert.match(
  conversationService,
  /where: \{\s*id: conversationId,\s*OR: \[\s*\{ participantAId: current\.profileId \},\s*\{ participantBId: current\.profileId \}/,
);
assert.match(
  conversationService,
  /getConversationForProfile\(\s*current,\s*conversationId,\s*\);\s*assertNotBlocked\(conversation\.blockedById\);\s*[\s\S]*assertProfilesCanInteract\(current\.profileId, recipientId\);/,
);

const teamService = read("src/lib/organization-team-service.ts");
const policyDecision = teamService.indexOf("if (!canInviteTeamRole(authority, input.role))");
const firstInvitationWrite = teamService.indexOf("tx.organizationInvitation.updateMany");
assert.ok(policyDecision >= 0, "team invitation policy decision must exist");
assert.ok(firstInvitationWrite >= 0, "team invitation persistence must exist");
assert.ok(
  policyDecision < firstInvitationWrite,
  "team invitation lookup must not grant permission before the authority decision",
);

console.log("deny-by-default evidence passed: seven bounded authorization controls verified");

function read(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}
