import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  AGENT_MINIMUM_TIER,
  AGENT_OUTPUT_DISCLAIMER,
  AGENT_PRODUCT_CATALOGUE,
} from "../lib/agent-product-catalogue";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "./master-audit-requirements";
import { PRODUCT_MASTER_EVIDENCE } from "./master-audit-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_AI_TRUTH_EVIDENCE_FILE,
  PRODUCT_AI_TRUTH_EVIDENCE_SCOPE,
  PRODUCT_AI_TRUTH_EXPECTED_GAIN,
  PRODUCT_AI_TRUTH_MASTER_EVIDENCE,
  PRODUCT_AI_TRUTH_OPEN_GAPS,
  PRODUCT_AI_TRUTH_OPEN_REQUIREMENT_IDS,
  PRODUCT_AI_TRUTH_REQUIREMENT_IDS,
  PRODUCT_AI_TRUTH_TEST_FILE,
} from "./product-ai-truth-evidence";

const completedIds = [...PRODUCT_AI_TRUTH_REQUIREMENT_IDS];
const intentionallyOpenIds = [...PRODUCT_AI_TRUTH_OPEN_REQUIREMENT_IDS];

assert.equal(completedIds.length, 6);
assert.equal(new Set(completedIds).size, completedIds.length);
assert.equal(intentionallyOpenIds.length, 4);
assert.equal(PRODUCT_AI_TRUTH_EXPECTED_GAIN, 6);
assert.deepEqual(Object.keys(PRODUCT_AI_TRUTH_MASTER_EVIDENCE), completedIds);

const aiRequirements = PRODUCT_MASTER_REQUIREMENTS.filter(({ id }) =>
  id.startsWith("ROUTE.AI."),
);
const preExistingCompletedIds = ["ROUTE.AI.agents"] as const;
assert.equal(aiRequirements.length, 11);
assert.deepEqual(
  [...completedIds, ...intentionallyOpenIds, ...preExistingCompletedIds].toSorted(),
  aiRequirements.map(({ id }) => id).toSorted(),
  "The completed gates, explicit residuals and registered /agents gate must partition ROUTE.AI",
);

const productRequirementIds = new Set(
  PRODUCT_MASTER_REQUIREMENTS.map(({ id }) => id),
);
for (const requirementId of completedIds) {
  assert.equal(productRequirementIds.has(requirementId), true, requirementId);
  const record = PRODUCT_AI_TRUTH_MASTER_EVIDENCE[requirementId];
  assert.equal(record.status, "tested", requirementId);
  assert.deepEqual(record.evidence.slice(0, 2), [
    PRODUCT_AI_TRUTH_EVIDENCE_FILE,
    PRODUCT_AI_TRUTH_TEST_FILE,
  ]);
  assert.equal(new Set(record.evidence).size, record.evidence.length);
  assert.equal(
    record.evidence.some((path) => path.startsWith("output/")),
    false,
    `${requirementId} must not depend on stale browser output`,
  );
  for (const evidencePath of record.evidence) {
    assert.equal(existsSync(evidencePath), true, evidencePath);
  }
  assert.deepEqual(PRODUCT_MASTER_EVIDENCE[requirementId], record);
}

for (const requirementId of intentionallyOpenIds) {
  assert.equal(
    requirementId in PRODUCT_AI_TRUTH_MASTER_EVIDENCE,
    false,
    `${requirementId} must remain open`,
  );
  assert.ok(
    PRODUCT_AI_TRUTH_OPEN_GAPS[requirementId].length > 140,
    `${requirementId} needs a precise residual-gap explanation`,
  );
}

const evidenceSource = readFileSync(PRODUCT_AI_TRUTH_EVIDENCE_FILE, "utf8");
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(PRODUCT_AI_TRUTH_EVIDENCE_SCOPE, /current \/agents surface/i);
assert.match(PRODUCT_AI_TRUTH_EVIDENCE_SCOPE, /current agent surface only/i);
assert.match(PRODUCT_AI_TRUTH_EVIDENCE_SCOPE, /does not prove provider or prompt internals/i);
assert.match(PRODUCT_AI_TRUTH_EVIDENCE_SCOPE, /future tool-execution authorization/i);
assert.match(PRODUCT_AI_TRUTH_EVIDENCE_SCOPE, /production readiness/i);

assert.deepEqual(
  AGENT_PRODUCT_CATALOGUE.map(({ type }) => type),
  ["race_analyst", "breeding_advisor", "form_reader"],
);
assert.deepEqual(AGENT_MINIMUM_TIER, {
  race_analyst: "pro",
  breeding_advisor: "pro_plus",
  form_reader: "pro",
});
assert.ok(AGENT_OUTPUT_DISCLAIMER.length > 160);
for (const agent of AGENT_PRODUCT_CATALOGUE) {
  assert.ok(agent.capability.length > 80, agent.type);
  assert.ok(agent.limitation.length > 130, agent.type);
}
assert.doesNotMatch(
  AGENT_PRODUCT_CATALOGUE.find(({ type }) => type === "race_analyst")!
    .capability,
  /probabilit|confidence|sectional|track bias|strike rate/i,
);
assert.match(
  AGENT_PRODUCT_CATALOGUE.find(({ type }) => type === "breeding_advisor")!
    .limitation,
  /not a full coefficient-of-inbreeding calculation/i,
);
assert.match(
  AGENT_PRODUCT_CATALOGUE.find(({ type }) => type === "form_reader")!
    .limitation,
  /unmatched dog returns no match/i,
);

const pageSource = readFileSync("src/app/agents/page.tsx", "utf8");
const demoSource = readFileSync(
  "src/components/agent-demo-console.tsx",
  "utf8",
);
const proGateSource = readFileSync("src/components/pro-gate.tsx", "utf8");
const serviceSource = readFileSync("src/lib/agent-service.ts", "utf8");
const actionsSource = readFileSync("src/app/actions.ts", "utf8");
const runRouteSource = readFileSync(
  "src/app/api/agents/[type]/run/route.ts",
  "utf8",
);
const getRouteSource = readFileSync(
  "src/app/api/agents/runs/[id]/route.ts",
  "utf8",
);
const cancelRouteSource = readFileSync(
  "src/app/api/agents/runs/[id]/cancel/route.ts",
  "utf8",
);
const contextRouteSource = readFileSync(
  "src/app/api/agents/context/route.ts",
  "utf8",
);

assert.match(pageSource, /AGENT_PRODUCT_CATALOGUE\.map/);
assert.match(pageSource, /agent\.capability/);
assert.match(pageSource, /agent\.limitation/);
assert.match(pageSource, /<ProGate minTier="pro"/);
assert.match(pageSource, /!hasTier\(user\.tier, agent\.minimumTier\)/);
assert.match(pageSource, /disabled=\{unavailable\}/);
assert.match(pageSource, /Breeding Advisor\s+requires Pro\+/);
assert.match(pageSource, /pending, but it is never executed automatically/);
assert.match(pageSource, /does not publish content, edit racing records/);
assert.match(pageSource, /AGENT_OUTPUT_DISCLAIMER/);
assert.doesNotMatch(pageSource, /\bModerator\b/);
assert.doesNotMatch(pageSource, /AGENT_CARDS/);

assert.match(proGateSource, /const isUnavailable = minTier === "pro_plus"/);
assert.match(
  proGateSource,
  /isUnavailable \? "See available plans" : `See \$\{tierName\} plans`/,
);
assert.doesNotMatch(proGateSource, /coming soon|isComingSoon/i);

assert.match(demoSource, /AGENT_PRODUCT_CATALOGUE\.map/);
assert.match(demoSource, /Synthetic preview/);
assert.match(demoSource, /without running the live agent/);
assert.match(demoSource, /AGENT_OUTPUT_DISCLAIMER/);
assert.doesNotMatch(demoSource, /\bModerator\b/);
assert.doesNotMatch(demoSource, /inside bias is active/i);
assert.doesNotMatch(demoSource, /low COI range/i);
assert.doesNotMatch(demoSource, /reliable box manners/i);

assert.match(serviceSource, /export const AGENT_TIER = AGENT_MINIMUM_TIER/);
assert.equal(
  [...serviceSource.matchAll(/disclaimer: AGENT_OUTPUT_DISCLAIMER/g)].length,
  3,
);
assert.match(serviceSource, /Not calculated; shared parent detected/);
assert.match(serviceSource, /\) \?\? null;/);
assert.doesNotMatch(serviceSource, /\?\? candidates\[0\]/);

function sourceSlice(start: string, end: string) {
  const startIndex = serviceSource.indexOf(start);
  const endIndex = serviceSource.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0, start);
  assert.ok(endIndex > startIndex, end);
  return serviceSource.slice(startIndex, endIndex);
}

const outputBuilders = [
  sourceSlice("async function buildRaceAnalystOutput", "async function buildBreedingAdvisorOutput"),
  sourceSlice("async function buildBreedingAdvisorOutput", "async function buildFormReaderOutput"),
  sourceSlice("async function buildFormReaderOutput", "async function createMemoryFromAgentInput"),
];
for (const builderSource of outputBuilders) {
  assert.doesNotMatch(
    builderSource,
    /\.(?:create|update|updateMany|delete|deleteMany|upsert)\s*\(/,
    "Agent output builders must remain read-only",
  );
  assert.match(builderSource, /disclaimer: AGENT_OUTPUT_DISCLAIMER/);
}

const runSource = sourceSlice(
  "export async function runAgentForCurrentUser",
  "export async function listAgentRunsForCurrentUser",
);
assert.ok(
  runSource.indexOf("assertAgentTier(current, agentType)") <
    runSource.indexOf("tx.agentRun.create"),
  "Tier authorization must precede run creation",
);
assert.match(runSource, /userId: current\.dbUserId/);
assert.match(runSource, /createMemoryFromAgentInput\(\s*current\.dbUserId/);
assert.match(runSource, /recordUsageEvent/);
assert.match(runSource, /createAuditLog/);

const contextSource = sourceSlice(
  "async function getOrCreateConversationContext",
  "async function buildAgentOutput",
);
assert.match(contextSource, /where: \{ id: contextId, userId, agentType \}/);
assert.match(contextSource, /where: \{ userId_agentType: \{ userId, agentType \} \}/);

const ownedRunSource = sourceSlice(
  "export async function getAgentRunForCurrentUser",
  "export async function cancelAgentRunForCurrentUser",
);
assert.match(ownedRunSource, /run\.userId !== current\.dbUserId/);
assert.match(serviceSource, /const run = await getAgentRunForCurrentUser\(current, runId\)/);

assert.match(actionsSource, /export async function createAgentRun/);
assert.match(actionsSource, /const current = await requireCurrentUserProfile\(\)/);
assert.match(actionsSource, /agentFormSchema\.parse/);
assert.match(actionsSource, /runAgentForCurrentUser\(current, agentType/);

for (const routeSource of [
  runRouteSource,
  getRouteSource,
  cancelRouteSource,
  contextRouteSource,
]) {
  assert.match(routeSource, /requireCurrentUserProfile\(\)/);
}
assert.match(runRouteSource, /checkRateLimit/);
assert.match(runRouteSource, /agentRunSchema\.parse/);
assert.match(runRouteSource, /runAgentForCurrentUser\(current, agentType, parsed\)/);
assert.match(getRouteSource, /getAgentRunForCurrentUser\(current, id\)/);
assert.match(cancelRouteSource, /cancelAgentRunForCurrentUser\(current, id\)/);
assert.match(contextRouteSource, /getAgentContextForCurrentUser\(current, agentType\)/);

const selectedIdSet = new Set<string>(completedIds);
const currentCompleted = MASTER_AUDIT_REQUIREMENTS.filter(
  isMasterRequirementComplete,
).length;
const withoutThisBatch = MASTER_AUDIT_REQUIREMENTS.map((requirement) =>
  selectedIdSet.has(requirement.id)
    ? { ...requirement, status: "not-started", evidence: [] }
    : requirement,
).filter(isMasterRequirementComplete).length;
assert.equal(
  currentCompleted - withoutThisBatch,
  PRODUCT_AI_TRUTH_EXPECTED_GAIN,
  "This isolated evidence batch must add exactly six completed requirements",
);

console.log(
  "Product AI truth evidence passed: 3 supported agents, exact tiers, disclosed heuristics/artifact writes, 6 gates closed; 4 gaps remain open.",
);
