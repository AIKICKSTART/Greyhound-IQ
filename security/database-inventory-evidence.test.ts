import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  DATABASE_COMPATIBILITY_BASELINE,
  collectDatabaseCompatibilityInventory,
  databaseCompatibilityInventoryDiff,
} from "../scripts/check-database-compatibility-inventory";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import {
  DATABASE_INVENTORY_MASTER_EVIDENCE,
  DATABASE_INVENTORY_NOT_APPLICABLE,
  VERIFIED_DATABASE_INVENTORY_REQUIREMENT_IDS,
} from "./database-inventory-evidence";

const inventory = collectDatabaseCompatibilityInventory();
assert.deepEqual(databaseCompatibilityInventoryDiff(inventory), []);
assert.deepEqual(inventory, DATABASE_COMPATIBILITY_BASELINE);
assert.deepEqual(inventory.counts, {
  models: 114,
  migrations: 101,
  extensions: 1,
  functions: 58,
  triggers: 22,
  policies: 266,
  ordinaryViews: 1,
  materializedViews: 5,
  indexes: 464,
  createdRoles: 1,
});

const migrationSource = readdirSync("prisma/migrations", {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) =>
    readFileSync(
      path.join("prisma/migrations", entry.name, "migration.sql"),
      "utf8",
    ),
  )
  .join("\n");
assert.doesNotMatch(
  migrationSource,
  /\bCREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\b/i,
);

const requirementIds = [
  ...VERIFIED_DATABASE_INVENTORY_REQUIREMENT_IDS,
  ...Object.keys(DATABASE_INVENTORY_NOT_APPLICABLE),
];
assert.equal(requirementIds.length, 11);
assert.equal(new Set(requirementIds).size, requirementIds.length);
for (const requirementId of requirementIds) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) =>
      candidate.prompt === "security" && candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    DATABASE_INVENTORY_MASTER_EVIDENCE[requirementId],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
  for (const evidencePath of SECURITY_MASTER_EVIDENCE[requirementId].evidence) {
    assert.ok(existsSync(evidencePath), `${requirementId}: missing ${evidencePath}`);
  }
}

console.log(
  "database source inventory evidence passed: 10 populated object classes and zero stored procedures",
);
