import {
  SCREEN_CONTRACT_CHECKLIST,
  SCREEN_CONTRACT_COVERAGE_AREAS,
  type ScreenContractCoverageArea,
} from "./demo-experience-registry";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
  type MasterAuditPrompt,
  type MasterAuditRequirement,
} from "./master-audit-requirements";
import {
  DESIGN_LAB_PREPRODUCTION_REQUIREMENTS,
  isDesignLabPreproductionRequirementComplete,
  type DesignLabPreproductionRequirement,
  type DesignLabPreproductionSystem,
} from "./design-lab-preproduction-requirements";
import {
  isDesignLabDatabaseOperationComplete,
} from "./design-lab-database-contracts";
import {
  DATABASE_OPERATIONS,
  type DatabaseOperationContract,
} from "../../security/database-operations";

export type DesignLabReleaseGateStatus = "blocked" | "ready-for-approval";

export type DesignLabReleaseBlocker = {
  area: ScreenContractCoverageArea;
  remaining: number;
  blocked: number;
};

export type DesignLabMasterRequirementBlocker = {
  prompt: MasterAuditPrompt;
  remaining: number;
};

export type DesignLabPreproductionBlocker = {
  system: DesignLabPreproductionSystem;
  remaining: number;
  blocked: number;
};

export const DESIGN_LAB_PRODUCTION_PROMOTION = {
  schemaVersion: 2,
  approvalAuthority: "GitHub production environment",
  sourceOfTruth: "Design Lab product-contract checklist",
  target: "Google Cloud Run production",
  dataBoundary:
    "Production credentials and the live database remain available only to the approved server-side deployment environment.",
  commitBinding:
    "The approved commit must be supplied as an exact 40-character Git SHA and must have a successful CI run.",
  evidenceBinding:
    "Approval must include the SHA-256 digest of the complete Design Lab screen, prompt, provider, capacity and database-query evidence for that commit.",
  artifactBinding:
    "The workflow resolves the built container to an immutable image digest before deployment.",
  browserApproval: false,
} as const;

export function evaluateDesignLabReleaseGate(
  checklist = SCREEN_CONTRACT_CHECKLIST,
  requirements: readonly MasterAuditRequirement[] = MASTER_AUDIT_REQUIREMENTS,
  preproductionRequirements: readonly DesignLabPreproductionRequirement[] =
    DESIGN_LAB_PREPRODUCTION_REQUIREMENTS,
  databaseOperations: readonly DatabaseOperationContract[] = DATABASE_OPERATIONS
) {
  const blockers: DesignLabReleaseBlocker[] = checklist
    .filter((item) => item.completed !== item.total || item.blocked > 0)
    .map((item) => ({
      area: item.area,
      remaining: item.total - item.completed,
      blocked: item.blocked,
    }));
  const releaseRequirements = requirements.filter(
    (requirement) => requirement.releaseBlocking
  );
  const releasePreproductionRequirements = preproductionRequirements.filter(
    (requirement) => requirement.releaseBlocking,
  );
  const completedRequirements = releaseRequirements.filter(
    isMasterRequirementComplete
  ).length;
  const masterBlockers: DesignLabMasterRequirementBlocker[] = (
    ["product", "security"] as const
  )
    .map((prompt) => ({
      prompt,
      remaining: releaseRequirements.filter(
        (requirement) =>
          requirement.prompt === prompt &&
          !isMasterRequirementComplete(requirement)
      ).length,
    }))
    .filter((blocker) => blocker.remaining > 0);
  const completedScreenChecks = checklist.reduce(
    (total, item) => total + item.completed,
    0
  );
  const totalScreenChecks = checklist.reduce(
    (total, item) => total + item.total,
    0
  );
  const completedPreproductionRequirements = releasePreproductionRequirements.filter(
    isDesignLabPreproductionRequirementComplete,
  ).length;
  const preproductionBlockers: DesignLabPreproductionBlocker[] = [
    ...new Set(releasePreproductionRequirements.map((item) => item.system)),
  ]
    .map((system) => {
      const open = releasePreproductionRequirements.filter(
        (item) =>
          item.system === system &&
          !isDesignLabPreproductionRequirementComplete(item)
      );
      return {
        system,
        remaining: open.length,
        blocked: open.filter((item) => item.status === "blocked").length,
      };
    })
    .filter((blocker) => blocker.remaining > 0);
  const completedDatabaseOperations = databaseOperations.filter(
    isDesignLabDatabaseOperationComplete
  ).length;
  const databaseBlocker =
    completedDatabaseOperations === databaseOperations.length
      ? null
      : {
          remaining: databaseOperations.length - completedDatabaseOperations,
          total: databaseOperations.length,
        };

  return {
    status: (checklist.length > 0 &&
    releaseRequirements.length > 0 &&
    releasePreproductionRequirements.length > 0 &&
    databaseOperations.length > 0 &&
    blockers.length === 0 &&
    masterBlockers.length === 0 &&
    preproductionBlockers.length === 0 &&
    databaseBlocker === null
      ? "ready-for-approval"
      : "blocked") as DesignLabReleaseGateStatus,
    blockers,
    masterBlockers,
    preproductionBlockers,
    databaseBlocker,
    completedChecks:
      completedScreenChecks +
      completedRequirements +
      completedPreproductionRequirements +
      completedDatabaseOperations,
    totalChecks:
      totalScreenChecks +
      releaseRequirements.length +
      releasePreproductionRequirements.length +
      databaseOperations.length,
    requiredAreas: [...SCREEN_CONTRACT_COVERAGE_AREAS],
    requiredPrompts: ["product", "security"] as const,
    requiredPreproductionSystems: [
      ...new Set(releasePreproductionRequirements.map((item) => item.system)),
    ],
  } as const;
}

export const DESIGN_LAB_RELEASE_GATE = evaluateDesignLabReleaseGate();
