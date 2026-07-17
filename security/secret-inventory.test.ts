import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import {
  SECRET_INVENTORY_MASTER_EVIDENCE,
  SECRET_RECORD_FIELD_REQUIREMENT_IDS,
} from "./secret-inventory-evidence";
import {
  SECRET_INVENTORY,
  validateSecretInventoryRecord,
} from "./secret-inventory";

const requirements = MASTER_AUDIT_REQUIREMENTS.filter(
  (requirement) =>
    requirement.prompt === "security" &&
    requirement.section === "secret-inventory",
);
assert.equal(SECRET_INVENTORY.length, 16);
assert.equal(new Set(SECRET_INVENTORY.map(({ requirementId }) => requirementId)).size, 16);
assert.deepEqual(
  SECRET_INVENTORY.map(({ requirementId }) => requirementId).toSorted(),
  requirements.map(({ id }) => id).toSorted(),
);

for (const record of SECRET_INVENTORY) {
  assert.deepEqual(validateSecretInventoryRecord(record), []);
  assert.ok(record.category.trim());
  assert.ok(record.currentFinding.trim());
  assert.ok(record.owner.trim());
  assert.ok(record.sourceFiles.length > 0);
  assert.ok(record.sourceFiles.every((sourceFile) => !/^\.env(?:\.|$)/.test(sourceFile) || sourceFile === ".env.example"));
  for (const sourceFile of record.sourceFiles) {
    assert.ok(existsSync(sourceFile), `${record.requirementId}: missing ${sourceFile}`);
  }
  for (const identifier of record.identifierNames) {
    assert.match(identifier, /^[A-Z][A-Z0-9_]+$/);
    assert.ok(
      record.sourceFiles.some((sourceFile) =>
        readFileSync(sourceFile, "utf8").includes(identifier),
      ),
      `${record.requirementId}: ${identifier} is not present in its safe source evidence`,
    );
  }
  if (record.identifierNames.length === 0) {
    assert.ok(
      ["not-configured", "managed-identity", "provider-managed-unverified"].includes(record.status),
    );
  }

  const requirement = requirements.find(
    (candidate) => candidate.id === record.requirementId,
  );
  assert.ok(requirement);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[record.requirementId],
    SECRET_INVENTORY_MASTER_EVIDENCE[record.requirementId],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
}

assert.equal(SECRET_RECORD_FIELD_REQUIREMENT_IDS.length, 14);
for (const requirementId of SECRET_RECORD_FIELD_REQUIREMENT_IDS) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) =>
      candidate.prompt === "security" && candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    SECRET_INVENTORY_MASTER_EVIDENCE[requirementId],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
}

assert.deepEqual(
  validateSecretInventoryRecord({
    ...SECRET_INVENTORY[0],
    rotationProcess: "",
  }),
  ["missing-text-field"],
);

assert.doesNotMatch(
  readFileSync("security/secret-inventory.ts", "utf8"),
  /(?:sk_live_|whsec_[A-Za-z0-9]{16,}|-----BEGIN [A-Z ]+PRIVATE KEY-----)/,
);

console.log(
  "secret inventory passed: 16 names-only credential classes; live custody remains unverified",
);
