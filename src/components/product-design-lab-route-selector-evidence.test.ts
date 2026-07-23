import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  buildDesignLabInspectorRouteUrl,
  resolveDesignLabInspectorContract,
} from "./design-lab-contract-inspector-model";
import {
  PRODUCT_DESIGN_LAB_ROUTE_SELECTOR_EVIDENCE_FILE,
  PRODUCT_DESIGN_LAB_ROUTE_SELECTOR_MASTER_EVIDENCE,
  PRODUCT_DESIGN_LAB_ROUTE_SELECTOR_REQUIREMENT_IDS,
  PRODUCT_DESIGN_LAB_ROUTE_SELECTOR_SCOPE,
  PRODUCT_DESIGN_LAB_ROUTE_SELECTOR_TEST_FILE,
} from "./product-design-lab-route-selector-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

assert.deepEqual(
  PRODUCT_DESIGN_LAB_ROUTE_SELECTOR_REQUIREMENT_IDS.toSorted(),
  ["DL.SELECT.route", "DL.URL.route"],
);
assert.deepEqual(
  Object.keys(PRODUCT_DESIGN_LAB_ROUTE_SELECTOR_MASTER_EVIDENCE).toSorted(),
  PRODUCT_DESIGN_LAB_ROUTE_SELECTOR_REQUIREMENT_IDS.toSorted(),
);

for (const requirementId of PRODUCT_DESIGN_LAB_ROUTE_SELECTOR_REQUIREMENT_IDS) {
  const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, requirementId);
  const record = PRODUCT_DESIGN_LAB_ROUTE_SELECTOR_MASTER_EVIDENCE[requirementId];
  assert.equal(record.status, "tested", requirementId);
  assert.ok(record.evidence.includes(PRODUCT_DESIGN_LAB_ROUTE_SELECTOR_EVIDENCE_FILE));
  assert.ok(record.evidence.includes(PRODUCT_DESIGN_LAB_ROUTE_SELECTOR_TEST_FILE));
  for (const evidencePath of record.evidence) {
    assert.equal(existsSync(evidencePath), true, evidencePath);
  }
}

assert.equal(
  resolveDesignLabInspectorContract("/admin/users").route,
  "/admin/users",
);
assert.equal(
  resolveDesignLabInspectorContract("https://evil.example/").route,
  "/dogs/[id]",
);
const reproduced = buildDesignLabInspectorRouteUrl(
  "https://greyhoundsiq.test/design-lab/demo-experience?area=screens&workQuery=dog&auditQuery=user#contract",
  "/admin/users",
);
assert.equal(
  reproduced,
  "/design-lab/demo-experience?area=screens&route=%2Fadmin%2Fusers#contract",
);

const componentSource = readFileSync(
  "src/components/design-lab-contract-inspector.tsx",
  "utf8",
);
assert.match(componentSource, /window\.history\.pushState/);
assert.match(componentSource, /addEventListener\("popstate"/);
assert.match(componentSource, /resolveDesignLabInspectorContract\(initialRoute\)/);
for (const pagePath of [
  "src/app/design-lab/page.tsx",
  "src/app/design-lab/demo-experience/page.tsx",
]) {
  const pageSource = readFileSync(pagePath, "utf8");
  assert.match(pageSource, /initialContractRoute=\{firstValue\(query\.route\)\}/);
}

assert.match(PRODUCT_DESIGN_LAB_ROUTE_SELECTOR_SCOPE, /90 allowlisted/);
assert.match(PRODUCT_DESIGN_LAB_ROUTE_SELECTOR_SCOPE, /strips transient free-text/i);
assert.match(PRODUCT_DESIGN_LAB_ROUTE_SELECTOR_SCOPE, /does not claim/i);

console.log(
  "Design Lab route selector evidence passed: allowlisted selection, same-origin URL persistence, reload input and browser history",
);
