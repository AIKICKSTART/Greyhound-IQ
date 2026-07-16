import type { FindingSeverityFactor } from "./finding-severity";

export const FINDING_SEVERITY_REQUIREMENT_FACTOR = {
  "security.finding-severity.exploitability": "exploitability",
  "security.finding-severity.authentication-required": "authenticationRequired",
  "security.finding-severity.required-role": "requiredRole",
  "security.finding-severity.cross-tenant-impact": "crossTenantImpact",
  "security.finding-severity.personal-information-impact":
    "personalInformationImpact",
  "security.finding-severity.financial-impact": "financialImpact",
  "security.finding-severity.administration-impact": "administrationImpact",
  "security.finding-severity.automation-potential": "automationPotential",
  "security.finding-severity.scale": "scale",
  "security.finding-severity.detectability": "detectability",
  "security.finding-severity.recoverability": "recoverability",
  "security.finding-severity.not-obscurity": "obscurityRule",
} as const satisfies Record<string, FindingSeverityFactor>;

export type FindingSeverityRequirementId =
  keyof typeof FINDING_SEVERITY_REQUIREMENT_FACTOR;

export const FINDING_SEVERITY_REQUIREMENT_IDS = Object.keys(
  FINDING_SEVERITY_REQUIREMENT_FACTOR,
) as FindingSeverityRequirementId[];

export const FINDING_SEVERITY_EVIDENCE_PATHS = [
  "docs/security/risk-register.md",
  "security/security-findings.ts",
  "security/finding-severity.ts",
  "security/finding-severity-evidence.ts",
  "security/finding-severity.test.ts",
] as const;

export const FINDING_SEVERITY_EVIDENCE_SCOPE =
  "Decision-completeness evidence for every maintained finding. It proves that all twelve severity factors are explicit; it does not prove the assigned severity is correct, the finding inventory is exhaustive or the risk is remediated.";

export const FINDING_SEVERITY_MASTER_EVIDENCE: Readonly<
  Record<
    FindingSeverityRequirementId,
    { readonly status: "verified"; readonly evidence: readonly string[] }
  >
> = Object.fromEntries(
  FINDING_SEVERITY_REQUIREMENT_IDS.map((requirementId) => [
    requirementId,
    {
      status: "verified" as const,
      evidence: FINDING_SEVERITY_EVIDENCE_PATHS,
    },
  ]),
) as unknown as Record<
  FindingSeverityRequirementId,
  { readonly status: "verified"; readonly evidence: readonly string[] }
>;
