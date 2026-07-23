import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  findDestructiveConfirmationIssues,
  PRODUCT_DESTRUCTIVE_CONFIRMATION_CONTRACTS,
  PRODUCT_DESTRUCTIVE_CONFIRMATION_EVIDENCE_FILE,
  PRODUCT_DESTRUCTIVE_CONFIRMATION_EXPECTED_GAIN,
  PRODUCT_DESTRUCTIVE_CONFIRMATION_MASTER_EVIDENCE,
  PRODUCT_DESTRUCTIVE_CONFIRMATION_REQUIREMENT_IDS,
  PRODUCT_DESTRUCTIVE_CONFIRMATION_SCOPE,
  PRODUCT_DESTRUCTIVE_CONFIRMATION_TEST_FILE,
} from "./product-destructive-confirmation-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import { PRODUCT_UNAUTHORISED_DESTRUCTIVE_CONTRACTS } from "./product-unauthorised-destructive-gate";

// screen-evidence-test-id: PRODUCT-DESTRUCTIVE-CONFIRMATION

const REQUIREMENT_ID = "GLOBAL.FUNC.destructive-confirm" as const;
const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  ({ id }) => id === REQUIREMENT_ID,
);
assert.ok(requirement, REQUIREMENT_ID);
assert.equal(
  requirement.requirement,
  "Require suitable confirmation for every destructive action.",
);
assert.deepEqual(PRODUCT_DESTRUCTIVE_CONFIRMATION_REQUIREMENT_IDS, [
  REQUIREMENT_ID,
]);
assert.equal(PRODUCT_DESTRUCTIVE_CONFIRMATION_EXPECTED_GAIN, 1);
assert.deepEqual(
  Object.keys(PRODUCT_DESTRUCTIVE_CONFIRMATION_MASTER_EVIDENCE),
  [REQUIREMENT_ID],
);

const evidence = PRODUCT_DESTRUCTIVE_CONFIRMATION_MASTER_EVIDENCE[REQUIREMENT_ID];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_DESTRUCTIVE_CONFIRMATION_EVIDENCE_FILE,
  PRODUCT_DESTRUCTIVE_CONFIRMATION_TEST_FILE,
]);
assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
evidence.evidence.forEach((path) => assert.equal(existsSync(path), true, path));

assert.match(PRODUCT_DESTRUCTIVE_CONFIRMATION_SCOPE, /source-static/i);
assert.match(PRODUCT_DESTRUCTIVE_CONFIRMATION_SCOPE, /all 12 destructive forms/i);
assert.match(PRODUCT_DESTRUCTIVE_CONFIRMATION_SCOPE, /visible typed or checkbox/i);
assert.match(PRODUCT_DESTRUCTIVE_CONFIRMATION_SCOPE, /strictly parses/i);
assert.match(PRODUCT_DESTRUCTIVE_CONFIRMATION_SCOPE, /does not prove hydrated browser/i);
assert.match(PRODUCT_DESTRUCTIVE_CONFIRMATION_SCOPE, /database RLS/i);

assert.deepEqual(findDestructiveConfirmationIssues(PRODUCT_DESTRUCTIVE_CONFIRMATION_CONTRACTS), []);
assert.deepEqual(
  PRODUCT_DESTRUCTIVE_CONFIRMATION_CONTRACTS.map(({ id }) => id),
  PRODUCT_UNAUTHORISED_DESTRUCTIVE_CONTRACTS.map(({ id }) => id),
  "confirmation coverage must fail closed on destructive-registry additions or removals",
);
assert.deepEqual(
  PRODUCT_DESTRUCTIVE_CONFIRMATION_CONTRACTS.map(({ action }) => action),
  PRODUCT_UNAUTHORISED_DESTRUCTIVE_CONTRACTS.map(({ action }) => action),
  "confirmation coverage must preserve the registered server-action bindings",
);
assert.equal(PRODUCT_DESTRUCTIVE_CONFIRMATION_CONTRACTS.length, 12);

const sourceCache = new Map<string, string>();
for (const contract of PRODUCT_DESTRUCTIVE_CONFIRMATION_CONTRACTS) {
  const uiSource = source(contract.uiFile);
  const form = jsxFormSourceContaining(
    uiSource,
    contract.uiAction,
    contract.controlKind === "typed-text"
      ? `pattern="${contract.confirmationValue}"`
      : `value="${contract.confirmationValue}"`,
  );
  assert.match(form, /<label\b/, `${contract.id}: confirmation must be visibly labelled`);
  assert.ok(
    form.includes(contract.visibleConfirmationText),
    `${contract.id}: missing visible confirmation copy`,
  );
  assert.ok(
    form.includes('name="confirmation"'),
    `${contract.id}: missing confirmation field`,
  );
  assert.match(form, /\brequired\b/, `${contract.id}: confirmation must be required`);
  assert.doesNotMatch(
    confirmationControlSource(form),
    /type="hidden"/,
    `${contract.id}: confirmation cannot be hidden`,
  );

  if (contract.controlKind === "typed-text") {
    assert.match(form, /type="text"/, contract.id);
    assert.ok(
      form.includes(`pattern="${contract.confirmationValue}"`),
      `${contract.id}: typed confirmation pattern drifted`,
    );
  } else {
    assert.match(form, /type="checkbox"/, contract.id);
    assert.ok(
      form.includes(`value="${contract.confirmationValue}"`),
      `${contract.id}: checkbox confirmation literal drifted`,
    );
  }

  const actionSource = source(contract.actionFile);
  const schema = variableStatementSource(actionSource, contract.schemaSymbol);
  assert.match(
    compact(schema),
    new RegExp(`z\\.literal\\("${escapeRegExp(contract.confirmationValue)}"\\)`),
    `${contract.id}: strict server literal drifted`,
  );
  const action = functionSource(actionSource, contract.action);
  assertInOrder(action, [
    contract.schemaSymbol,
    contract.confirmationFieldToken,
    contract.mutationToken,
  ], contract.id);
}

assert.deepEqual(
  findDestructiveConfirmationIssues([
    ...PRODUCT_DESTRUCTIVE_CONFIRMATION_CONTRACTS,
    PRODUCT_DESTRUCTIVE_CONFIRMATION_CONTRACTS[0],
  ]),
  [
    `${PRODUCT_DESTRUCTIVE_CONFIRMATION_CONTRACTS[0].id}:DUPLICATE`,
  ],
);
assert.deepEqual(
  findDestructiveConfirmationIssues([
    {
      ...PRODUCT_DESTRUCTIVE_CONFIRMATION_CONTRACTS[0],
      id: "broken",
      visibleConfirmationText: "",
      confirmationValue: "",
      schemaSymbol: "",
    },
  ]),
  [
    "broken:CONFIRMATION_VALUE_MISSING",
    "broken:INVALID_ID",
    "broken:SERVER_VALIDATION_MISSING",
    "broken:VISIBLE_CONFIRMATION_MISSING",
  ],
);

const evidenceSource = source(PRODUCT_DESTRUCTIVE_CONFIRMATION_EVIDENCE_FILE);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Destructive confirmation evidence passed in isolation: all 12 registered destructive forms require visible confirmation and strict server-side literal validation before mutation; exact +1 central wiring is ready.",
);

function source(path: string) {
  const cached = sourceCache.get(path);
  if (cached) return cached;
  const value = readFileSync(path, "utf8");
  sourceCache.set(path, value);
  return value;
}

function compact(value: string) {
  return value.replace(/\r/g, "");
}

function variableStatementSource(value: string, symbol: string) {
  const start = value.indexOf(`const ${symbol} =`);
  assert.ok(start >= 0, `Missing schema ${symbol}`);
  const end = value.indexOf(";", start);
  assert.ok(end > start, `Missing schema end ${symbol}`);
  return value.slice(start, end + 1);
}

function functionSource(value: string, name: string) {
  const start = value.indexOf(`export async function ${name}`);
  assert.ok(start >= 0, `Missing action ${name}`);
  const bodyStart = value.indexOf("{", start);
  assert.ok(bodyStart > start, `Missing action body ${name}`);

  let depth = 0;
  for (let index = bodyStart; index < value.length; index += 1) {
    if (value[index] === "{") depth += 1;
    if (value[index] === "}") depth -= 1;
    if (depth === 0) return value.slice(start, index + 1);
  }

  assert.fail(`Missing action end ${name}`);
}

function jsxFormSourceContaining(value: string, action: string, token: string) {
  let start = value.indexOf(`<form action={${action}}`);
  while (start >= 0) {
    const end = value.indexOf("</form>", start);
    assert.ok(end > start, `Missing form end ${action}`);
    const form = value.slice(start, end + "</form>".length);
    if (form.includes(token)) return form;
    start = value.indexOf(`<form action={${action}}`, end);
  }

  assert.fail(`Missing form action ${action} with ${token}`);
}

function confirmationControlSource(value: string) {
  const nameIndex = value.indexOf('name="confirmation"');
  assert.ok(nameIndex >= 0, "Missing confirmation control");
  const start = value.lastIndexOf("<input", nameIndex);
  const end = value.indexOf("/>", nameIndex);
  assert.ok(start >= 0 && end > nameIndex, "Malformed confirmation control");
  return value.slice(start, end + 2);
}

function assertInOrder(value: string, tokens: readonly string[], label: string) {
  let cursor = -1;
  for (const token of tokens) {
    const index = value.indexOf(token, cursor + 1);
    assert.ok(index > cursor, `${label}: missing or out of order: ${token}`);
    cursor = index;
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
