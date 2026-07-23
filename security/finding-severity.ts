export const FINDING_SEVERITY_FACTORS = [
  "exploitability",
  "authenticationRequired",
  "requiredRole",
  "crossTenantImpact",
  "personalInformationImpact",
  "financialImpact",
  "administrationImpact",
  "automationPotential",
  "scale",
  "detectability",
  "recoverability",
  "obscurityRule",
] as const;

export type FindingSeverityFactor =
  (typeof FINDING_SEVERITY_FACTORS)[number];

export type FindingSeveritySource = {
  readonly findingId: string;
  readonly severity: string;
  readonly endpoint: string;
  readonly affectedActors: string;
  readonly affectedEnvironments: string;
  readonly affectedRecords: string;
  readonly attackPreconditions: string;
  readonly businessImpact: string;
  readonly privacyImpact: string;
  readonly immediateContainment: string;
  readonly permanentRemediation: string;
  readonly residualRisk: string;
  readonly evidence: string;
};

export type FindingSeverityAssessment = Record<FindingSeverityFactor, string> & {
  readonly assessmentId: string;
  readonly findingId: string;
  readonly assignedSeverity: string;
};

export function buildFindingSeverityAssessments(
  findings: readonly FindingSeveritySource[],
): FindingSeverityAssessment[] {
  return findings.map((finding) => ({
    assessmentId: `severity:${cleanId(finding.findingId)}`,
    findingId: cleanId(finding.findingId),
    assignedSeverity: finding.severity,
    exploitability: `Attack preconditions: ${finding.attackPreconditions}`,
    authenticationRequired: authenticationDecision(finding),
    requiredRole: `Affected actors and required privilege context: ${finding.affectedActors}`,
    crossTenantImpact: impactDecision(
      finding,
      /cross[- ]tenant|other (?:user|member|person|party)|tenant|counterpart/i,
      "Cross-tenant or cross-user impact",
    ),
    personalInformationImpact: `Privacy impact: ${finding.privacyImpact}`,
    financialImpact: impactDecision(
      finding,
      /billing|financial|payment|invoice|refund|credit|stripe|lago|cost/i,
      "Financial impact",
    ),
    administrationImpact: impactDecision(
      finding,
      /admin|moderator|privilege|operator|iam|deploy|control plane/i,
      "Administrative impact",
    ),
    automationPotential: automationDecision(finding),
    scale: `Affected environments: ${finding.affectedEnvironments}; affected records: ${finding.affectedRecords}`,
    detectability: detectabilityDecision(finding),
    recoverability: `Containment: ${finding.immediateContainment}; remediation: ${finding.permanentRemediation}`,
    obscurityRule:
      "Route obscurity, missing documentation or difficult discovery never lowers the assigned severity.",
  }));
}

export function validateFindingSeverityAssessments(
  findings: readonly FindingSeveritySource[],
  assessments: readonly FindingSeverityAssessment[],
) {
  const expectedIds = new Set(
    findings.map((finding) => `severity:${cleanId(finding.findingId)}`),
  );
  const seen = new Set<string>();
  const issues: string[] = [];

  for (const assessment of assessments) {
    if (seen.has(assessment.assessmentId)) {
      issues.push(`DUPLICATE:${assessment.assessmentId}`);
    }
    seen.add(assessment.assessmentId);
    if (!expectedIds.has(assessment.assessmentId)) {
      issues.push(`UNEXPECTED:${assessment.assessmentId}`);
    }
    if (!assessment.assignedSeverity.trim()) {
      issues.push(`MISSING_SEVERITY:${assessment.assessmentId}`);
    }
    for (const factor of FINDING_SEVERITY_FACTORS) {
      if (
        !Object.prototype.hasOwnProperty.call(assessment, factor) ||
        typeof assessment[factor] !== "string" ||
        !assessment[factor].trim()
      ) {
        issues.push(`MISSING_FACTOR:${assessment.assessmentId}:${factor}`);
      }
    }
    if (!/never lowers/i.test(assessment.obscurityRule)) {
      issues.push(`OBSCURITY_DOWNGRADE:${assessment.assessmentId}`);
    }
  }
  for (const expectedId of expectedIds) {
    if (!seen.has(expectedId)) issues.push(`MISSING_ASSESSMENT:${expectedId}`);
  }
  return issues.sort();
}

function authenticationDecision(finding: FindingSeveritySource) {
  const context = `${finding.attackPreconditions} ${finding.affectedActors}`;
  if (/unauthenticated|public visitor|no authentication/i.test(context)) {
    return "Unauthenticated exploitation is present or plausible in the recorded preconditions; do not assume a session is required.";
  }
  if (/session|authenticated|valid user|member|moderator|administrator|operator/i.test(context)) {
    return `Authentication or a privileged identity is required in the recorded scenario: ${finding.attackPreconditions}`;
  }
  return "Authentication requirement is not established by current evidence; uncertainty does not reduce severity.";
}

function impactDecision(
  finding: FindingSeveritySource,
  pattern: RegExp,
  label: string,
) {
  const context = [
    finding.affectedActors,
    finding.affectedRecords,
    finding.businessImpact,
    finding.privacyImpact,
    finding.residualRisk,
  ].join(" ");
  return pattern.test(context)
    ? `${label} is present in the recorded impact or residual-risk evidence: ${finding.businessImpact}`
    : `${label} is not established by current evidence; reassess during retest and do not lower severity solely for this uncertainty.`;
}

function automationDecision(finding: FindingSeveritySource) {
  const context = `${finding.endpoint} ${finding.attackPreconditions} ${finding.businessImpact}`;
  return /api|webhook|credential|token|public|autom|batch|queue|worker|request/i.test(
    context,
  )
    ? `Automation or repeated execution is plausible from the endpoint/precondition evidence: ${finding.endpoint}`
    : "Automation potential is not established by current evidence; retest must consider repetition and distributed execution before downgrading.";
}

function detectabilityDecision(finding: FindingSeveritySource) {
  return /monitor|alert|audit|detect|telemetry/i.test(
    `${finding.immediateContainment} ${finding.evidence}`,
  )
    ? `Detection evidence or containment monitoring is referenced: ${finding.immediateContainment}`
    : "Reliable detection is not established; treat low detectability as increasing, never decreasing, risk.";
}

function cleanId(value: string) {
  return value.replaceAll("`", "");
}
