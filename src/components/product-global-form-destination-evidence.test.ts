import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  discoverRouteHandlers,
  discoverServerActions,
} from "../../security/endpoints";
import { PRODUCT_MASTER_EVIDENCE } from "./master-audit-evidence";
import { buildProductFormOperationalContractRegistry } from "./product-form-operational-contract-registry";
import {
  PRODUCT_GLOBAL_FORM_DESTINATION_EVIDENCE_FILE,
  PRODUCT_GLOBAL_FORM_DESTINATION_MASTER_EVIDENCE,
  PRODUCT_GLOBAL_FORM_DESTINATION_REQUIREMENT_IDS,
  PRODUCT_GLOBAL_FORM_DESTINATION_SCOPE,
  PRODUCT_GLOBAL_FORM_DESTINATION_TEST_FILE,
} from "./product-global-form-destination-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

const REQUIREMENT_ID = "GLOBAL.FUNC.forms" as const;
const LOCAL_SIMULATIONS = new Set([
  "FeedSystemPrototype.chat",
  "FeedSystemPrototype.comment",
  "FeedSystemPrototype.post",
]);

assert.deepEqual(PRODUCT_GLOBAL_FORM_DESTINATION_REQUIREMENT_IDS, [
  REQUIREMENT_ID,
]);
assert.equal(
  PRODUCT_MASTER_REQUIREMENTS.find(({ id }) => id === REQUIREMENT_ID)
    ?.requirement,
  "Submit every form to a real or safely simulated destination.",
);

const evidence =
  PRODUCT_GLOBAL_FORM_DESTINATION_MASTER_EVIDENCE[REQUIREMENT_ID];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_GLOBAL_FORM_DESTINATION_EVIDENCE_FILE,
  PRODUCT_GLOBAL_FORM_DESTINATION_TEST_FILE,
]);
assert.deepEqual(PRODUCT_MASTER_EVIDENCE[REQUIREMENT_ID], evidence);
evidence.evidence.forEach((file) => assert.equal(existsSync(file), true, file));

const registry = buildProductFormOperationalContractRegistry();
assert.equal(registry.records.length, 146);
assert.equal(
  new Set(registry.records.map(({ id }) => id)).size,
  registry.records.length,
);

const pageRoutes = new Set(discoverPageRoutes("src/app"));
const routeHandlers = new Set(
  discoverRouteHandlers().map(({ method, route }) => `${method} ${route}`),
);
const serverActions = new Set(discoverServerActions().map(({ handler }) => handler));
const observedLocalSimulations = new Set<string>();

for (const record of registry.records) {
  assert.notEqual(record.mutation.kind, "unclassified", record.id);
  if (record.mutation.kind === "read-query") {
    assert.equal(pageRoutes.has(record.destination.slice(4)), true, record.id);
    continue;
  }
  if (record.mutation.kind === "http-mutation") {
    assert.equal(routeHandlers.has(record.destination), true, record.id);
    continue;
  }
  if (record.mutation.kind === "server-action") {
    for (const action of record.mutation.operation.split(" | ")) {
      assert.equal(serverActions.has(action), true, `${record.id}: ${action}`);
    }
    continue;
  }
  assert.equal(LOCAL_SIMULATIONS.has(record.mutation.operation), true, record.id);
  observedLocalSimulations.add(record.mutation.operation);
}
assert.deepEqual(observedLocalSimulations, LOCAL_SIMULATIONS);

const prototypeSource = readFileSync(
  "src/components/feed-system-prototype.tsx",
  "utf8",
);
assert.equal((prototypeSource.match(/onSubmit=\{\(event\) => \{/g) ?? []).length, 3);
assert.equal((prototypeSource.match(/event\.preventDefault\(\);/g) ?? []).length, 3);
for (const feedback of [
  "Demo post published",
  "Comment added to this demo post.",
  "Demo message sent locally.",
]) {
  assert.match(prototypeSource, new RegExp(feedback.replaceAll(".", "\\.")));
}

assert.match(PRODUCT_GLOBAL_FORM_DESTINATION_SCOPE, /all 146 registered/i);
assert.match(PRODUCT_GLOBAL_FORM_DESTINATION_SCOPE, /existing page/i);
assert.match(PRODUCT_GLOBAL_FORM_DESTINATION_SCOPE, /does not prove hydrated/i);
assert.doesNotMatch(
  readFileSync(PRODUCT_GLOBAL_FORM_DESTINATION_EVIDENCE_FILE, "utf8"),
  /from ["']node:/,
);

console.log(
  "Global form-destination evidence passed: all 146 registered forms resolve to real or explicitly local simulated destinations.",
);

function discoverPageRoutes(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return discoverPageRoutes(fullPath);
    if (entry.name !== "page.tsx") return [];
    const relative = path.relative("src/app", path.dirname(fullPath)).replaceAll("\\", "/");
    return [relative ? `/${relative}` : "/"];
  });
}
