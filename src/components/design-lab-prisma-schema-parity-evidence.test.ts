import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { DESIGN_LAB_PREPRODUCTION_REQUIREMENTS } from "./design-lab-preproduction-requirements";
import {
  findDesignLabDatabaseParityIssues,
  getCurrentDesignLabDatabaseParityBinding,
} from "../../scripts/design-lab-database-parity-evidence";

const requirement = DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.find(
  (candidate) => candidate.id === "PREPROD.DB.PRISMA_SCHEMA_PARITY",
);
assert.ok(requirement);
assert.equal(requirement.status, "partially-verified");

const current = getCurrentDesignLabDatabaseParityBinding(process.cwd());
const migrationReplay = JSON.parse(
  readFileSync("output/database-audit/migration-replay.json", "utf8"),
) as Record<string, unknown>;
const replaySource = migrationReplay.sourceBinding as Record<string, unknown>;
const replayResult = migrationReplay.replay as Record<string, unknown>;
assert.equal(current.migrationCount, 97);
assert.equal(replaySource.migrationCount, current.migrationCount);
assert.equal(replaySource.prismaSchemaSha256, current.prismaSchemaSha256);
assert.equal(replaySource.migrationsSha256, current.migrationsSha256);
assert.equal(replayResult.status, "verified");
assert.deepEqual(replayResult.summary, [
  "No difference detected.",
  "Loaded Prisma config from prisma.config.ts.",
]);

const parityArtifact = JSON.parse(
  readFileSync(
    "output/database-audit/design-lab-database-parity.json",
    "utf8",
  ),
) as Record<string, unknown>;
const paritySource = parityArtifact.sourceBinding as Record<string, unknown>;
assert.equal(paritySource.migrationCount, 90);
assert.notEqual(paritySource.migrationCount, current.migrationCount);

const parityIssues = findDesignLabDatabaseParityIssues(parityArtifact, current);
assert.ok(parityIssues.length > 0);
assert.ok(
  parityIssues.includes("sourceBinding.migrationCount is stale."),
  parityIssues.join("\n"),
);
assert.ok(
  parityIssues.includes("sourceBinding.testedCommitSha is stale."),
  parityIssues.join("\n"),
);
assert.ok(
  parityIssues.includes("catalog snapshot proof is invalid."),
  parityIssues.join("\n"),
);

for (const evidencePath of [
  "scripts/check-design-lab-database-parity.ts",
  "scripts/design-lab-database-parity-evidence.ts",
  "output/database-audit/design-lab-database-parity.json",
  "output/database-audit/migration-replay.json",
]) {
  assert.ok(requirement.evidence.includes(evidencePath), evidencePath);
}
assert.ok(
  requirement.tests.includes(
    "src/components/design-lab-prisma-schema-parity-evidence.test.ts",
  ),
);
assert.match(requirement.remainingEvidence, /four current migrations pending/);
assert.match(requirement.remainingEvidence, /records only 90 migrations/);
assert.match(requirement.remainingEvidence, /must remain partially verified/);

console.log(
  "Design Lab Prisma parity evidence passed: current 97-migration replay is exact, while the stale 90-migration canonical artifact remains fail-closed",
);
