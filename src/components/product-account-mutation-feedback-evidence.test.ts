import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

import {
  PRODUCT_ACCOUNT_MUTATION_FEEDBACK_EVIDENCE_FILE,
  PRODUCT_ACCOUNT_MUTATION_FEEDBACK_EXPECTED_GAIN,
  PRODUCT_ACCOUNT_MUTATION_FEEDBACK_FORMS,
  PRODUCT_ACCOUNT_MUTATION_FEEDBACK_MASTER_EVIDENCE,
  PRODUCT_ACCOUNT_MUTATION_FEEDBACK_REQUIREMENT_IDS,
  PRODUCT_ACCOUNT_MUTATION_FEEDBACK_SCOPE,
  PRODUCT_ACCOUNT_MUTATION_FEEDBACK_TEST_FILE,
} from "./product-account-mutation-feedback-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import { PRODUCTION_SCREEN_INTERACTION_CONTRACTS } from "./screen-contracts/production-screen-coverage";

// screen-evidence-test-id: PRODUCT-ACCOUNT-MUTATION-FEEDBACK

const REQUIREMENT_ID = "ROUTE.ACCOUNT.mutation-feedback" as const;
const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  ({ id }) => id === REQUIREMENT_ID,
);
assert.ok(requirement, REQUIREMENT_ID);
assert.equal(
  requirement.requirement,
  "Give every mutation pending, success, and recoverable-failure feedback.",
);
assert.deepEqual(PRODUCT_ACCOUNT_MUTATION_FEEDBACK_REQUIREMENT_IDS, [
  REQUIREMENT_ID,
]);
assert.equal(PRODUCT_ACCOUNT_MUTATION_FEEDBACK_EXPECTED_GAIN, 1);
assert.deepEqual(Object.keys(PRODUCT_ACCOUNT_MUTATION_FEEDBACK_MASTER_EVIDENCE), [
  REQUIREMENT_ID,
]);

const evidence = PRODUCT_ACCOUNT_MUTATION_FEEDBACK_MASTER_EVIDENCE[REQUIREMENT_ID];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_ACCOUNT_MUTATION_FEEDBACK_EVIDENCE_FILE,
  PRODUCT_ACCOUNT_MUTATION_FEEDBACK_TEST_FILE,
]);
assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
evidence.evidence.forEach((path) => assert.equal(existsSync(path), true, path));

for (const phrase of [
  "source-static",
  "all four registered /account mutations",
  "fragment-targeted success and recoverable-failure notices",
  "client pending, downloaded, and retryable failure states",
  "successful Stripe handoff",
  "does not prove hydrated browser announcements",
  "payment completion",
]) {
  assert.match(PRODUCT_ACCOUNT_MUTATION_FEEDBACK_SCOPE, new RegExp(phrase, "i"));
}

assert.deepEqual(
  PRODUCT_ACCOUNT_MUTATION_FEEDBACK_FORMS,
  PRODUCTION_SCREEN_INTERACTION_CONTRACTS["/account"].forms.map(
    ({ id: formId, submitsTo }) => ({
      route: "/account",
      formId,
      submitsTo,
    }),
  ),
  "the feedback inventory must fail closed when /account forms change",
);
assert.equal(
  new Set(PRODUCT_ACCOUNT_MUTATION_FEEDBACK_FORMS.map(({ formId }) => formId))
    .size,
  PRODUCT_ACCOUNT_MUTATION_FEEDBACK_FORMS.length,
);

const accountPage = source("src/app/account/page.tsx");
const actions = source("src/app/actions.ts");
const submitButton = source("src/components/submit-button.tsx");
const exportForm = source("src/components/user-data-export-form.tsx");
const checkoutRoute = source("src/app/api/billing/checkout/route.ts");
const pricingPage = source("src/app/pricing/page.tsx");

for (const token of [
  "useFormStatus()",
  "disabled={pending}",
  "aria-busy={pending}",
  '<span role="status" className="sr-only">',
]) {
  assert.ok(submitButton.includes(token), `SubmitButton: ${token}`);
}

const profileForm = jsxFormSource(accountPage, "updateProfile");
for (const token of [
  '<SubmitButton pendingLabel="Saving profile...">',
  "Save profile",
]) {
  assert.ok(profileForm.includes(token), `profile pending feedback: ${token}`);
}
assertActionOutcomes(actions, "updateProfile", [
  'redirect("/account#profile-error")',
  'redirect("/account#profile-updated")',
]);

const deletionForm = jsxFormSource(accountPage, "requestAccountDeletion");
for (const token of [
  'pendingLabel="Requesting..."',
  "Request deletion",
]) {
  assert.ok(deletionForm.includes(token), `deletion pending feedback: ${token}`);
}
assertActionOutcomes(actions, "requestAccountDeletion", [
  'redirect("/account#deletion-error")',
  'redirect("/account#deletion-requested")',
]);

const feedback = functionSource(accountPage, "AccountMutationFeedback");
for (const token of [
  'id: "profile-updated"',
  "Profile saved.",
  'id: "profile-error"',
  "Profile could not be saved. Review the fields and try again.",
  'id: "deletion-requested"',
  "Account deletion requested. The 30-day grace window has started.",
  'id: "deletion-error"',
  "Deletion could not be requested. Confirm DELETE and try again.",
  'role: "status" as const',
  'role: "alert" as const',
  "target:block",
  '<Link href="/account"',
  "Dismiss",
]) {
  assert.ok(feedback.includes(token), `account outcome feedback: ${token}`);
}

for (const token of [
  '"use client"',
  '<form onSubmit={downloadExport}',
  'fetch("/api/users/me/export"',
  'method: "POST"',
  "if (!response.ok)",
  'status === "pending"',
  'disabled={status === "pending"}',
  'aria-busy={status === "pending"}',
  'role={status === "error" ? "alert" : "status"}',
  "Preparing your data archive.",
  "Data export downloaded.",
  "Data export could not be prepared. Try again.",
  "URL.createObjectURL(await response.blob())",
  "download.click()",
]) {
  assert.ok(exportForm.includes(token), `data-export feedback: ${token}`);
}

const checkoutForm = htmlFormSource(accountPage, "/api/billing/checkout");
assert.ok(
  checkoutForm.includes('pendingLabel="Opening Stripe..."'),
  "checkout must expose pending feedback",
);
for (const token of [
  "if (!session.url)",
  "NextResponse.redirect(session.url, 303)",
  "prefersHtmlFormNavigation(request)",
  "buildBillingFailureUrl({",
]) {
  assert.ok(checkoutRoute.includes(token), `checkout outcome: ${token}`);
}
for (const token of [
  'checkout === "failed"',
  'checkout === "rate-limited"',
  "Secure checkout could not be opened",
  "No payment was taken and your current plan is unchanged",
]) {
  assert.ok(pricingPage.includes(token), `checkout recovery: ${token}`);
}

const evidenceSource = source(PRODUCT_ACCOUNT_MUTATION_FEEDBACK_EVIDENCE_FILE);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Account mutation-feedback evidence passed in isolation: all four registered forms expose pending, successful outcome, and recoverable-failure feedback; exact +1 central wiring is ready.",
);

function source(path: string) {
  return readFileSync(path, "utf8");
}

function parse(value: string) {
  return ts.createSourceFile(
    "evidence.tsx",
    value,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

function functionSource(value: string, name: string) {
  const sourceFile = parse(value);
  const match = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  assert.ok(match, `Missing function ${name}`);
  return match.getText(sourceFile);
}

function jsxFormSource(value: string, action: string) {
  const start = value.indexOf(`<form action={${action}}`);
  assert.ok(start >= 0, `Missing form action ${action}`);
  const end = value.indexOf("</form>", start);
  assert.ok(end > start, `Missing form end ${action}`);
  return value.slice(start, end + "</form>".length);
}

function htmlFormSource(value: string, action: string) {
  const start = value.indexOf(`<form action="${action}"`);
  assert.ok(start >= 0, `Missing form action ${action}`);
  const end = value.indexOf("</form>", start);
  assert.ok(end > start, `Missing form end ${action}`);
  return value.slice(start, end + "</form>".length);
}

function assertActionOutcomes(
  value: string,
  name: string,
  outcomes: readonly [string, string],
) {
  const action = functionSource(value, name);
  assert.match(action, /try\s*\{/);
  assert.match(action, /catch\s*\{/);
  const failure = action.indexOf(outcomes[0]);
  const success = action.indexOf(outcomes[1]);
  assert.ok(failure >= 0, `${name}: missing recoverable failure outcome`);
  assert.ok(success > failure, `${name}: missing successful outcome`);
}
