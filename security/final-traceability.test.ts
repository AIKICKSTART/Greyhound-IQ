import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  FINAL_SUMMARY_METRIC_REQUIREMENTS,
  FINAL_TRACEABILITY_FIELD_REQUIREMENTS,
  FINAL_TRACEABILITY_ROWS,
  buildFinalTraceabilitySummary,
  renderFinalTraceabilityMarkdown,
  validateFinalTraceabilityRows,
  validateFinalTraceabilitySummary,
  type FinalSummaryMetricKey,
  type FinalTraceabilityRow,
} from "./final-traceability";
import { SECURITY_TRACES } from "./traces";

const repositoryRoot = resolve(__dirname, "..");
const reportPath = resolve(
  repositoryRoot,
  "docs/security/security-trace-registry.md",
);
const finalFieldRequirements = SECURITY_MASTER_REQUIREMENTS.filter(
  (requirement) => requirement.section === "final-traceability-field",
);
const finalMetricRequirements = SECURITY_MASTER_REQUIREMENTS.filter(
  (requirement) => requirement.section === "final-summary-metric",
);
const securityMaster = MASTER_AUDIT_REQUIREMENTS.filter(
  (requirement) => requirement.prompt === "security",
);
const now = Date.now();
const acceptedRiskRecords = securityMaster.filter(
  (requirement) => requirement.status === "risk-accepted-temporarily",
);
const summaryInputs = {
  mandatoryTraceRequirementCount: SECURITY_MASTER_REQUIREMENTS.filter(
    (requirement) => requirement.section === "mandatory-trace",
  ).length,
  acceptedRisks: acceptedRiskRecords.length,
  expiredRiskAcceptances: acceptedRiskRecords.filter(
    (requirement) =>
      !requirement.riskAcceptance ||
      Date.parse(requirement.riskAcceptance.expiresOn) <= now,
  ).length,
};
const summary = buildFinalTraceabilitySummary(summaryInputs);

assert.equal(finalFieldRequirements.length, 23);
assert.equal(finalMetricRequirements.length, 21);
assert.deepEqual(
  Object.keys(FINAL_TRACEABILITY_FIELD_REQUIREMENTS).sort(),
  finalFieldRequirements.map((requirement) => requirement.id).sort(),
  "the final row map must use the exact immutable 23 requirement IDs",
);
assert.deepEqual(
  Object.keys(FINAL_SUMMARY_METRIC_REQUIREMENTS).sort(),
  finalMetricRequirements.map((requirement) => requirement.id).sort(),
  "the summary map must use the exact immutable 21 requirement IDs",
);
assert.equal(FINAL_TRACEABILITY_ROWS.length, 19);
assert.deepEqual(
  FINAL_TRACEABILITY_ROWS.map((row) => row.traceId).sort(),
  SECURITY_TRACES.map((trace) => trace.traceId).sort(),
  "the final report must contain exactly the current trace registry",
);
assert.deepEqual(validateFinalTraceabilityRows(FINAL_TRACEABILITY_ROWS), []);
assert.deepEqual(validateFinalTraceabilitySummary(summary, summary), []);

for (const field of Object.values(FINAL_TRACEABILITY_FIELD_REQUIREMENTS)) {
  const missingField = withoutField(FINAL_TRACEABILITY_ROWS[0], field);
  assert.ok(
    validateFinalTraceabilityRows([
      missingField,
      ...FINAL_TRACEABILITY_ROWS.slice(1),
    ]).includes(`MISSING_FIELD:${field}`),
    `${field} must fail closed when omitted`,
  );
}

const duplicateTraceRows = [
  FINAL_TRACEABILITY_ROWS[0],
  FINAL_TRACEABILITY_ROWS[0],
  ...FINAL_TRACEABILITY_ROWS.slice(1),
];
assert.ok(
  validateFinalTraceabilityRows(duplicateTraceRows).includes(
    `DUPLICATE_TRACE_ID:${FINAL_TRACEABILITY_ROWS[0].traceId}`,
  ),
);
const unknownTraceRows = [
  { ...FINAL_TRACEABILITY_ROWS[0], traceId: "TRACE.NOT.REGISTERED" },
  ...FINAL_TRACEABILITY_ROWS.slice(1),
];
assert.ok(
  validateFinalTraceabilityRows(unknownTraceRows).includes(
    "UNKNOWN_TRACE_ID:TRACE.NOT.REGISTERED",
  ),
);
assert.ok(
  validateFinalTraceabilityRows(FINAL_TRACEABILITY_ROWS.slice(1)).includes(
    `MISSING_TRACE_ID:${FINAL_TRACEABILITY_ROWS[0].traceId}`,
  ),
);
const statusOverclaim = [
  { ...FINAL_TRACEABILITY_ROWS[0], verificationStatus: "Verified" as const },
  ...FINAL_TRACEABILITY_ROWS.slice(1),
];
assert.ok(
  validateFinalTraceabilityRows(statusOverclaim).includes(
    `STATUS_OVERCLAIM:${FINAL_TRACEABILITY_ROWS[0].traceId}`,
  ),
);
const falseFindingCompleteness = [
  {
    ...FINAL_TRACEABILITY_ROWS[0],
    openFindings: {
      status: "known" as const,
      value: [],
      scope: "all findings",
      reason: "none",
      evidence: [],
    },
  },
  ...FINAL_TRACEABILITY_ROWS.slice(1),
];
assert.ok(
  validateFinalTraceabilityRows(falseFindingCompleteness).includes(
    `OPEN_FINDINGS_FALSE_COMPLETENESS:${FINAL_TRACEABILITY_ROWS[0].traceId}`,
  ),
);

for (const metric of Object.values(FINAL_SUMMARY_METRIC_REQUIREMENTS)) {
  const missingMetric = Object.fromEntries(
    Object.entries(summary).filter(([key]) => key !== metric),
  );
  assert.ok(
    validateFinalTraceabilitySummary(missingMetric, summary).includes(
      `MISSING_METRIC:${metric}`,
    ),
    `${metric} must fail closed when omitted`,
  );
}

for (const metric of [
  "totalApis",
  "totalDatabaseOperations",
  "totalExternalIntegrations",
  "totalTracesVerified",
  "totalTracesPartiallyVerified",
  "acceptedRisks",
  "expiredRiskAcceptances",
  "missingTests",
  "missingOwners",
  "missingAuditEvents",
  "deprecatedEndpoints",
] satisfies readonly FinalSummaryMetricKey[]) {
  const current = summary[metric];
  assert.notEqual(current.value, null, `${metric} needs a numeric fixture`);
  const drifted = {
    ...summary,
    [metric]: { ...current, value: current.value! + 1 },
  };
  assert.ok(
    validateFinalTraceabilitySummary(drifted, summary).includes(
      `METRIC_DRIFT:${metric}`,
    ),
    `${metric} must reject registry-count drift`,
  );
}

for (const metric of Object.values(FINAL_SUMMARY_METRIC_REQUIREMENTS)) {
  const current = summary[metric];
  if (current.status !== "unknown") continue;
  const fabricated = {
    ...summary,
    [metric]: {
      status: "known" as const,
      value: 0,
      scope: current.scope,
      reason: "unsupported numeric conclusion",
      evidence: current.evidence,
    },
  };
  assert.ok(
    validateFinalTraceabilitySummary(fabricated, summary).includes(
      `UNSUPPORTED_COMPLETE_METRIC:${metric}`,
    ),
    `${metric} must not turn an unsupported unknown into a number`,
  );
}

const riskRegister = readFileSync(
  resolve(repositoryRoot, "docs/security/risk-register.md"),
  "utf8",
);
const documentedHighFindings = [...riskRegister.matchAll(/^## `SEC-H-\d{3}`/gm)]
  .length;
assert.equal(
  summary.highFindings.observed?.documentedOpenHighFindings,
  documentedHighFindings,
  "the partial prose finding observation must not drift",
);

const report = renderFinalTraceabilityMarkdown(
  FINAL_TRACEABILITY_ROWS,
  summary,
);
const committedReport = readFileSync(reportPath, "utf8").replace(/\r\n/g, "\n");
assert.equal(
  committedReport,
  report,
  "docs/security/security-trace-registry.md must be the exact generated report",
);
assert.notEqual(`${committedReport}\nmanual drift`, report);
assert.doesNotMatch(
  committedReport,
  /No open findings|All traces verified|Production ready/i,
);

for (const requirement of [
  ...finalFieldRequirements,
  ...finalMetricRequirements,
]) {
  const merged = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) =>
      candidate.prompt === "security" && candidate.id === requirement.id,
  );
  assert.ok(
    merged,
    `${requirement.id} must remain in the merged master registry`,
  );
  assert.equal(merged.verificationScope, "final-report-structure-only");
  assert.equal(isMasterRequirementComplete(merged), true);
  assert.equal(
    isMasterRequirementComplete({ ...merged, verificationScope: undefined }),
    false,
    `${requirement.id} must not complete without its narrow scope`,
  );
}

console.log(
  `Final security traceability report passed: ${FINAL_TRACEABILITY_ROWS.length} rows, 23 fields, 21 metrics, structure only`,
);

function withoutField(record: FinalTraceabilityRow, field: string) {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== field),
  );
}
