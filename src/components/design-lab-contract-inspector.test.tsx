import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";

import { DesignLabContractInspector } from "./design-lab-contract-inspector";
import {
  DESIGN_LAB_INSPECTOR_DIMENSIONS,
  buildDesignLabContractInspectorSections,
  buildDesignLabInspectorRouteUrl,
  resolveDesignLabInspectorContract,
} from "./design-lab-contract-inspector-model";
import {
  DEMO_SCREEN_COUNT,
  SCREEN_CONTRACTS,
} from "./demo-experience-registry";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

const requirementIds = PRODUCT_MASTER_REQUIREMENTS.filter(
  (requirement) => requirement.section === "design-lab.inspector",
).map((requirement) => requirement.id);
const dimensionIds = DESIGN_LAB_INSPECTOR_DIMENSIONS.map(
  (dimension) => dimension.id,
);

assert.equal(SCREEN_CONTRACTS.length, DEMO_SCREEN_COUNT);
assert.equal(dimensionIds.length, 19);
assert.deepEqual(dimensionIds.toSorted(), requirementIds.toSorted());

for (const contract of SCREEN_CONTRACTS) {
  const sections = buildDesignLabContractInspectorSections(contract);
  assert.deepEqual(
    sections.map((section) => section.id),
    dimensionIds,
    `${contract.route}: inspector dimensions drifted`,
  );
  for (const section of sections) {
    assert.ok(section.values.length > 0, `${contract.route}: ${section.id}`);
    assert.ok(
      section.values.every((value) => value.trim().length > 0),
      `${contract.route}: ${section.id} contains a blank value`,
    );
  }
  assert.equal(sections[0]?.state, "recorded");
  assert.equal(
    sections.find((section) => section.id === "DL.INSPECT.fields")?.state,
    "gap",
    "Missing field-level contracts must be visible rather than inferred",
  );
}

const markup = renderToStaticMarkup(<DesignLabContractInspector />);
assert.match(markup, /data-design-lab-contract-inspector="true"/);
assert.match(markup, /aria-label="Contract inspector route"/);
assert.match(markup, /Recorded values and unresolved gaps are shown separately/);
for (const requirementId of dimensionIds) {
  assert.match(
    markup,
    new RegExp(`data-inspector-requirement="${requirementId.replaceAll(".", "\\.")}"`),
    requirementId,
  );
}

assert.equal(
  resolveDesignLabInspectorContract("/admin/users").route,
  "/admin/users",
);
assert.equal(
  resolveDesignLabInspectorContract("javascript:alert(1)").route,
  "/dogs/[id]",
  "an unregistered route must fail closed to the allowlisted default",
);
assert.equal(
  buildDesignLabInspectorRouteUrl(
    "https://example.test/design-lab?area=screens&workQuery=dogs&auditQuery=admin#inspector",
    "/admin/users",
  ),
  "/design-lab?area=screens&route=%2Fadmin%2Fusers#inspector",
);

const selectedMarkup = renderToStaticMarkup(
  <DesignLabContractInspector initialRoute="/admin/users" />,
);
assert.match(selectedMarkup, /data-selected-contract="\/admin\/users"/);
assert.match(selectedMarkup, /value="\/admin\/users" selected=""/);

const screenMap = readFileSync(
  "src/components/demo-experience-screen-map.tsx",
  "utf8",
);
assert.match(
  screenMap,
  /<DesignLabContractInspector initialRoute=\{initialContractRoute\} \/>/,
);

console.log(
  `Design Lab contract inspector passed: 19 dimensions rendered for all ${DEMO_SCREEN_COUNT} contracts with gaps explicit`,
);
