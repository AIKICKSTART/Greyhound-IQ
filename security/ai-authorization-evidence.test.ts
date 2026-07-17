import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  AI_AUTHORIZATION_EVIDENCE_SCOPE,
  AI_AUTHORIZATION_MASTER_EVIDENCE,
} from "./ai-authorization-evidence";

const routeSource = readFileSync("src/app/api/agents/[type]/run/route.ts", "utf8");
assert.ok(
  routeSource.indexOf("requireCurrentUserProfile()") <
    routeSource.indexOf("runAgentForCurrentUser(current"),
  "API AI execution must resolve the current user before service execution",
);
assert.match(routeSource, /checkRateLimit\(\s*`agent-run:\$\{current\.dbUserId\}`/);

const actionsSource = readFileSync("src/app/actions.ts", "utf8");
for (const [action, serviceCall] of [
  ["createAgentRun", "runAgentForCurrentUser(current"],
  ["generateDogCardAction", "generateDogCard(current"],
] as const) {
  const actionIndex = actionsSource.indexOf(`export async function ${action}`);
  const authIndex = actionsSource.indexOf("requireCurrentUserProfile()", actionIndex);
  const callIndex = actionsSource.indexOf(serviceCall, actionIndex);
  assert.ok(actionIndex >= 0 && authIndex > actionIndex && callIndex > authIndex);
}

const agentSource = readFileSync("src/lib/agent-service.ts", "utf8");
for (const marker of [
  "assertAgentTier(current, agentType)",
  "userId: current.dbUserId",
  "where: { id: contextId, userId, agentType }",
  "where: { userId: current.dbUserId }",
  "run.userId !== current.dbUserId",
]) {
  assert.ok(agentSource.includes(marker), `agent authorization marker drifted: ${marker}`);
}
assert.ok(!agentSource.includes("eval("));
assert.ok(!agentSource.includes("new Function("));
assert.ok(!agentSource.includes("tool.name]("));

const dogCardSource = readFileSync("src/lib/dog-card-service.ts", "utf8");
assert.ok(dogCardSource.includes("assertPaidFeatureAccess(current)"));
assert.ok(
  dogCardSource.includes(
    'where: { id: pageId, ownerProfileId: current.profileId, pageType: "dog" }',
  ),
);
assert.ok(dogCardSource.includes("actorId,"));
assert.ok(dogCardSource.includes("mediaId: { in: preferredIds }"));

for (const requirementId of Object.keys(AI_AUTHORIZATION_MASTER_EVIDENCE)) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: immutable requirement missing`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    AI_AUTHORIZATION_MASTER_EVIDENCE[
      requirementId as keyof typeof AI_AUTHORIZATION_MASTER_EVIDENCE
    ],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
}
assert.match(AI_AUTHORIZATION_EVIDENCE_SCOPE, /future model-driven tool dispatcher/i);

console.log("AI authorization passed: ordinary and current fixed-tool paths are user-bound");
