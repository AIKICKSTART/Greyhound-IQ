import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { SCREEN_CONTRACTS } from "./demo-experience-registry";
import {
  PRODUCT_FORM_OPERATIONAL_CONTRACT_EVIDENCE_FILE,
  PRODUCT_FORM_OPERATIONAL_CONTRACT_EXPECTED_GAIN,
  PRODUCT_FORM_OPERATIONAL_CONTRACT_MASTER_EVIDENCE,
  PRODUCT_FORM_OPERATIONAL_CONTRACT_REQUIREMENT_IDS,
  PRODUCT_FORM_OPERATIONAL_CONTRACT_SCOPE,
  PRODUCT_FORM_OPERATIONAL_CONTRACT_TEST_FILE,
  PRODUCT_FORM_MAPPING_COMPLETION_REQUIREMENT_IDS,
} from "./product-form-operational-contract-evidence";
import {
  PRODUCT_FIELD_CONTRACT_SOURCE_EVIDENCE_FILE,
  PRODUCT_FIELD_CONTRACT_SOURCE_TEST_FILE,
} from "./product-field-contract-source-evidence";
import {
  PRODUCT_FORM_OPERATIONAL_SIGNAL_KINDS,
  buildProductFormOperationalContractRegistry,
} from "./product-form-operational-contract-registry";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-FORM-OPERATIONAL-CONTRACT-EVIDENCE

const EXPECTED_REQUIREMENT_IDS = [
  "FORM.FIELD.story",
  "FORM.FIELD.actor",
  "FORM.FIELD.purpose",
  "FORM.FIELD.mutation",
  "FORM.FIELD.authentication",
  "FORM.FIELD.ownership",
  "FORM.FIELD.role",
  "FORM.FIELD.tier",
  "FORM.FIELD.update-strategy",
  "FORM.FIELD.pending",
  "FORM.FIELD.duplicate-prevention",
  "FORM.FIELD.success",
  "FORM.FIELD.failure",
  "FORM.FIELD.audit",
  "FORM.FIELD.analytics",
] as const;
const CORE_FORM_REQUIREMENT_IDS = [
  "FORM.FIELD.id",
  "FORM.FIELD.route",
  "FORM.FIELD.destination",
] as const;
const EXPECTED_COMPLETION_REQUIREMENT_IDS = [
  "COMPLETE.EVIDENCE.forms-mapped",
] as const;

assert.deepEqual(
  PRODUCT_FORM_OPERATIONAL_CONTRACT_REQUIREMENT_IDS,
  EXPECTED_REQUIREMENT_IDS,
);
assert.deepEqual(
  PRODUCT_FORM_MAPPING_COMPLETION_REQUIREMENT_IDS,
  EXPECTED_COMPLETION_REQUIREMENT_IDS,
);
assert.equal(PRODUCT_FORM_OPERATIONAL_CONTRACT_EXPECTED_GAIN, 16);
assert.deepEqual(
  Object.keys(PRODUCT_FORM_OPERATIONAL_CONTRACT_MASTER_EVIDENCE),
  [...EXPECTED_REQUIREMENT_IDS, ...EXPECTED_COMPLETION_REQUIREMENT_IDS],
);

const promptFormIds = PRODUCT_MASTER_REQUIREMENTS.filter(
  ({ section }) => section === "forms.contract",
).map(({ id }) => id);
assert.equal(promptFormIds.length, 18);
assert.deepEqual(
  [...CORE_FORM_REQUIREMENT_IDS, ...EXPECTED_REQUIREMENT_IDS].toSorted(),
  promptFormIds.toSorted(),
  "Core and operational form batches must partition forms.contract",
);

for (const [requirementId, evidence] of Object.entries(
  PRODUCT_FORM_OPERATIONAL_CONTRACT_MASTER_EVIDENCE,
)) {
  assert.equal(evidence.status, "tested", requirementId);
  assert.deepEqual(evidence.evidence.slice(0, 2), [
    PRODUCT_FORM_OPERATIONAL_CONTRACT_EVIDENCE_FILE,
    PRODUCT_FORM_OPERATIONAL_CONTRACT_TEST_FILE,
  ]);
  assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
  evidence.evidence.forEach((evidencePath) =>
    assert.equal(existsSync(evidencePath), true, `${requirementId}: ${evidencePath}`),
  );
}

const mappingCompletionEvidence =
  PRODUCT_FORM_OPERATIONAL_CONTRACT_MASTER_EVIDENCE[
    "COMPLETE.EVIDENCE.forms-mapped"
  ].evidence;
assert.ok(
  mappingCompletionEvidence.includes(PRODUCT_FIELD_CONTRACT_SOURCE_EVIDENCE_FILE),
);
assert.ok(
  mappingCompletionEvidence.includes(PRODUCT_FIELD_CONTRACT_SOURCE_TEST_FILE),
);
assert.ok(
  mappingCompletionEvidence.includes(
    "src/components/product-field-contract-source-registry.ts",
  ),
);

const clientSafeEvidenceSource = readFileSync(
  PRODUCT_FORM_OPERATIONAL_CONTRACT_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(clientSafeEvidenceSource, /from ["']node:/);
assert.doesNotMatch(clientSafeEvidenceSource, /readFileSync/);
assert.doesNotMatch(clientSafeEvidenceSource, /process\.cwd/);

const registry = buildProductFormOperationalContractRegistry();
const expectedRecordIds = SCREEN_CONTRACTS.flatMap((screen) =>
  screen.forms.map((encodedForm) => {
    const separator = encodedForm.indexOf(" -> ");
    assert.ok(separator > 0, `${screen.route}: ${encodedForm}`);
    return `${screen.route}::${encodedForm.slice(0, separator)}`;
  }),
).toSorted((left, right) => left.localeCompare(right));

assert.equal(SCREEN_CONTRACTS.length, 103);
assert.ok(registry.auditedRoutes.length >= 60);
assert.ok(registry.auditedSourceFiles.length >= 250);
assert.ok(registry.records.length >= 145);
assert.deepEqual(registry.discoveredRecordIds, expectedRecordIds);
assert.deepEqual(
  registry.records.map(({ id }) => id),
  expectedRecordIds,
  "Every registered route/form pair must have exactly one operational record",
);
assert.equal(new Set(expectedRecordIds).size, expectedRecordIds.length);

const mutationKinds = new Set<string>();
const updateStrategies = new Set<string>();
const signalTotals = Object.fromEntries(
  PRODUCT_FORM_OPERATIONAL_SIGNAL_KINDS.map((kind) => [kind, 0]),
) as Record<(typeof PRODUCT_FORM_OPERATIONAL_SIGNAL_KINDS)[number], number>;

for (const record of registry.records) {
  assert.ok(registry.auditedRoutes.includes(record.route), record.id);
  assertNonEmpty(record.formId, `${record.id}: formId`);
  assertNonEmpty(record.story, `${record.id}: story`);
  assert.ok(record.actors.length > 0, `${record.id}: actors`);
  record.actors.forEach((actor) => assertNonEmpty(actor, `${record.id}: actor`));
  assertNonEmpty(record.purpose, `${record.id}: purpose`);
  assertNonEmpty(record.destination, `${record.id}: destination`);
  assertNonEmpty(record.mutation.operation, `${record.id}: mutation`);
  assert.ok(record.ownership.length > 0, `${record.id}: ownership`);
  assert.ok(record.roles.length > 0, `${record.id}: roles`);
  assert.ok(record.tiers.length > 0, `${record.id}: tiers`);
  assert.ok(record.sourceFiles.length > 0, `${record.id}: source files`);
  record.sourceFiles.forEach((sourceFile) => {
    assert.ok(registry.auditedSourceFiles.includes(sourceFile), record.id);
    assert.equal(existsSync(sourceFile), true, `${record.id}: ${sourceFile}`);
  });
  record.ownership.forEach((rule) => {
    assertNonEmpty(rule.actor, `${record.id}: permission actor`);
    assertNonEmpty(rule.enforcedBy, `${record.id}: permission enforcement`);
    assert.ok(rule.testIds.length > 0, `${record.id}: permission test`);
  });

  mutationKinds.add(record.mutation.kind);
  updateStrategies.add(record.updateStrategy);
  const signalGroups = {
    pending: record.pending,
    "duplicate-prevention": record.duplicatePrevention,
    success: record.success,
    failure: record.failure,
    audit: record.audit,
    analytics: record.analytics,
  } as const;
  for (const kind of PRODUCT_FORM_OPERATIONAL_SIGNAL_KINDS) {
    const signals = signalGroups[kind];
    signalTotals[kind] += signals.length;
    assert.equal(
      new Set(
        signals.map(
          (signal) =>
            `${signal.sourceFile}:${signal.sourceLine}:${signal.kind}`,
        ),
      ).size,
      signals.length,
      `${record.id}: ${kind} signals`,
    );
    signals.forEach((signal) => {
      assert.equal(signal.kind, kind, record.id);
      assert.ok(signal.sourceLine > 0, record.id);
      assertNonEmpty(signal.sourceText, `${record.id}: signal text`);
      assert.ok(record.sourceFiles.includes(signal.sourceFile), record.id);
    });
  }
}

assert.deepEqual(
  [...mutationKinds].toSorted(),
  ["http-mutation", "read-query", "server-action"],
);
assert.deepEqual(
  [...updateStrategies].toSorted(),
  [
    "not-applicable-read-query",
    "pessimistic-server-confirmed",
  ],
);
for (const kind of PRODUCT_FORM_OPERATIONAL_SIGNAL_KINDS) {
  assert.ok(signalTotals[kind] > 0, `${kind}: source signal inventory`);
}

assert.match(PRODUCT_FORM_OPERATIONAL_CONTRACT_SCOPE, /all 103 screen contracts/i);
assert.match(PRODUCT_FORM_OPERATIONAL_CONTRACT_SCOPE, /empty signal list is an explicit recorded absence/i);
assert.match(PRODUCT_FORM_OPERATIONAL_CONTRACT_SCOPE, /not proof of server-side function or object-level authorisation/i);
assert.match(PRODUCT_FORM_OPERATIONAL_CONTRACT_SCOPE, /does not prove hydrated submission/i);
assert.match(PRODUCT_FORM_OPERATIONAL_CONTRACT_SCOPE, /production readiness/i);

console.log(
  `Product form operational contract evidence passed: exact ${registry.records.length}-form register across ${registry.auditedRoutes.length} form routes closes the remaining 15/18 form requirements and, with the field register, one source-mapping completion claim without asserting runtime enforcement.`,
);

function assertNonEmpty(value: string, label: string) {
  assert.ok(value.trim().length > 0, label);
}
