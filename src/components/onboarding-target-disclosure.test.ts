import assert from "node:assert/strict";

import {
  ONBOARDING_REVEAL_KINDS,
  isAllowedOnboardingRevealController,
  resolveOnboardingRevealKind,
} from "./onboarding-target-disclosure";

assert.deepEqual(ONBOARDING_REVEAL_KINDS, ["tab", "modal"]);
assert.equal(resolveOnboardingRevealKind("tab"), "tab");
assert.equal(resolveOnboardingRevealKind("modal"), "modal");
assert.equal(resolveOnboardingRevealKind("submit"), null);

const base = {
  ariaDisabled: null,
  controls: "design-lab-tab-target",
  disabled: false,
  kind: "tab",
  role: "tab",
  tagName: "BUTTON",
  targetId: "design-lab-tab-target",
  type: "button",
} as const;

assert.equal(isAllowedOnboardingRevealController(base), true);
assert.equal(
  isAllowedOnboardingRevealController({
    ...base,
    controls: "design-lab-modal-target",
    kind: "modal",
    role: null,
    targetId: "design-lab-modal-target",
  }),
  true,
);
for (const rejected of [
  { ...base, ariaDisabled: "true" },
  { ...base, controls: "design-lab-tab-target-extra" },
  { ...base, disabled: true },
  { ...base, kind: "navigation" },
  { ...base, role: null },
  { ...base, tagName: "A" },
  { ...base, type: "submit" },
]) {
  assert.equal(isAllowedOnboardingRevealController(rejected), false);
}

console.log(
  "Onboarding disclosure contract passed: only exact, non-mutating, enabled tab/modal buttons may reveal a semantic target.",
);
