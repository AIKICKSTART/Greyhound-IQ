import {
  THREAT_MODEL_AREA_RECORDS,
  THREAT_MODEL_COVERAGE_RECORDS,
} from "./threat-model-coverage";

const THREAT_MODEL_COVERAGE_EVIDENCE = [
  "security/threat-model-coverage.ts",
  "security/threat-model-coverage.test.ts",
  "docs/security/threat-model.md",
  "docs/security/abuse-case-map.md",
  "docs/security/risk-register.md",
] as const;

const modeledRequirementIds = [
  ...THREAT_MODEL_AREA_RECORDS.flatMap((record) => [
    record.threatModelRequirementId,
    record.abuseCaseRequirementId,
  ]),
  ...THREAT_MODEL_COVERAGE_RECORDS.map((record) => record.requirementId),
];

export const THREAT_MODEL_COVERAGE_MASTER_EVIDENCE = Object.fromEntries(
  modeledRequirementIds.map((id) => [
    id,
    {
      status: "verified" as const,
      evidence: THREAT_MODEL_COVERAGE_EVIDENCE,
    },
  ]),
);
