import assert from "node:assert/strict";

import {
  DESIGN_LAB_AREAS,
  designLabAreaHref,
  resolveDesignLabArea,
} from "./design-lab-workspace";

// screen-evidence-test-id: DL-WORKSPACE-AREA

assert.deepEqual(
  DESIGN_LAB_AREAS.map((area) => area.id),
  [
    "overview",
    "delivery",
    "architecture",
    "advertising",
    "requirements",
    "readiness",
    "screens",
  ],
);
assert.equal(new Set(DESIGN_LAB_AREAS.map((area) => area.id)).size, 7);
assert.ok(DESIGN_LAB_AREAS.every((area) => area.label && area.description));
assert.equal(
  DESIGN_LAB_AREAS.find((area) => area.id === "requirements")?.label,
  "Final to-do",
);

assert.equal(resolveDesignLabArea(undefined), "overview");
assert.equal(resolveDesignLabArea("delivery"), "delivery");
assert.equal(resolveDesignLabArea("architecture"), "architecture");
assert.equal(resolveDesignLabArea(["screens", "overview"]), "screens");
assert.equal(resolveDesignLabArea("unknown"), "overview");
assert.equal(resolveDesignLabArea(undefined, "screens"), "screens");
assert.equal(resolveDesignLabArea("unknown", "screens"), "screens");
assert.equal(
  designLabAreaHref("/design-lab", "advertising"),
  "/design-lab?area=advertising",
);
assert.equal(
  designLabAreaHref("/design-lab", "architecture"),
  "/design-lab?area=architecture",
);

console.log("design lab workspace tests passed");
