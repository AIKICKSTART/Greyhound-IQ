import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { discoverRouteHandlers } from "../../security/endpoints";
import { AGENT_PRODUCT_CATALOGUE } from "../lib/agent-product-catalogue";
import { SCREEN_CONTRACT_BY_ROUTE } from "./demo-experience-registry";
import {
  PRODUCT_AI_ROUTE_INVENTORY_EVIDENCE_FILE,
  PRODUCT_AI_ROUTE_INVENTORY_EXPECTED_GAIN,
  PRODUCT_AI_ROUTE_INVENTORY_MASTER_EVIDENCE,
  PRODUCT_AI_ROUTE_INVENTORY_REQUIREMENT_IDS,
  PRODUCT_AI_ROUTE_INVENTORY_SCOPE,
  PRODUCT_AI_ROUTE_INVENTORY_TEST_FILE,
} from "./product-ai-route-inventory-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-AI-ROUTE-INVENTORY-EVIDENCE

const EXPECTED_SCREEN_ROUTES = [
  "/account",
  "/account/billing",
  "/admin/jobs",
  "/agents",
] as const;
const EXPECTED_API_METHODS = [
  ["POST", "/api/agents/[type]/run"],
  ["GET", "/api/agents/context"],
  ["GET", "/api/agents/runs"],
  ["GET", "/api/agents/runs/[id]"],
  ["POST", "/api/agents/runs/[id]/cancel"],
  ["POST", "/api/internal/memory-decay"],
  ["GET", "/api/memory"],
  ["POST", "/api/memory"],
  ["DELETE", "/api/memory/[id]"],
  ["GET", "/api/memory/[id]"],
  ["POST", "/api/memory/[id]/supersede"],
] as const;

assert.deepEqual(PRODUCT_AI_ROUTE_INVENTORY_REQUIREMENT_IDS, [
  "ROUTE.AI.related-routes",
]);
assert.equal(PRODUCT_AI_ROUTE_INVENTORY_EXPECTED_GAIN, 1);
assert.deepEqual(Object.keys(PRODUCT_AI_ROUTE_INVENTORY_MASTER_EVIDENCE), [
  "ROUTE.AI.related-routes",
]);

const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  ({ id }) => id === "ROUTE.AI.related-routes",
);
assert.ok(requirement);
assert.match(requirement.requirement, /tool, agent, session, history, and configuration routes/i);

const evidence =
  PRODUCT_AI_ROUTE_INVENTORY_MASTER_EVIDENCE["ROUTE.AI.related-routes"];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_AI_ROUTE_INVENTORY_EVIDENCE_FILE,
  PRODUCT_AI_ROUTE_INVENTORY_TEST_FILE,
]);
assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
evidence.evidence.forEach((evidencePath) =>
  assert.equal(existsSync(evidencePath), true, evidencePath),
);

const evidenceSource = readFileSync(
  PRODUCT_AI_ROUTE_INVENTORY_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(PRODUCT_AI_ROUTE_INVENTORY_SCOPE, /four AI-related user and operator screens/i);
assert.match(PRODUCT_AI_ROUTE_INVENTORY_SCOPE, /eleven agent, memory, and maintenance API method records/i);
assert.match(PRODUCT_AI_ROUTE_INVENTORY_SCOPE, /no unsupported standalone session, history, or configuration page/i);
assert.match(PRODUCT_AI_ROUTE_INVENTORY_SCOPE, /does not prove live execution/i);
assert.match(PRODUCT_AI_ROUTE_INVENTORY_SCOPE, /production readiness/i);

for (const route of EXPECTED_SCREEN_ROUTES) {
  const screen = SCREEN_CONTRACT_BY_ROUTE.get(route);
  assert.ok(screen, `${route} must be registered`);
  assert.equal(screen.productionEnabled, true, route);
  assert.equal(existsSync(screen.sourceFiles[0]), true, screen.sourceFiles[0]);
}

const agentsSource = readFileSync("src/app/agents/page.tsx", "utf8");
for (const assertion of [
  "AGENT_PRODUCT_CATALOGUE.map",
  "Run an agent",
  "Recent agent runs",
  "getAgentRunPresentation",
  "AgentRunCancelButton",
  "createAgentRun",
]) {
  assert.equal(agentsSource.includes(assertion), true, assertion);
}
assert.equal(
  walkFiles("src/app/agents").filter((file) => file.endsWith("/page.tsx"))
    .length,
  1,
  "Agent configuration and history must remain one deliberate registered screen until a separate page exists",
);

const adminJobsSource = readFileSync("src/app/admin/jobs/page.tsx", "utf8");
assert.match(adminJobsSource, /AgentRunUsageSection/);
assert.match(adminJobsSource, /without prompts or outputs/i);
const accountSource = readFileSync("src/app/account/page.tsx", "utf8");
assert.match(accountSource, /agent runs/i);
const billingSource = readFileSync("src/app/account/billing/page.tsx", "utf8");
assert.match(billingSource, /agent_runs_per_month/);

assert.equal(AGENT_PRODUCT_CATALOGUE.length, 3);
assert.equal(
  new Set(AGENT_PRODUCT_CATALOGUE.map(({ type }) => type)).size,
  AGENT_PRODUCT_CATALOGUE.length,
);
for (const agent of AGENT_PRODUCT_CATALOGUE) {
  assert.ok(agent.type.trim(), "agent type");
  assert.ok(agent.capability.trim(), `${agent.type} capability`);
  assert.ok(agent.limitation.trim(), `${agent.type} limitation`);
}

const discoveredApiMethods = discoverRouteHandlers(".")
  .filter(
    ({ route }) =>
      route.startsWith("/api/agents") ||
      route.startsWith("/api/memory") ||
      route === "/api/internal/memory-decay",
  )
  .map(({ method, route }) => [method, route] as const)
  .toSorted(([leftMethod, leftRoute], [rightMethod, rightRoute]) =>
    leftRoute.localeCompare(rightRoute) || leftMethod.localeCompare(rightMethod),
  );
assert.deepEqual(discoveredApiMethods, EXPECTED_API_METHODS);

const actionsSource = readFileSync("src/app/actions.ts", "utf8");
assert.match(actionsSource, /export async function createAgentRun/);
assert.match(actionsSource, /runAgentForCurrentUser/);

const document = readFileSync("docs/product/ai-route-inventory.md", "utf8");
for (const route of EXPECTED_SCREEN_ROUTES) assert.ok(document.includes(`\`${route}\``));
for (const [method, route] of EXPECTED_API_METHODS) {
  assert.ok(document.includes(`\`${method}\` | \`${route}\``), `${method} ${route}`);
}
assert.match(document, /does not currently expose separate agent-session, agent-history, or agent-configuration pages/i);
assert.match(document, /does not prove live execution/i);

console.log(
  "AI route inventory evidence passed in isolation: 4 registered screens, 11 API method records, 1 server action, and 3 supported agents; exact +1 central wiring is ready.",
);

function walkFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(child) : [child.replaceAll("\\", "/")];
  });
}
