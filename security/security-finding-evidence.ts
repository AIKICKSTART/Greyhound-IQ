const SECURITY_FINDING_EVIDENCE = [
  "security/security-findings.ts",
  "security/security-findings.test.ts",
  "docs/security/risk-register.md",
] as const;

export const SECURITY_FINDING_FIELD_BINDINGS = {
  "security.security-finding-record.field.finding-id": "findingId",
  "security.security-finding-record.field.title": "title",
  "security.security-finding-record.field.severity": "severity",
  "security.security-finding-record.field.affected-trace-ids": "affectedTraceIds",
  "security.security-finding-record.field.affected-environments": "affectedEnvironments",
  "security.security-finding-record.field.affected-actors": "affectedActors",
  "security.security-finding-record.field.affected-records": "affectedRecords",
  "security.security-finding-record.field.data-classification": "dataClassification",
  "security.security-finding-record.field.source-file": "sourceFile",
  "security.security-finding-record.field.source-symbol": "sourceSymbol",
  "security.security-finding-record.field.endpoint": "endpoint",
  "security.security-finding-record.field.database-operation": "databaseOperation",
  "security.security-finding-record.field.description": "description",
  "security.security-finding-record.field.actual-behaviour": "actualBehaviour",
  "security.security-finding-record.field.expected-behaviour": "expectedBehaviour",
  "security.security-finding-record.field.attack-preconditions": "attackPreconditions",
  "security.security-finding-record.field.business-impact": "businessImpact",
  "security.security-finding-record.field.privacy-impact": "privacyImpact",
  "security.security-finding-record.field.evidence": "evidence",
  "security.security-finding-record.field.root-cause": "rootCause",
  "security.security-finding-record.field.immediate-containment": "immediateContainment",
  "security.security-finding-record.field.permanent-remediation": "permanentRemediation",
  "security.security-finding-record.field.regression-tests": "regressionTests",
  "security.security-finding-record.field.owner": "owner",
  "security.security-finding-record.field.target-date": "targetDate",
  "security.security-finding-record.field.status": "status",
  "security.security-finding-record.field.residual-risk": "residualRisk",
  "security.security-finding-record.field.retest-evidence": "retestEvidence",
} as const;

export const SECURITY_FINDING_MASTER_EVIDENCE = Object.fromEntries(
  Object.keys(SECURITY_FINDING_FIELD_BINDINGS).map((id) => [
    id,
    {
      status: "verified" as const,
      evidence: SECURITY_FINDING_EVIDENCE,
    },
  ]),
);
