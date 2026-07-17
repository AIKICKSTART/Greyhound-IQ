import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  API_INVENTORY_MANAGEMENT_MASTER_EVIDENCE,
  VERIFIED_API_INVENTORY_MANAGEMENT_IDS,
  validateApiDocumentationExposure,
  validateEndpointLifecycle,
} from "./api-inventory-management-evidence";
import {
  ENDPOINTS,
  discoverRouteHandlers,
  discoverServerActions,
  type EndpointContract,
} from "./endpoints";

const discoveredHttp = discoverRouteHandlers().map(
  (entry) => `${entry.method} ${entry.route}`,
);
const inventoriedHttp = ENDPOINTS.filter(
  (endpoint) => endpoint.protocol === "http",
).map((endpoint) => `${endpoint.method} ${endpoint.routeOrProcedure}`);
assert.deepEqual(inventoriedHttp.toSorted(), discoveredHttp.toSorted());

const discoveredActions = discoverServerActions().map((entry) => entry.procedure);
const inventoriedActions = ENDPOINTS.filter(
  (endpoint) => endpoint.protocol === "server-action",
).map((endpoint) => endpoint.routeOrProcedure);
assert.deepEqual(inventoriedActions.toSorted(), discoveredActions.toSorted());
assert.deepEqual(validateEndpointLifecycle(ENDPOINTS), []);
assert.ok(ENDPOINTS.every((endpoint) => endpoint.deprecationStatus !== "unknown"));

const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
  dependencies?: Record<string, string>;
};
const documentationExposure = {
  publicFiles: collectPublicTextFiles("public"),
  routePatterns: discoveredHttp.map((operation) => operation.split(" ", 2)[1]),
  productionPackages: Object.keys(manifest.dependencies ?? {}),
};
assert.deepEqual(validateApiDocumentationExposure(documentationExposure), []);
assert.ok(
  !documentationExposure.publicFiles.some(
    (file) => file.path === "public/openapi.json",
  ),
  "the private root OpenAPI contract must not be copied to the public asset tree",
);

for (const requirementId of VERIFIED_API_INVENTORY_MANAGEMENT_IDS) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: immutable requirement missing`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    API_INVENTORY_MANAGEMENT_MASTER_EVIDENCE[requirementId],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
}

const example = ENDPOINTS[0];
assert.ok(example);
const deprecatedWithoutGovernance: EndpointContract = {
  ...example,
  endpointId: "TEST.DEPRECATED.UNGOVERNED",
  deprecationStatus: "deprecated",
  owner: "unassigned",
  retirementDate: null,
};
assert.deepEqual(validateEndpointLifecycle([deprecatedWithoutGovernance]), [
  "DEPRECATED_OWNER_MISSING:TEST.DEPRECATED.UNGOVERNED",
  "DEPRECATED_RETIREMENT_DATE_MISSING:TEST.DEPRECATED.UNGOVERNED",
]);

const removedHttp = inventoriedHttp.slice(1);
assert.notDeepEqual(removedHttp.toSorted(), discoveredHttp.toSorted());

assert.deepEqual(
  validateApiDocumentationExposure({
    publicFiles: [
      {
        path: "public/openapi.json",
        content: '{"paths":{"/api/internal/jobs":{}}}',
      },
    ],
    routePatterns: ["/api-docs"],
    productionPackages: ["swagger-ui-express"],
  }),
  [
    "PUBLIC_API_CONTRACT:public/openapi.json",
    "PUBLIC_API_DOCUMENTATION_PACKAGE:swagger-ui-express",
    "PUBLIC_API_DOCUMENTATION_ROUTE:/api-docs",
    "PUBLIC_INTERNAL_OPERATION_REFERENCE:public/openapi.json",
  ],
);

console.log(
  `API inventory management passed: ${inventoriedHttp.length} HTTP operations and ${inventoriedActions.length} server actions are exact; lifecycle metadata fails closed and private OpenAPI is not publicly served.`,
);

function collectPublicTextFiles(directory: string): Array<{ path: string; content: string }> {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) return collectPublicTextFiles(fullPath);
    if (!/\.(?:css|html|js|json|map|svg|txt|xml)$/i.test(entry.name)) return [];
    return [
      {
        path: relative(process.cwd(), fullPath).replaceAll("\\", "/"),
        content: readFileSync(fullPath, "utf8"),
      },
    ];
  });
}
