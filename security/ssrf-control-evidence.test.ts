import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  SSRF_CONTROL_BINDINGS,
  SSRF_CONTROL_EVIDENCE_SCOPE,
  SSRF_CONTROL_MASTER_EVIDENCE,
} from "./ssrf-control-evidence";

const requirementIds = Object.keys(SSRF_CONTROL_MASTER_EVIDENCE);
const expectedEvidence = SSRF_CONTROL_MASTER_EVIDENCE as Readonly<
  Record<string, unknown>
>;
assert.equal(requirementIds.length, 12);
for (const requirementId of requirementIds) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: immutable requirement missing`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    expectedEvidence[requirementId],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
}

const isolation = MASTER_AUDIT_REQUIREMENTS.find(
  ({ id }) => id === "security.ssrf-control.isolation",
);
assert.ok(isolation);
assert.equal(
  SECURITY_MASTER_EVIDENCE["security.ssrf-control.isolation"],
  undefined,
  "worker/process isolation remains an explicit open gate",
);
assert.equal(isMasterRequirementComplete(isolation), false);

for (const binding of SSRF_CONTROL_BINDINGS) {
  assert.ok(existsSync(binding.sourceFile), `${binding.surface}: source missing`);
  const source = readFileSync(binding.sourceFile, "utf8");
  for (const marker of binding.requiredMarkers) {
    assert.ok(
      source.includes(marker),
      `${binding.surface}: required control marker drifted: ${marker}`,
    );
  }
}

const dogCardSource = readFileSync("src/lib/dog-card-service.ts", "utf8");
assert.ok(!dogCardSource.includes("async function fetchBytes"));
assert.ok(!dogCardSource.includes("photoUrl.startsWith"));
const linkPreviewSource = readFileSync("src/lib/link-preview.ts", "utf8");
assert.ok(!/\b(?:authorization|cookie)\s*:/i.test(linkPreviewSource));
assert.match(SSRF_CONTROL_EVIDENCE_SCOPE, /Source-bound/);
assert.match(SSRF_CONTROL_EVIDENCE_SCOPE, /remain separate runtime gates/);

console.log(
  "SSRF controls passed: 12 exact source-bound gates verified; process isolation remains open",
);
