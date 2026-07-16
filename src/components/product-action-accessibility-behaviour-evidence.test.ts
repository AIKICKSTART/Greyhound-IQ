import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { PRODUCT_MASTER_EVIDENCE } from "./master-audit-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_ACTION_ACCESSIBILITY_BEHAVIOUR_EVIDENCE_FILE,
  PRODUCT_ACTION_ACCESSIBILITY_BEHAVIOUR_EXPECTED_GAIN,
  PRODUCT_ACTION_ACCESSIBILITY_BEHAVIOUR_MASTER_EVIDENCE,
  PRODUCT_ACTION_ACCESSIBILITY_BEHAVIOUR_REQUIREMENT_IDS,
  PRODUCT_ACTION_ACCESSIBILITY_BEHAVIOUR_SCOPE,
  PRODUCT_ACTION_ACCESSIBILITY_BEHAVIOUR_TEST_FILE,
} from "./product-action-accessibility-behaviour-evidence";

assert.deepEqual(PRODUCT_ACTION_ACCESSIBILITY_BEHAVIOUR_REQUIREMENT_IDS, [
  "ACTION.BEHAVIOUR.keyboard",
  "ACTION.BEHAVIOUR.focus",
]);
assert.equal(PRODUCT_ACTION_ACCESSIBILITY_BEHAVIOUR_EXPECTED_GAIN, 2);
assert.deepEqual(
  Object.keys(PRODUCT_ACTION_ACCESSIBILITY_BEHAVIOUR_MASTER_EVIDENCE),
  PRODUCT_ACTION_ACCESSIBILITY_BEHAVIOUR_REQUIREMENT_IDS,
);

const requirementsById = new Map(
  PRODUCT_MASTER_REQUIREMENTS.map((requirement) => [requirement.id, requirement]),
);
assert.equal(
  requirementsById.get("ACTION.BEHAVIOUR.keyboard")?.requirement,
  "Every interactive control supports keyboard use.",
);
assert.equal(
  requirementsById.get("ACTION.BEHAVIOUR.focus")?.requirement,
  "Every interactive control has visible focus treatment.",
);

for (const requirementId of PRODUCT_ACTION_ACCESSIBILITY_BEHAVIOUR_REQUIREMENT_IDS) {
  const evidence =
    PRODUCT_ACTION_ACCESSIBILITY_BEHAVIOUR_MASTER_EVIDENCE[requirementId];
  assert.equal(evidence.status, "tested", requirementId);
  assert.deepEqual(evidence.evidence.slice(0, 2), [
    PRODUCT_ACTION_ACCESSIBILITY_BEHAVIOUR_EVIDENCE_FILE,
    PRODUCT_ACTION_ACCESSIBILITY_BEHAVIOUR_TEST_FILE,
  ]);
  assert.deepEqual(PRODUCT_MASTER_EVIDENCE[requirementId], evidence);
  for (const evidencePath of evidence.evidence) {
    assert.equal(existsSync(evidencePath), true, evidencePath);
  }
}

const globalInteractionTest = readFileSync(
  "src/components/global-accessibility-interaction.test.ts",
  "utf8",
);
assert.match(globalInteractionTest, /const sourceRoots = \["src\/app", "src\/components"\]/);
assert.match(globalInteractionTest, /const nonNativeActivations: string\[\] = \[\]/);
assert.match(globalInteractionTest, /all direct activation surfaces must be native controls/i);
assert.match(globalInteractionTest, /positive tab indices break visual and keyboard focus order/i);
assert.match(globalInteractionTest, /outline removal must include an explicit focus-visible treatment/i);
assert.match(globalInteractionTest, /Global interaction accessibility source contract passed/);

const focalPointEditor = readFileSync(
  "src/components/media-focal-point-editor.tsx",
  "utf8",
);
assert.match(focalPointEditor, /event\.key === "ArrowLeft"/);
assert.match(focalPointEditor, /event\.key === "ArrowRight"/);
const recipientPicker = readFileSync("src/components/recipient-picker.tsx", "utf8");
assert.match(recipientPicker, /onKeyDown=\{handleKeyDown\}/);
const globals = readFileSync("src/app/globals.css", "utf8");
assert.match(globals, /\.giq-button:focus-visible/);

assert.match(PRODUCT_ACTION_ACCESSIBILITY_BEHAVIOUR_SCOPE, /source-static/i);
assert.match(PRODUCT_ACTION_ACCESSIBILITY_BEHAVIOUR_SCOPE, /keyboard-safe direct activation/i);
assert.match(PRODUCT_ACTION_ACCESSIBILITY_BEHAVIOUR_SCOPE, /focus-visible/i);
assert.match(PRODUCT_ACTION_ACCESSIBILITY_BEHAVIOUR_SCOPE, /does not establish browser focus traversal/i);
assert.match(PRODUCT_ACTION_ACCESSIBILITY_BEHAVIOUR_SCOPE, /production readiness/i);

console.log(
  "Product action accessibility-behaviour evidence passed: source keyboard and focus conditions map to 2 action-behaviour gates.",
);
