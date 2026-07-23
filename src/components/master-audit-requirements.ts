import {
  PRODUCT_MASTER_PROMPT_ID,
  PRODUCT_MASTER_REQUIREMENTS,
} from "./product-master-requirements";
import { SECURITY_MASTER_REQUIREMENTS } from "./security-master-requirements";
import {
  PRODUCT_MASTER_EVIDENCE,
  SECURITY_MASTER_EVIDENCE,
} from "./master-audit-evidence";

export type MasterAuditPrompt = "product" | "security";

export type MasterAuditRequirement = {
  id: string;
  prompt: MasterAuditPrompt;
  promptId: string;
  section: string;
  requirement: string;
  status: string;
  evidence: readonly string[];
  owner: string;
  releaseBlocking: boolean;
  riskAcceptance?: {
    owner: string;
    reason: string;
    severity: "critical" | "high" | "medium" | "low";
    compensatingControls: readonly string[];
    expiresOn: string;
    remediationPlan: string;
    retestRequirement: string;
  };
  notApplicableJustification?: string;
  verificationScope?: "output-existence-only" | "final-report-structure-only";
};

export const MASTER_AUDIT_REQUIREMENTS: readonly MasterAuditRequirement[] = [
  ...PRODUCT_MASTER_REQUIREMENTS.map((requirement) => ({
    ...requirement,
    ...(PRODUCT_MASTER_EVIDENCE[requirement.id] ?? {}),
    prompt: "product" as const,
    promptId: PRODUCT_MASTER_PROMPT_ID,
  })),
  ...SECURITY_MASTER_REQUIREMENTS.map((requirement) => ({
    ...requirement,
    ...(SECURITY_MASTER_EVIDENCE[requirement.id] ?? {}),
    prompt: "security" as const,
    promptId: "greyhoundiq.security-traceability-master.2026-07-13",
  })),
];

export function isMasterRequirementComplete(
  requirement: MasterAuditRequirement,
) {
  if (requirement.evidence.length === 0) return false;
  if (requirement.prompt === "product") {
    return (
      ["verified", "tested", "excluded"].includes(requirement.status) &&
      (requirement.section !== "outputs" ||
        requirement.verificationScope === "output-existence-only")
    );
  }
  const isFinalReportStructure =
    requirement.section === "final-traceability-field" ||
    requirement.section === "final-summary-metric";
  if (
    isFinalReportStructure &&
    requirement.verificationScope !== "final-report-structure-only"
  ) {
    return false;
  }
  if (requirement.status === "verified") {
    if (requirement.section === "required-output") {
      return requirement.verificationScope === "output-existence-only";
    }
    return true;
  }
  if (requirement.status === "not-applicable-with-justification") {
    return Boolean(requirement.notApplicableJustification?.trim());
  }
  if (requirement.status !== "risk-accepted-temporarily") return false;

  const risk = requirement.riskAcceptance;
  return Boolean(
    risk &&
    (risk.severity === "medium" || risk.severity === "low") &&
    risk.owner.trim() &&
    risk.reason.trim() &&
    risk.compensatingControls.length > 0 &&
    Date.parse(risk.expiresOn) > Date.now() &&
    risk.remediationPlan.trim() &&
    risk.retestRequirement.trim(),
  );
}

export const MASTER_AUDIT_SUMMARY = {
  total: MASTER_AUDIT_REQUIREMENTS.length,
  completed: MASTER_AUDIT_REQUIREMENTS.filter(isMasterRequirementComplete)
    .length,
  releaseBlocking: MASTER_AUDIT_REQUIREMENTS.filter(
    (requirement) => requirement.releaseBlocking,
  ).length,
  releaseCompleted: MASTER_AUDIT_REQUIREMENTS.filter(
    (requirement) =>
      requirement.releaseBlocking && isMasterRequirementComplete(requirement),
  ).length,
  prompts: {
    product: MASTER_AUDIT_REQUIREMENTS.filter(
      (requirement) => requirement.prompt === "product",
    ).length,
    security: MASTER_AUDIT_REQUIREMENTS.filter(
      (requirement) => requirement.prompt === "security",
    ).length,
  },
} as const;
