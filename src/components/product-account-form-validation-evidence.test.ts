import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

import {
  PRODUCT_ACCOUNT_FORM_VALIDATION_CASES,
  PRODUCT_ACCOUNT_FORM_VALIDATION_EVIDENCE_FILE,
  PRODUCT_ACCOUNT_FORM_VALIDATION_EXPECTED_GAIN,
  PRODUCT_ACCOUNT_FORM_VALIDATION_MASTER_EVIDENCE,
  PRODUCT_ACCOUNT_FORM_VALIDATION_REQUIREMENT_IDS,
  PRODUCT_ACCOUNT_FORM_VALIDATION_SCOPE,
  PRODUCT_ACCOUNT_FORM_VALIDATION_TEST_FILE,
} from "./product-account-form-validation-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import { PRODUCTION_SCREEN_INTERACTION_CONTRACTS } from "./screen-contracts/production-screen-coverage";

// screen-evidence-test-id: PRODUCT-ACCOUNT-FORM-VALIDATION

const REQUIREMENT_ID = "ROUTE.ACCOUNT.validate" as const;
const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  ({ id }) => id === REQUIREMENT_ID,
);
assert.ok(requirement, REQUIREMENT_ID);
assert.equal(
  requirement.requirement,
  "Validate every account form before mutation.",
);
assert.deepEqual(PRODUCT_ACCOUNT_FORM_VALIDATION_REQUIREMENT_IDS, [
  REQUIREMENT_ID,
]);
assert.equal(PRODUCT_ACCOUNT_FORM_VALIDATION_EXPECTED_GAIN, 1);
assert.deepEqual(Object.keys(PRODUCT_ACCOUNT_FORM_VALIDATION_MASTER_EVIDENCE), [
  REQUIREMENT_ID,
]);

const evidence = PRODUCT_ACCOUNT_FORM_VALIDATION_MASTER_EVIDENCE[REQUIREMENT_ID];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_ACCOUNT_FORM_VALIDATION_EVIDENCE_FILE,
  PRODUCT_ACCOUNT_FORM_VALIDATION_TEST_FILE,
]);
assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
evidence.evidence.forEach((path) => assert.equal(existsSync(path), true, path));

assert.match(PRODUCT_ACCOUNT_FORM_VALIDATION_SCOPE, /source-static/i);
assert.match(PRODUCT_ACCOUNT_FORM_VALIDATION_SCOPE, /all 24 structured account forms/i);
assert.match(PRODUCT_ACCOUNT_FORM_VALIDATION_SCOPE, /does not prove deployed identity/i);
assert.match(PRODUCT_ACCOUNT_FORM_VALIDATION_SCOPE, /database RLS/i);
assert.match(PRODUCT_ACCOUNT_FORM_VALIDATION_SCOPE, /hydrated browser feedback/i);

const accountForms = Object.entries(PRODUCTION_SCREEN_INTERACTION_CONTRACTS)
  .filter(([route]) => route === "/account" || route.startsWith("/account/"))
  .flatMap(([route, interaction]) =>
    interaction.forms.map((form) => ({
      route,
      formId: form.id,
      submitsTo: form.submitsTo,
    })),
  );
const validationCases = PRODUCT_ACCOUNT_FORM_VALIDATION_CASES.map(
  ({ route, formId, submitsTo }) => ({ route, formId, submitsTo }),
);
assert.equal(accountForms.length, 24);
assert.deepEqual(
  validationCases,
  accountForms,
  "account form additions, removals, destinations, or ordering must fail closed",
);
assert.equal(
  new Set(PRODUCT_ACCOUNT_FORM_VALIDATION_CASES.map(({ formId }) => formId)).size,
  PRODUCT_ACCOUNT_FORM_VALIDATION_CASES.length,
);
assert.deepEqual(countByKind(), {
  "current-user-zero-payload": 4,
  "schema-validated": 8,
  "schema-validated-authorized": 7,
  "server-bound-owned": 3,
  "validated-get-only": 2,
});

for (const validationCase of PRODUCT_ACCOUNT_FORM_VALIDATION_CASES) {
  const isGet = validationCase.submitsTo.startsWith("GET ");
  assert.equal(
    validationCase.kind === "validated-get-only",
    isGet,
    `${validationCase.formId}: only GET-only forms may bypass a mutation boundary`,
  );
}

const actions = source("src/app/actions.ts");
assertInOrder(functionSource(actions, "updateProfile"), [
  "requireCurrentUserProfile()",
  "profileUpdateSchema.parse({",
  "tx.profile.update({",
]);
assertInOrder(functionSource(actions, "updatePersonalIdentityMedia"), [
  "requireCurrentUserProfile()",
  "personalActorMediaUpdateSchema.parse({",
  "updatePersonalActorMedia(current, parsed)",
]);
assertInOrder(functionSource(actions, "createCustomPageAction"), [
  "requireCurrentUserProfile()",
  "customPageCreateSchema.parse(raw)",
  "createCustomPage(current, parsed)",
]);
assertInOrder(functionSource(actions, "updateCustomPageAction"), [
  "requireCurrentUserProfile()",
  "customPageUpdateSchema.parse({",
  "updateCustomPage(current, pageId, parsed)",
]);

const publishSchema = variableStatementSource(actions, "customPagePublishSchema");
assert.match(
  compact(publishSchema),
  /z\.object\(\{\s*publish:\s*z\.enum\(\["true",\s*"false"\]\)/,
);
const publishAction = functionSource(actions, "publishCustomPageAction");
assertInOrder(publishAction, [
  "requireCurrentUserProfile()",
  "customPagePublishSchema.parse({",
  'publish: field(formData, "publish")',
  'setCustomPagePublished(current, pageId, parsed.publish === "true")',
]);
assert.doesNotMatch(
  publishAction,
  /const publish = field\(formData, "publish"\) === "true"/,
  "invalid publish values must be rejected instead of silently becoming false",
);

const deletionAction = functionSource(actions, "requestAccountDeletion");
assertInOrder(deletionAction, [
  "requireCurrentUserProfile()",
  "destructiveConfirmationSchema.parse({",
  'confirmation: field(formData, "confirmation")',
  "requestAccountDeletionForUser(current)",
]);
const pageDeletionAction = functionSource(actions, "deleteCustomPageAction");
assertInOrder(pageDeletionAction, [
  "requireCurrentUserProfile()",
  "destructiveConfirmationSchema.parse({",
  'confirmation: field(formData, "confirmation")',
  "deleteCustomPage(current, pageId)",
]);

const allReadAction = functionSource(actions, "markAllNotificationsRead");
assertInOrder(allReadAction, [
  "void _formData",
  "requireCurrentUserProfile()",
  "markAllNotificationsReadForCurrentUser(current)",
]);
const itemReadAction = functionSource(actions, "markNotificationRead");
assertInOrder(itemReadAction, [
  "void _formData",
  "requireCurrentUserProfile()",
  "markNotificationReadForCurrentUser(current, notificationId)",
]);

const notificationPage = source("src/app/account/notifications/page.tsx");
assert.match(notificationPage, /markNotificationRead\.bind\(null, record\.id\)/);
const customPageEditor = source("src/app/account/pages/[id]/page.tsx");
for (const binding of [
  "publishCustomPageAction.bind(null, page.id)",
  "updateCustomPageAction.bind(null, page.id)",
  "deleteCustomPageAction.bind(null, page.id)",
  "generateDogCardAction.bind(null, page.id)",
]) {
  assert.ok(customPageEditor.includes(binding), binding);
}

const notificationService = source("src/lib/notification-service.ts");
assertInOrder(
  functionSource(notificationService, "markNotificationReadForCurrentUser"),
  [
    "notificationId: string",
    "id: notificationId, userId: current.dbUserId, readAt: null",
    "data: { readAt: new Date() }",
  ],
);
const customPageService = source("src/lib/custom-page-service.ts");
const requireOwnedPage = functionSource(customPageService, "requireOwnedPage");
assert.match(
  compact(requireOwnedPage),
  /where:\s*\{\s*id:\s*pageId,\s*ownerProfileId:\s*current\.profileId\s*\}/,
);
for (const name of [
  "updateCustomPage",
  "setCustomPagePublished",
  "deleteCustomPage",
]) {
  assert.ok(
    functionSource(customPageService, name).includes(
      "requireOwnedPage(current, pageId)",
    ),
    name,
  );
}
const dogCard = functionSource(source("src/lib/dog-card-service.ts"), "generateDogCard");
assert.match(
  compact(dogCard),
  /where:\s*\{\s*id:\s*pageId,\s*ownerProfileId:\s*current\.profileId,\s*pageType:\s*"dog"\s*\}/,
);

const checkout = exportedFunctionSource(
  source("src/app/api/billing/checkout/route.ts"),
  "POST",
);
assertInOrder(checkout, [
  "readBoundedJsonOrFormRequest(request)",
  "assertTrustedOrigin(request, env)",
  "requireCurrentUserProfile()",
  "createStripeCheckoutSession({",
]);

for (const routePath of [
  "src/app/api/billing/portal/route.ts",
  "src/app/api/billing/bespoke/checkout/route.ts",
] as const) {
  const post = exportedFunctionSource(source(routePath), "POST");
  assertInOrder(post, [
    "assertTrustedOrigin(request, env)",
    "requireCurrentUserProfile()",
    routePath.includes("bespoke")
      ? "createBespokeDesignCheckoutSession({ current, env })"
      : "createStripePortalSession({ current, env })",
  ]);
  assert.doesNotMatch(post, /request\.(?:json|formData)\(/, routePath);
}

const exportPost = exportedFunctionSource(
  source("src/app/api/users/me/export/route.ts"),
  "POST",
);
assertInOrder(exportPost, [
  'request.headers.get("sec-fetch-site")',
  "requireCurrentUserProfile()",
  "recordUserExportCompletion(current,",
]);
assert.doesNotMatch(exportPost, /request\.(?:json|formData)\(/);

const appearanceState = source("src/components/appearance-preview-state.ts");
for (const token of [
  "isPrototypeVariant(requestedApp)",
  "isDockSkinKey(requestedDock)",
  "resolveMarketplaceTemplateKey(firstValue(searchParams.market))",
  'firstValue(value) === "off" ? "off" : "on"',
]) {
  assert.ok(appearanceState.includes(token), token);
}
const supportPage = source("src/app/account/support/page.tsx");
assert.match(
  supportPage,
  /<AccountSupportHelpCentre\s+profileScope=\{current\.profileId\}\s+query=\{query\.q\}\s+role=\{current\.role\}\s+\/>/,
);
const helpCentre = source("src/components/account-support-help-centre.tsx");
assert.match(helpCentre, /normalizeHelpSearchQuery\(query\)/);
const helpCatalogue = source("src/components/onboarding-help-catalogue.ts");
assert.match(
  compact(helpCatalogue),
  /function normalizeHelpSearchQuery[\s\S]*?Array\.isArray\(value\) \? value\[0\] : value[\s\S]*?\.trim\(\)\.replace\(\/\\s\+\/g, " "\)\.slice\(0, 80\)/,
);

const teamActions = source("src/app/account/team/actions.ts");
assertInOrder(functionSource(teamActions, "createTeamInvitationAction"), [
  "inviteSchema.safeParse({",
  "if (!parsed.success)",
  "requireCurrentUserProfile()",
  "requireTeamRateLimit(",
  "createOrganizationTeamInvitation(",
]);
assertInOrder(functionSource(teamActions, "decideTeamInvitationAction"), [
  "invitationDecisionSchema.safeParse({",
  "if (!parsed.success)",
  "requireCurrentUserProfile()",
  "requireTeamRateLimit(",
  "acceptOrganizationTeamInvitation(current, parsed.data.token)",
  "rejectOrganizationTeamInvitation(current, parsed.data.token)",
]);
assertInOrder(functionSource(teamActions, "leaveTeamAction"), [
  "leaveSchema.safeParse({",
  "if (!parsed.success)",
  "requireCurrentUserProfile()",
  "requireTeamRateLimit(",
  "leaveOrganizationTeam(current, parsed.data.organizationId)",
]);
assertInOrder(functionSource(teamActions, "removeTeamMemberAction"), [
  "memberRemovalSchema.safeParse({",
  "if (!parsed.success)",
  "requireCurrentUserProfile()",
  "requireTeamRateLimit(",
  "removeOrganizationTeamMember(current, parsed.data)",
]);
assertInOrder(functionSource(teamActions, "changeTeamMemberRoleAction"), [
  "membershipRoleSchema.safeParse({",
  "if (!parsed.success)",
  "requireCurrentUserProfile()",
  "requireTeamRateLimit(",
  "changeOrganizationTeamMemberRole(current, parsed.data)",
]);
assert.match(
  compact(variableStatementSource(teamActions, "invitationDecisionSchema")),
  /decision:\s*z\.enum\(\["accept",\s*"reject"\]\)/,
);
const membershipRoleSchema = compact(
  variableStatementSource(teamActions, "membershipRoleSchema"),
);
assert.match(membershipRoleSchema, /confirmation:\s*z\.literal\("CHANGE_ROLE"\)/);
assert.match(membershipRoleSchema, /confirmation:\s*z\.literal\("TRANSFER"\)/);

const teamService = source("src/lib/organization-team-service.ts");
assertInOrder(
  functionSource(teamService, "createOrganizationTeamInvitation"),
  [
    "lockOrganization(tx, input.organizationId)",
    "getTeamAuthority(tx, organization, current.dbUserId)",
    "canInviteTeamRole(authority, input.role)",
  ],
);
assertInOrder(functionSource(teamService, "decideOrganizationTeamInvitation"), [
  "hashTeamInvitationEmail(current.email)",
  "invitation.emailHash !== emailHash",
  'invitation.status !== "pending"',
]);
assertInOrder(functionSource(teamService, "leaveOrganizationTeam"), [
  "lockOrganization(tx, organizationId)",
  "getTeamMembership(",
  "resolveTeamAuthority({",
  "canLeaveTeam(authority)",
]);
assertInOrder(functionSource(teamService, "removeOrganizationTeamMember"), [
  "lockOrganization(tx, input.organizationId)",
  "getTeamAuthority(",
  "canRemoveTeamMember({",
]);
assertInOrder(
  functionSource(teamService, "changeOrganizationTeamMemberRole"),
  [
    "lockOrganization(tx, input.organizationId)",
    "getTeamAuthority(",
    "canChangeTeamMemberRole({",
  ],
);

const evidenceSource = source(PRODUCT_ACCOUNT_FORM_VALIDATION_EVIDENCE_FILE);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Account form-validation evidence passed in isolation: all 24 account forms are fail-closed across eight schemas, seven schema-validated and server-authorized team mutations, three server-bound ownership checks, four zero-payload current-user operations, and two validated GET-only forms; exact +1 central wiring is ready.",
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

function exportedFunctionSource(value: string, name: string) {
  const sourceFile = parse(value);
  const match = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === name &&
      statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      ) === true,
  );
  assert.ok(match, `Missing exported function ${name}`);
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

function countByKind() {
  return Object.fromEntries(
    [...new Set(PRODUCT_ACCOUNT_FORM_VALIDATION_CASES.map(({ kind }) => kind))]
      .toSorted()
      .map((kind) => [
        kind,
        PRODUCT_ACCOUNT_FORM_VALIDATION_CASES.filter(
          (validationCase) => validationCase.kind === kind,
        ).length,
      ]),
  );
}
