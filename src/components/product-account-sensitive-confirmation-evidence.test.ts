import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

import {
  PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_EVIDENCE_FILE,
  PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_EXPECTED_GAIN,
  PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_FORMS,
  PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_MASTER_EVIDENCE,
  PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_REQUIREMENT_IDS,
  PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_SCOPE,
  PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_TEST_FILE,
} from "./product-account-sensitive-confirmation-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import { PRODUCTION_SCREEN_INTERACTION_CONTRACTS } from "./screen-contracts/production-screen-coverage";

// screen-evidence-test-id: PRODUCT-ACCOUNT-SENSITIVE-CONFIRMATION

const REQUIREMENT_ID = "ROUTE.ACCOUNT.sensitive-confirmation" as const;
const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  ({ id }) => id === REQUIREMENT_ID,
);
assert.ok(requirement, REQUIREMENT_ID);
assert.equal(
  requirement.requirement,
  "Require suitable confirmation for security-sensitive changes.",
);
assert.deepEqual(PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_REQUIREMENT_IDS, [
  REQUIREMENT_ID,
]);
assert.equal(PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_EXPECTED_GAIN, 1);
assert.deepEqual(
  Object.keys(PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_MASTER_EVIDENCE),
  [REQUIREMENT_ID],
);

const evidence =
  PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_MASTER_EVIDENCE[REQUIREMENT_ID];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_EVIDENCE_FILE,
  PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_TEST_FILE,
]);
assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
evidence.evidence.forEach((path) => assert.equal(existsSync(path), true, path));

assert.match(PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_SCOPE, /source-static/i);
assert.match(PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_SCOPE, /two destructive account-form operations/i);
assert.match(PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_SCOPE, /strict server-side literal parsing/i);
assert.match(PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_SCOPE, /does not prove hydrated browser interaction/i);
assert.match(PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_SCOPE, /database RLS/i);
assert.match(PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_SCOPE, /reauthentication/i);

const destructiveForms = Object.entries(PRODUCTION_SCREEN_INTERACTION_CONTRACTS)
  .filter(([route]) => route === "/account" || route.startsWith("/account/"))
  .flatMap(([route, interaction]) =>
    interaction.forms
      .filter((form) => /(?:DELETION|DELETE)$/.test(form.id))
      .map((form) => ({ route, formId: form.id, action: actionName(form.submitsTo) })),
  );
assert.deepEqual(
  PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_FORMS,
  destructiveForms,
  "registered destructive account forms must fail closed on additions or removals",
);
for (const { route, formId } of PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_FORMS) {
  const form = PRODUCTION_SCREEN_INTERACTION_CONTRACTS[route].forms.find(
    ({ id }) => id === formId,
  );
  assert.ok(form, formId);
  assert.match(form.schema ?? "", /confirmation:DELETE/, formId);
}

const actions = source("src/app/actions.ts");
const schema = variableStatementSource(actions, "destructiveConfirmationSchema");
assert.match(
  compact(schema),
  /z\.object\(\{\s*confirmation:\s*z\.literal\("DELETE"\)/,
);

const accountDeletion = functionSource(actions, "requestAccountDeletion");
assertInOrder(accountDeletion, [
  "requireCurrentUserProfile()",
  "destructiveConfirmationSchema.parse({",
  'confirmation: field(formData, "confirmation")',
  "requestAccountDeletionForUser(current)",
]);
const pageDeletion = functionSource(actions, "deleteCustomPageAction");
assertInOrder(pageDeletion, [
  "requireCurrentUserProfile()",
  "destructiveConfirmationSchema.parse({",
  'confirmation: field(formData, "confirmation")',
  "deleteCustomPage(current, pageId)",
]);

const accountPage = source("src/app/account/page.tsx");
const accountForm = jsxFormSource(accountPage, "requestAccountDeletion");
assertTypedDeleteControl(accountForm);
assertInOrder(accountForm, [
  "Type DELETE to confirm",
  'name="confirmation"',
  "<SubmitButton",
  "Request deletion",
]);

const editorPage = source("src/app/account/pages/[id]/page.tsx");
assert.match(
  editorPage,
  /deleteCustomPageAction\.bind\(null, page\.id\)/,
  "the deletion target must remain bound from the owned server-loaded page",
);
const pageForm = jsxFormSource(editorPage, "deleteAction");
assertTypedDeleteControl(pageForm);
assertInOrder(pageForm, [
  "Type DELETE to confirm",
  'name="confirmation"',
  "<SubmitButton",
  "Delete this page",
]);

const accountService = functionSource(
  source("src/lib/account-service.ts"),
  "requestAccountDeletion",
);
assert.match(accountService, /where: \{ id: current\.dbUserId \}/);
const customPageService = source("src/lib/custom-page-service.ts");
assert.match(
  functionSource(customPageService, "deleteCustomPage"),
  /requireOwnedPage\(current, pageId\)/,
);
assert.match(
  compact(functionSource(customPageService, "requireOwnedPage")),
  /where:\s*\{\s*id:\s*pageId,\s*ownerProfileId:\s*current\.profileId\s*\}/,
);

const evidenceSource = source(PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_EVIDENCE_FILE);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Account sensitive-confirmation evidence passed in isolation: the two registered destructive forms require visible typed DELETE confirmation and strict authenticated server validation; exact +1 central wiring is ready.",
);

function source(path: string) {
  return readFileSync(path, "utf8");
}

function parse(value: string, kind = ts.ScriptKind.TS) {
  return ts.createSourceFile(
    "evidence.ts",
    value,
    ts.ScriptTarget.Latest,
    true,
    kind,
  );
}

function functionSource(value: string, name: string) {
  const sourceFile = parse(value, ts.ScriptKind.TSX);
  const match = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  assert.ok(match, `Missing function ${name}`);
  return match.getText(sourceFile);
}

function variableStatementSource(value: string, name: string) {
  const sourceFile = parse(value);
  const match = sourceFile.statements.find(
    (statement): statement is ts.VariableStatement =>
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (declaration) =>
          ts.isIdentifier(declaration.name) && declaration.name.text === name,
      ),
  );
  assert.ok(match, `Missing variable statement ${name}`);
  return match.getText(sourceFile);
}

function jsxFormSource(value: string, action: string) {
  const start = value.indexOf(`<form action={${action}}`);
  assert.ok(start >= 0, `Missing form action ${action}`);
  const end = value.indexOf("</form>", start);
  assert.ok(end > start, `Missing form end ${action}`);
  return value.slice(start, end + "</form>".length);
}

function assertTypedDeleteControl(value: string) {
  for (const token of [
    'name="confirmation"',
    'type="text"',
    'autoComplete="off"',
    "required",
    'pattern="DELETE"',
    "spellCheck={false}",
  ]) {
    assert.ok(value.includes(token), token);
  }
  assert.doesNotMatch(value, /type="hidden"/);
}

function assertInOrder(value: string, expected: readonly string[]) {
  let cursor = -1;
  for (const token of expected) {
    const next = value.indexOf(token, cursor + 1);
    assert.ok(next > cursor, `Expected ordered token: ${token}`);
    cursor = next;
  }
}

function compact(value: string) {
  return value.replace(/\r?\n/g, " ");
}

function actionName(submitsTo: string) {
  const match = /^SERVER ACTION (.+)$/.exec(submitsTo);
  assert.ok(match, submitsTo);
  return match[1];
}
