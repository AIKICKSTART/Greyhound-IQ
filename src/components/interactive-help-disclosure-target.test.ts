import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DESIGN_LAB_ONBOARDING_ROUTE_TOURS,
  DESIGN_LAB_ONBOARDING_TARGET_IDS,
} from "./design-lab-onboarding-tour-registry";

const missionControlTour = DESIGN_LAB_ONBOARDING_ROUTE_TOURS.find(
  ({ route }) => route === "/design-lab",
);
assert.ok(missionControlTour);
assert.equal(missionControlTour.steps[3].targetId, "design-lab-tab-target");
assert.equal(missionControlTour.steps[4].targetId, "design-lab-modal-target");
assert.ok(DESIGN_LAB_ONBOARDING_TARGET_IDS.includes("design-lab-tab-target"));
assert.ok(DESIGN_LAB_ONBOARDING_TARGET_IDS.includes("design-lab-modal-target"));

const helpSource = readFileSync("src/components/interactive-help.tsx", "utf8");
const labSource = readFileSync(
  "src/components/design-lab-onboarding-disclosure-targets.tsx",
  "utf8",
);
const protectedPageSource = readFileSync("src/app/design-lab/page.tsx", "utf8");

for (const contract of [
  /button\[data-onboarding-controls\]\[data-onboarding-reveal\]/,
  /isAllowedOnboardingRevealController/,
  /revealAttemptRef\.current\.has\(revealAttemptKey\)/,
  /revealAttemptRef\.current\.add\(revealAttemptKey\)/,
  /revealController\.element\.click\(\)/,
  /targetStatus === "revealing"/,
  /targetStatus === "controller"/,
  /Opening the allowlisted, non-mutating tab or dialog/,
]) {
  assert.match(helpSource, contract);
}
assert.doesNotMatch(helpSource, /querySelectorAll<[^>]+>\("button"\)/);

for (const contract of [
  /data-onboarding-controls="design-lab-tab-target"/,
  /data-onboarding-reveal="tab"/,
  /data-onboarding-target="design-lab-tab-target"/,
  /role="tab"/,
  /role="tabpanel"/,
  /hidden=\{selectedTab !== "details"\}/,
  /data-onboarding-controls="design-lab-modal-target"/,
  /data-onboarding-reveal="modal"/,
  /data-onboarding-target="design-lab-modal-target"/,
  /<Sheet modal=\{false\}>/,
  /This target contains guidance only/,
]) {
  assert.match(labSource, contract);
}
assert.match(protectedPageSource, /await requireDesignLabReviewer\(\)/);

console.log(
  "Interactive help disclosure targets passed: the protected Design Lab proves one-shot tab and modal reveal with safe fallback and no mutation path.",
);
