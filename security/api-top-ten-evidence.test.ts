import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  API_INVENTORY_MANAGEMENT_EVIDENCE,
  validateEndpointLifecycle,
} from "./api-inventory-management-evidence";
import { API_SURFACE_INVENTORY } from "./api-surface-inventory";
import { discoverRouteHandlers, discoverServerActions, ENDPOINTS } from "./endpoints";
import {
  API_TOP_TEN_LOCALLY_VERIFIED_REQUIREMENT_IDS,
  API_TOP_TEN_MASTER_EVIDENCE,
} from "./api-top-ten-evidence";

assert.deepEqual(API_TOP_TEN_LOCALLY_VERIFIED_REQUIREMENT_IDS, [
  "security.api-top-ten.inventory",
]);
assert.deepEqual(Object.keys(API_TOP_TEN_MASTER_EVIDENCE), [
  "security.api-top-ten.inventory",
]);

const inventoryEvidence = API_TOP_TEN_MASTER_EVIDENCE[
  "security.api-top-ten.inventory"
];
assert.equal(inventoryEvidence?.status, "verified");
assert.deepEqual(inventoryEvidence?.evidence, [
  ...API_INVENTORY_MANAGEMENT_EVIDENCE,
  "security/api-top-ten-evidence.ts",
  "security/api-top-ten-evidence.test.ts",
]);

const discoveredHttp = discoverRouteHandlers().map(
  (entry) => `${entry.method} ${entry.route}`,
);
const discoveredActions = discoverServerActions().map(
  (entry) => `ACTION ${entry.procedure}`,
);
assert.deepEqual(
  ENDPOINTS.map((entry) => `${entry.method} ${entry.routeOrProcedure}`).toSorted(),
  [...discoveredHttp, ...discoveredActions].toSorted(),
);
assert.deepEqual(validateEndpointLifecycle(ENDPOINTS), []);
assert.deepEqual(
  API_SURFACE_INVENTORY.find((record) => record.key === "rest")?.members.toSorted(),
  discoveredHttp.toSorted(),
);
assert.deepEqual(
  API_SURFACE_INVENTORY.find((record) => record.key === "server-action")?.members.toSorted(),
  discoveredActions.toSorted(),
);

const masterEvidenceSource = readFileSync(
  "src/components/master-audit-evidence.ts",
  "utf8",
);
assert.match(
  masterEvidenceSource,
  /API_TOP_TEN_MASTER_EVIDENCE.*api-top-ten-evidence/,
);
assert.match(masterEvidenceSource, /\.\.\.API_TOP_TEN_MASTER_EVIDENCE/);

console.log(
  `API Top Ten inventory passed: ${discoveredHttp.length} HTTP operations and ${discoveredActions.length} server actions are source-inventoried; other Top Ten categories remain open pending their own controls.`,
);
