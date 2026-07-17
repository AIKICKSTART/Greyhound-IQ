import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  DATABASE_OPERATIONS,
  DATABASE_OPERATION_TYPES,
} from "../../security/database-operations";
import { ENDPOINTS } from "../../security/endpoints";
import { THIRD_PARTIES } from "../../security/third-parties";
import {
  SECURITY_TRACES,
  SECURITY_TRACE_ACTION_TYPES,
  SECURITY_TRACE_AUTHENTICATION_VALUES,
} from "../../security/traces";
import {
  FINAL_SUMMARY_METRIC_REQUIREMENTS,
  FINAL_TRACEABILITY_FIELD_REQUIREMENTS,
} from "../../security/final-traceability";
import {
  SECURITY_MASTER_EVIDENCE,
  SECURITY_REGISTRY_ENUM_SET_SOURCES,
  SECURITY_REGISTRY_RECORD_SET_SOURCES,
  TESTED_SECURITY_REGISTRY_ENUM_REQUIREMENTS,
  TESTED_SECURITY_REGISTRY_FIELD_REQUIREMENTS,
} from "./master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "./master-audit-requirements";
import { SECURITY_MASTER_REQUIREMENTS } from "./security-master-requirements";

const evidenceTest =
  "src/components/master-audit-security-registry-evidence.test.ts";

const recordSets: Record<
  keyof typeof TESTED_SECURITY_REGISTRY_FIELD_REQUIREMENTS,
  readonly object[]
> = {
  endpoints: ENDPOINTS,
  databaseOperations: DATABASE_OPERATIONS,
  securityTraces: SECURITY_TRACES,
  securityTraceFrontend: SECURITY_TRACES.map((trace) => trace.frontend),
  securityTraceTransport: SECURITY_TRACES.map((trace) => trace.transport),
  securityTraceServer: SECURITY_TRACES.map((trace) => trace.server),
  securityTraceCacheOperations: flattenObjects(
    SECURITY_TRACES.map((trace) => trace.cacheOperations),
  ),
  securityTraceBackgroundOperations: flattenObjects(
    SECURITY_TRACES.map((trace) => trace.backgroundOperations),
  ),
  securityTraceExternalOperations: flattenObjects(
    SECURITY_TRACES.map((trace) => trace.externalOperations),
  ),
  securityTraceResponses: SECURITY_TRACES.map((trace) => trace.response),
  securityTraceFailureModes: flattenObjects(
    SECURITY_TRACES.map((trace) => trace.failureModes),
  ),
  thirdParties: THIRD_PARTIES,
};

const fieldSubjects = {
  endpoints: "Every API inventory endpoint record",
  databaseOperations: "Each DatabaseOperationContract",
  securityTraces: "Each SecurityTraceContract",
  securityTraceFrontend: "Each SecurityTraceContract frontend record",
  securityTraceTransport: "Each SecurityTraceContract transport record",
  securityTraceServer: "Each SecurityTraceContract server record",
  securityTraceCacheOperations: "Each SecurityTraceContract cache operation",
  securityTraceBackgroundOperations:
    "Each SecurityTraceContract background operation",
  securityTraceExternalOperations:
    "Each SecurityTraceContract external operation",
  securityTraceResponses: "Each SecurityTraceContract response",
  securityTraceFailureModes: "Each SecurityTraceContract failure mode",
  thirdParties: "Every external-provider record",
} as const;

for (const [recordSet, requirements] of Object.entries(
  TESTED_SECURITY_REGISTRY_FIELD_REQUIREMENTS,
)) {
  const typedRecordSet = recordSet as keyof typeof recordSets;
  const records = recordSets[typedRecordSet];
  assert.ok(records.length > 0, `${recordSet} needs a non-vacuous fixture`);

  for (const [id, field] of Object.entries(requirements)) {
    assert.equal(
      recordsHaveExplicitField(records, field),
      true,
      `${id} requires every ${recordSet} record to own a defined ${field}`,
    );

    const firstWithoutField = Object.fromEntries(
      Object.entries(records[0]).filter(([key]) => key !== field),
    );
    assert.equal(
      recordsHaveExplicitField([firstWithoutField, ...records.slice(1)], field),
      false,
      `${id} must fail closed when one record omits ${field}`,
    );

    const requirement = SECURITY_MASTER_REQUIREMENTS.find(
      (candidate) => candidate.id === id,
    );
    assert.ok(requirement, `${id} must remain in the security master registry`);
    assert.equal(
      requirement.requirement,
      `${fieldSubjects[typedRecordSet]} must record ${field}.`,
    );
    assert.deepEqual(SECURITY_MASTER_EVIDENCE[id], {
      status: "verified",
      evidence: [
        SECURITY_REGISTRY_RECORD_SET_SOURCES[typedRecordSet],
        evidenceTest,
      ],
    });
    assert.equal(isMasterRequirementComplete(masterRequirement(id)), true);
  }
}

const enumSets: Record<
  keyof typeof TESTED_SECURITY_REGISTRY_ENUM_REQUIREMENTS,
  readonly string[]
> = {
  securityTraceAuthentication: SECURITY_TRACE_AUTHENTICATION_VALUES,
  securityTraceActionType: SECURITY_TRACE_ACTION_TYPES,
  databaseOperationType: DATABASE_OPERATION_TYPES,
};

const enumSubjects = {
  securityTraceAuthentication: "SecurityTraceContract authentication value",
  securityTraceActionType: "SecurityTraceContract action type",
  databaseOperationType: "DatabaseOperationContract operation type",
} as const;

for (const [enumSet, requirements] of Object.entries(
  TESTED_SECURITY_REGISTRY_ENUM_REQUIREMENTS,
)) {
  const typedEnumSet = enumSet as keyof typeof enumSets;
  const values: readonly string[] = enumSets[typedEnumSet];
  const requiredValues = Object.values(requirements);
  assert.deepEqual(missingValues(values, requiredValues), []);

  for (const [id, value] of Object.entries(requirements)) {
    assert.deepEqual(
      missingValues(
        values.filter((candidate) => candidate !== value),
        requiredValues,
      ),
      [value],
      `${id} must fail closed when ${value} is removed`,
    );

    const requirement = SECURITY_MASTER_REQUIREMENTS.find(
      (candidate) => candidate.id === id,
    );
    assert.ok(requirement, `${id} must remain in the security master registry`);
    assert.equal(
      requirement.requirement,
      `Allow ${value} as a ${enumSubjects[typedEnumSet]}.`,
    );
    assert.deepEqual(SECURITY_MASTER_EVIDENCE[id], {
      status: "verified",
      evidence: [
        SECURITY_REGISTRY_ENUM_SET_SOURCES[typedEnumSet],
        evidenceTest,
      ],
    });
    assert.equal(isMasterRequirementComplete(masterRequirement(id)), true);
  }
}

const governanceEvidence = {
  "security.api-inventory-management.code-exists": [
    "security/endpoints.ts",
    "security/registry.test.ts",
  ],
  "security.ci.03.nonexistent-inventory-endpoint": [
    "security/endpoints.ts",
    "security/registry.test.ts",
  ],
  "security.ci.11.database-operation-no-trace": [
    "security/database-operations.ts",
    "security/registry.test.ts",
  ],
  "security.security-trace-contract.ci-validation": [
    "security/registry.test.ts",
    "scripts/run-unit-tests.ts",
    "package.json",
    ".github/workflows/ci.yml",
  ],
  "security.registry-governance.machine-readable": [
    "security/endpoints.ts",
    "security/traces.ts",
    "security/database-operations.ts",
    "security/third-parties.ts",
    "security/registry.test.ts",
  ],
} as const;

for (const [id, evidence] of Object.entries(governanceEvidence)) {
  const requirement = SECURITY_MASTER_REQUIREMENTS.find(
    (candidate) => candidate.id === id,
  );
  assert.ok(requirement, `${id} must remain in the security master registry`);
  assert.deepEqual(SECURITY_MASTER_EVIDENCE[id], {
    status: "verified",
    evidence,
  });
  assert.equal(isMasterRequirementComplete(masterRequirement(id)), true);
}

const finalReportEvidence = [
  "security/final-traceability.ts",
  "security/final-traceability.test.ts",
  "docs/security/security-trace-registry.md",
  evidenceTest,
] as const;
const finalReportRequirements = {
  ...FINAL_TRACEABILITY_FIELD_REQUIREMENTS,
  ...FINAL_SUMMARY_METRIC_REQUIREMENTS,
};
const finalReportEvidenceIds = Object.entries(SECURITY_MASTER_EVIDENCE)
  .filter(
    ([, record]) => record.verificationScope === "final-report-structure-only",
  )
  .map(([id]) => id)
  .sort();

assert.deepEqual(
  finalReportEvidenceIds,
  Object.keys(finalReportRequirements).sort(),
  "final-report structural evidence must cover exactly the immutable 23 field and 21 metric IDs",
);
assert.equal(finalReportEvidenceIds.length, 44);

for (const id of finalReportEvidenceIds) {
  const expectedSection = Object.prototype.hasOwnProperty.call(
    FINAL_TRACEABILITY_FIELD_REQUIREMENTS,
    id,
  )
    ? "final-traceability-field"
    : "final-summary-metric";
  const requirement = SECURITY_MASTER_REQUIREMENTS.find(
    (candidate) => candidate.id === id,
  );
  assert.ok(requirement, `${id} must remain in the security master registry`);
  assert.equal(requirement.section, expectedSection);
  assert.deepEqual(SECURITY_MASTER_EVIDENCE[id], {
    status: "verified",
    verificationScope: "final-report-structure-only",
    evidence: finalReportEvidence,
  });

  const merged = masterRequirement(id);
  assert.equal(merged.verificationScope, "final-report-structure-only");
  assert.equal(isMasterRequirementComplete(merged), true);
  assert.equal(
    isMasterRequirementComplete({ ...merged, verificationScope: undefined }),
    false,
    `${id} must fail closed when its structural verification scope is missing`,
  );
}

const repositoryRoot = resolve(__dirname, "../..");
const packageJson = JSON.parse(
  readFileSync(resolve(repositoryRoot, "package.json"), "utf8"),
) as { scripts: Record<string, string> };
assert.match(packageJson.scripts.ci, /npm run test:unit/);
assert.match(
  readFileSync(resolve(repositoryRoot, "scripts/run-unit-tests.ts"), "utf8"),
  /\["src", "scripts", "security"\]\.flatMap\(findTestFiles\)/,
);
assert.match(
  readFileSync(resolve(repositoryRoot, ".github/workflows/ci.yml"), "utf8"),
  /run: npm run test:unit/,
);

console.log(
  `Security registry structural evidence passed: ${Object.values(
    TESTED_SECURITY_REGISTRY_FIELD_REQUIREMENTS,
  ).reduce(
    (total, requirements) => total + Object.keys(requirements).length,
    0,
  )} fields and ${Object.values(
    TESTED_SECURITY_REGISTRY_ENUM_REQUIREMENTS,
  ).reduce(
    (total, requirements) => total + Object.keys(requirements).length,
    0,
  )} enum values`,
);

function recordsHaveExplicitField(records: readonly object[], field: string) {
  return (
    records.length > 0 &&
    records.every(
      (record) =>
        Object.prototype.hasOwnProperty.call(record, field) &&
        Reflect.get(record, field) !== undefined,
    )
  );
}

function flattenObjects(groups: readonly (readonly object[])[]) {
  return groups.flatMap((group) => group);
}

function missingValues(actual: readonly string[], required: readonly string[]) {
  const actualValues = new Set(actual);
  return required.filter((value) => !actualValues.has(value));
}

function masterRequirement(id: string) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.prompt === "security" && candidate.id === id,
  );
  assert.ok(requirement, `${id} must remain in the combined master registry`);
  return requirement;
}
