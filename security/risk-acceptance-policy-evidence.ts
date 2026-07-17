export const RISK_ACCEPTANCE_POLICY_IDS = [
  "security.risk-acceptance.owner",
  "security.risk-acceptance.reason",
  "security.risk-acceptance.severity",
  "security.risk-acceptance.compensating-controls",
  "security.risk-acceptance.expiry",
  "security.risk-acceptance.remediation",
  "security.risk-acceptance.retest",
  "security.risk-acceptance.no-silent-critical-high",
] as const;

const RISK_ACCEPTANCE_POLICY_EVIDENCE = [
  "src/components/master-audit-requirements.ts",
  "security/risk-acceptance-policy.test.ts",
] as const;

export const RISK_ACCEPTANCE_POLICY_MASTER_EVIDENCE = Object.fromEntries(
  RISK_ACCEPTANCE_POLICY_IDS.map((id) => [
    id,
    {
      status: "verified" as const,
      evidence: RISK_ACCEPTANCE_POLICY_EVIDENCE,
    },
  ]),
);
