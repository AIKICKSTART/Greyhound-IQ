import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const panel = readFileSync(
  resolve("src/components/design-lab-pending-work-panel.tsx"),
  "utf8",
);
const workspace = readFileSync(
  resolve("src/components/demo-experience-screen-map.tsx"),
  "utf8",
);

for (const contract of [
  "Final production to-do",
  "Every remaining task before production approval",
  "This is the final list",
  "Completion",
  "Complete, awaiting verification",
  "Final code-freeze refresh",
  "data-design-lab-verification-refresh-workflow",
  "data-pending-work-awaiting-verification",
  "Registry",
  "Product area",
  "Owner",
  "Role",
  "Screen",
  "Dependency",
  "Search everything",
  "Next action",
  "MVP launch blocker",
  "canonicalStats",
  "remaining",
  "shown",
  "data-design-lab-pending-work",
]) {
  assert.ok(panel.includes(contract), `missing pending-work UI contract: ${contract}`);
}

assert.match(
  workspace,
  /initialArea === "requirements"[\s\S]*DesignLabPendingWorkPanel[\s\S]*MasterAuditChecklist/,
);

console.log("Design Lab pending-work panel tests passed");
