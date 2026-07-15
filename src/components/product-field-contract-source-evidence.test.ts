import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { SCREEN_CONTRACTS } from "./demo-experience-registry";
import {
  PRODUCT_FIELD_CONTRACT_SOURCE_EVIDENCE_FILE,
  PRODUCT_FIELD_CONTRACT_SOURCE_EXPECTED_GAIN,
  PRODUCT_FIELD_CONTRACT_SOURCE_MASTER_EVIDENCE,
  PRODUCT_FIELD_CONTRACT_SOURCE_OPEN_REQUIREMENT_IDS,
  PRODUCT_FIELD_CONTRACT_SOURCE_REQUIREMENT_IDS,
  PRODUCT_FIELD_CONTRACT_SOURCE_SCOPE,
  PRODUCT_FIELD_CONTRACT_SOURCE_TEST_FILE,
  PRODUCT_FORM_FIELD_REGISTRY_OUTPUT_REQUIREMENT_IDS,
} from "./product-field-contract-source-evidence";
import {
  PRODUCT_FIELD_CONTROL_TAGS,
  buildProductFieldContractSourceRegistry,
} from "./product-field-contract-source-registry";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-FIELD-CONTRACT-SOURCE-EVIDENCE

const EXPECTED_CLOSED_IDS = [
  "FIELD.FIELD.name",
  "FIELD.FIELD.visible-label",
  "FIELD.FIELD.accessible-label",
  "FIELD.FIELD.input-type",
  "FIELD.FIELD.data-type",
  "FIELD.FIELD.required",
  "FIELD.FIELD.default",
  "FIELD.FIELD.placeholder",
  "FIELD.FIELD.help",
  "FIELD.FIELD.character-limits",
  "FIELD.FIELD.numeric-limits",
  "FIELD.FIELD.file-types",
  "FIELD.FIELD.file-sizes",
  "FIELD.FIELD.validation",
  "FIELD.FIELD.source",
  "FIELD.FIELD.onboarding",
  "FIELD.FIELD.mobile-input",
  "FIELD.FIELD.autofill",
  "FIELD.FIELD.read-only-disabled",
  "FIELD.FIELD.conditional-visibility",
  "FIELD.FIELD.hidden",
  "FIELD.FIELD.generated-ids",
  "FIELD.FIELD.consent",
  "FIELD.FIELD.media-metadata",
  "FIELD.FIELD.disclosures",
  "FIELD.FIELD.billing-intent",
  "FIELD.FIELD.dependent-fields",
  "FIELD.FIELD.persistence",
  "FIELD.FIELD.privacy",
] as const;
const EXPECTED_OPEN_IDS = [
  "FIELD.FIELD.sanitisation",
  "FIELD.FIELD.error",
] as const;
const EXPECTED_OUTPUT_IDS = ["OUT.form-field-registry"] as const;

assert.deepEqual(
  PRODUCT_FIELD_CONTRACT_SOURCE_REQUIREMENT_IDS,
  EXPECTED_CLOSED_IDS,
);
assert.deepEqual(
  PRODUCT_FIELD_CONTRACT_SOURCE_OPEN_REQUIREMENT_IDS,
  EXPECTED_OPEN_IDS,
);
assert.deepEqual(
  PRODUCT_FORM_FIELD_REGISTRY_OUTPUT_REQUIREMENT_IDS,
  EXPECTED_OUTPUT_IDS,
);
assert.equal(PRODUCT_FIELD_CONTRACT_SOURCE_EXPECTED_GAIN, 30);
assert.deepEqual(
  Object.keys(PRODUCT_FIELD_CONTRACT_SOURCE_MASTER_EVIDENCE),
  [...EXPECTED_CLOSED_IDS, ...EXPECTED_OUTPUT_IDS],
);

const promptFieldIds = PRODUCT_MASTER_REQUIREMENTS.filter(({ section }) =>
  section === "fields.contract",
).map(({ id }) => id);
assert.equal(promptFieldIds.length, 31);
assert.deepEqual(
  [...EXPECTED_CLOSED_IDS, ...EXPECTED_OPEN_IDS].toSorted(),
  promptFieldIds.toSorted(),
  "The +29 source batch and two preserved gaps must partition fields.contract",
);

for (const [requirementId, record] of Object.entries(
  PRODUCT_FIELD_CONTRACT_SOURCE_MASTER_EVIDENCE,
)) {
  assert.equal(record.status, "tested", requirementId);
  assert.deepEqual(record.evidence.slice(0, 2), [
    PRODUCT_FIELD_CONTRACT_SOURCE_EVIDENCE_FILE,
    PRODUCT_FIELD_CONTRACT_SOURCE_TEST_FILE,
  ]);
  assert.equal(new Set(record.evidence).size, record.evidence.length);
  record.evidence.forEach((evidencePath) =>
    assert.equal(existsSync(evidencePath), true, `${requirementId}: ${evidencePath}`),
  );
}

const formFieldOutputEvidence =
  PRODUCT_FIELD_CONTRACT_SOURCE_MASTER_EVIDENCE["OUT.form-field-registry"]
    .evidence;
const formFieldOutputEvidencePaths: readonly string[] = formFieldOutputEvidence;
for (const evidencePath of [
  "src/components/product-form-operational-contract-evidence.ts",
  "src/components/product-form-operational-contract-evidence.test.ts",
  "src/components/product-form-operational-contract-registry.ts",
  "src/components/product-field-contract-source-registry.ts",
  "docs/product/form-field-registry.md",
]) {
  assert.ok(formFieldOutputEvidencePaths.includes(evidencePath), evidencePath);
}

const clientSafeEvidenceSource = readFileSync(
  PRODUCT_FIELD_CONTRACT_SOURCE_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(clientSafeEvidenceSource, /from ["']node:/);
assert.doesNotMatch(clientSafeEvidenceSource, /readFileSync/);
assert.doesNotMatch(clientSafeEvidenceSource, /process\.cwd/);
EXPECTED_OPEN_IDS.forEach((requirementId) =>
  assert.equal(
    requirementId in PRODUCT_FIELD_CONTRACT_SOURCE_MASTER_EVIDENCE,
    false,
    `${requirementId} must remain open`,
  ),
);

const registry = buildProductFieldContractSourceRegistry();
assert.equal(SCREEN_CONTRACTS.length, 97);
assert.equal(registry.auditedRoutes.length, 97);
assert.deepEqual(
  registry.auditedRoutes,
  SCREEN_CONTRACTS.map(({ route }) => route).toSorted(),
);
assert.ok(registry.auditedSourceFiles.length >= 400);
assert.ok(registry.records.length >= 1_800);
assert.deepEqual(
  registry.records.map(({ id }) => id),
  registry.discoveredRecordIds,
  "Every discovered route/source/control identifier must have exactly one record",
);
assert.equal(
  new Set(registry.records.map(({ id }) => id)).size,
  registry.records.length,
);

const recordKeys = [
  "name",
  "visibleLabel",
  "accessibleLabel",
  "inputType",
  "dataType",
  "required",
  "defaultValue",
  "placeholder",
  "helpText",
  "characterLimits",
  "numericLimits",
  "acceptedFileTypes",
  "acceptedFileSizePolicy",
  "validationRules",
  "dataSource",
  "persistenceDestination",
  "privacyClassification",
  "onboarding",
  "mobileInput",
  "autofill",
  "readOnly",
  "disabled",
  "conditionalVisibility",
  "hidden",
  "generatedIdentifier",
  "consentField",
  "mediaMetadataField",
  "disclosureField",
  "billingIntentField",
  "dependentField",
] as const;

for (const record of registry.records) {
  assert.ok(registry.auditedRoutes.includes(record.route), record.id);
  assert.ok(registry.auditedSourceFiles.includes(record.sourceFile), record.id);
  assert.ok(PRODUCT_FIELD_CONTROL_TAGS.includes(record.controlTag), record.id);
  assert.ok(record.sourceLine > 0, record.id);
  assert.ok(record.sourceColumn > 0, record.id);
  assertNonEmpty(record.name, `${record.id}: registry name`);
  recordKeys.forEach((key) =>
    assert.equal(Object.hasOwn(record, key), true, `${record.id}: ${key}`),
  );
  assert.ok(
    ["boolean", "date", "file", "number", "string"].includes(
      record.dataType,
    ),
    record.id,
  );
  assert.ok(
    record.dataSource === "browser-user-input" ||
      record.dataSource === "source-provided-value",
    record.id,
  );
  assert.ok(record.onboarding.length > 0, record.id);
  assert.equal(
    record.dependentField,
    record.conditionalVisibility !== null,
    record.id,
  );
  assert.equal(record.sanitisation, "not-source-proven", record.id);
  assert.equal(record.userFacingError, "not-source-proven", record.id);
  assert.doesNotMatch(record.persistenceDestination, /not-source-proven/, record.id);
  assert.doesNotMatch(record.privacyClassification, /unclassified/, record.id);
}

assert.deepEqual(
  new Set(registry.records.map(({ privacyClassification }) => privacyClassification)),
  new Set([
    "billing-data",
    "consent-preference",
    "credential-secret",
    "operational-data",
    "personal-data",
    "persistent-identifier",
    "public-racing-data",
    "user-content",
  ]),
);
assert.ok(
  registry.records.some(
    ({ name, privacyClassification }) =>
      name === "email" && privacyClassification === "personal-data",
  ),
);
assert.ok(
  registry.records.some(
    ({ name, privacyClassification }) =>
      name === "token" && privacyClassification === "credential-secret",
  ),
);
assert.ok(
  registry.records.some(({ persistenceDestination }) =>
    persistenceDestination.startsWith("form-action:"),
  ),
);
assert.ok(
  registry.records.some(({ persistenceDestination }) =>
    persistenceDestination.startsWith("url-query:"),
  ),
);
assert.ok(
  registry.records.some(
    ({ persistenceDestination }) => persistenceDestination === "component-state",
  ),
);

const submittedFields = registry.records.filter(({ submittedName }) =>
  Boolean(submittedName),
);
const hiddenFields = registry.records.filter(({ hidden }) => hidden);
const fileFields = registry.records.filter(({ dataType }) => dataType === "file");
const generatedIds = registry.records.filter(
  ({ generatedIdentifier }) => generatedIdentifier,
);
const consentFields = registry.records.filter(({ consentField }) => consentField);
const mediaFields = registry.records.filter(
  ({ mediaMetadataField }) => mediaMetadataField,
);
const disclosureFields = registry.records.filter(
  ({ disclosureField }) => disclosureField,
);
const billingFields = registry.records.filter(
  ({ billingIntentField }) => billingIntentField,
);
const dependentFields = registry.records.filter(({ dependentField }) =>
  dependentField,
);
const fieldsWithValidationRules = registry.records.filter(
  ({ validationRules }) => validationRules.length > 0,
);

assert.ok(submittedFields.length > 1_700);
assert.ok(hiddenFields.length > 500);
assert.ok(fileFields.length > 0);
assert.ok(generatedIds.length > 0);
assert.equal(consentFields.length, 0);
assert.ok(mediaFields.length > 0);
assert.ok(disclosureFields.length > 0);
assert.ok(billingFields.length > 0);
assert.ok(dependentFields.length > 0);
assert.ok(fileFields.every(({ acceptedFileTypes }) => acceptedFileTypes));
assert.ok(
  fileFields.every(({ acceptedFileSizePolicy }) => acceptedFileSizePolicy),
);
assert.ok(fieldsWithValidationRules.length >= 600);
assert.deepEqual(
  new Set(
    fieldsWithValidationRules.flatMap(({ validationRules }) =>
      validationRules.map((rule) => rule.slice(0, rule.indexOf("="))),
    ),
  ),
  new Set([
    "accept",
    "max",
    "maxLength",
    "min",
    "minLength",
    "multiple",
    "pattern",
    "required",
    "step",
  ]),
);

const mediaSource = readFileSync(
  "src/components/media-attachment-fields.tsx",
  "utf8",
);
const entitlementSource = readFileSync(
  "src/lib/billing/entitlements.ts",
  "utf8",
);
assert.match(mediaSource, /ACCEPTED_MEDIA_TYPES/);
assert.match(mediaSource, /accept=\{acceptedMediaTypes\.join\(","\)\}/);
assert.match(entitlementSource, /upload_file_size_bytes/);

assert.match(PRODUCT_FIELD_CONTRACT_SOURCE_SCOPE, /all 97 registered screen routes/i);
assert.match(PRODUCT_FIELD_CONTRACT_SOURCE_SCOPE, /exact one-to-one record/i);
assert.match(PRODUCT_FIELD_CONTRACT_SOURCE_SCOPE, /complete source-static form and field registry output/i);
assert.match(PRODUCT_FIELD_CONTRACT_SOURCE_SCOPE, /Null and false values are explicit observations/i);
assert.match(PRODUCT_FIELD_CONTRACT_SOURCE_SCOPE, /native source-declared validation attributes/i);
assert.match(PRODUCT_FIELD_CONTRACT_SOURCE_SCOPE, /source-visible persistence destination/i);
assert.match(PRODUCT_FIELD_CONTRACT_SOURCE_SCOPE, /conservative privacy classification/i);
assert.match(PRODUCT_FIELD_CONTRACT_SOURCE_SCOPE, /does not prove downstream database storage/i);
assert.match(PRODUCT_FIELD_CONTRACT_SOURCE_SCOPE, /browser-native validation behaviour/i);
assert.match(PRODUCT_FIELD_CONTRACT_SOURCE_SCOPE, /does not prove hydration/i);

console.log(
  `Product field contract source evidence passed: exact ${registry.records.length}-record field inventory closes 29/31 source-record requirements plus the complete form/field registry output; sanitisation and error remain open.`,
);

function assertNonEmpty(value: string, label: string) {
  assert.ok(value.trim().length > 0, label);
}
