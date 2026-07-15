import assert from "node:assert/strict";

import {
  DESIGN_LAB_PRODUCTION_PROMOTION,
  DESIGN_LAB_RELEASE_GATE,
  evaluateDesignLabReleaseGate,
} from "./design-lab-release-gate";
import {
  SCREEN_CONTRACT_CHECKLIST,
  SCREEN_CONTRACT_COVERAGE_AREAS,
} from "./demo-experience-registry";
import {
  MASTER_AUDIT_REQUIREMENTS,
  type MasterAuditRequirement,
} from "./master-audit-requirements";
import {
  DESIGN_LAB_PREPRODUCTION_REQUIREMENTS,
  type DesignLabPreproductionRequirement,
} from "./design-lab-preproduction-requirements";
import {
  DATABASE_OPERATIONS,
  type DatabaseOperationContract,
} from "../../security/database-operations";

const releasePreproductionRequirements =
  DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.filter((item) => item.releaseBlocking);

assert.equal(DESIGN_LAB_PRODUCTION_PROMOTION.browserApproval, false);
assert.equal(
  DESIGN_LAB_PRODUCTION_PROMOTION.approvalAuthority,
  "GitHub production environment"
);
assert.equal(
  DESIGN_LAB_RELEASE_GATE.totalChecks,
    SCREEN_CONTRACT_CHECKLIST.reduce((total, item) => total + item.total, 0) +
    MASTER_AUDIT_REQUIREMENTS.filter((item) => item.releaseBlocking).length +
    releasePreproductionRequirements.length +
    DATABASE_OPERATIONS.length
);
assert.deepEqual(
  DESIGN_LAB_RELEASE_GATE.requiredAreas,
  SCREEN_CONTRACT_COVERAGE_AREAS
);
assert.equal(DESIGN_LAB_RELEASE_GATE.status, "blocked");
assert.ok(
  DESIGN_LAB_RELEASE_GATE.blockers.length > 0 ||
  DESIGN_LAB_RELEASE_GATE.masterBlockers.length > 0 ||
  DESIGN_LAB_RELEASE_GATE.preproductionBlockers.length > 0 ||
  DESIGN_LAB_RELEASE_GATE.databaseBlocker !== null
);

const readyChecklist = SCREEN_CONTRACT_CHECKLIST.map((item) => ({
  ...item,
  completed: item.total,
  captured: 0,
  blocked: 0,
  remaining: 0,
}));
const readyRequirements: MasterAuditRequirement[] = MASTER_AUDIT_REQUIREMENTS.map(
  (item) => ({
    ...item,
    status: "verified",
    evidence: ["test:master-audit-release-evidence"],
  })
);
const readyPreproductionRequirements: DesignLabPreproductionRequirement[] =
  DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.map((item) => ({
    ...item,
    status: "verified",
    evidence: ["test:preproduction-release-evidence"],
    tests: ["test:preproduction-release-test"],
  }));
const readyDatabaseOperations: DatabaseOperationContract[] =
  DATABASE_OPERATIONS.map((operation) => ({
    ...operation,
    normalizedSql:
      operation.normalizedSql ??
      'SELECT "id" FROM "ReleaseGateFixture" WHERE "id" = :id',
    databaseRole: "greyhoundiq_runtime",
    databaseName: "greyhoundiq",
    schemaName: "public",
    parameterized: true,
    tests: ["test:database-release-evidence"],
    evidence: ["evidence:normalized-query"],
    verificationStatus: "Verified",
  }));
assert.equal(
  evaluateDesignLabReleaseGate(
    [],
    readyRequirements,
    readyPreproductionRequirements,
    readyDatabaseOperations
  ).status,
  "blocked"
);
assert.equal(
  evaluateDesignLabReleaseGate(
    readyChecklist,
    [],
    readyPreproductionRequirements,
    readyDatabaseOperations
  ).status,
  "blocked"
);
assert.equal(
  evaluateDesignLabReleaseGate(
    readyChecklist,
    readyRequirements,
    [],
    readyDatabaseOperations
  ).status,
  "blocked"
);
assert.equal(
  evaluateDesignLabReleaseGate(
    readyChecklist,
    readyRequirements,
    readyPreproductionRequirements,
    []
  ).status,
  "blocked"
);
assert.deepEqual(evaluateDesignLabReleaseGate(
  readyChecklist,
  readyRequirements,
  readyPreproductionRequirements,
  readyDatabaseOperations
), {
  status: "ready-for-approval",
  blockers: [],
  masterBlockers: [],
  preproductionBlockers: [],
  databaseBlocker: null,
  completedChecks: DESIGN_LAB_RELEASE_GATE.totalChecks,
  totalChecks: DESIGN_LAB_RELEASE_GATE.totalChecks,
  requiredAreas: [...SCREEN_CONTRACT_COVERAGE_AREAS],
  requiredPrompts: ["product", "security"],
  requiredPreproductionSystems: [
    ...new Set(
      releasePreproductionRequirements.map((item) => item.system)
    ),
  ],
});

console.log("Design Lab production release gate contract tests passed");
