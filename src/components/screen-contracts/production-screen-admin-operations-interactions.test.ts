import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

import { ADMIN_AUTHORIZATION_INVENTORY } from "@/app/admin/admin-authorization-inventory";
import { ADMIN_RESOURCE_STATUSES } from "@/app/admin/admin-status-contract";
import { SCREEN_CONTRACT_BY_ROUTE } from "../demo-experience-registry";
import {
  PRODUCTION_SCREEN_ACTION_EXCLUSION_ROUTES,
  PRODUCTION_SCREEN_FORM_EXCLUSION_ROUTES,
  PRODUCTION_SCREEN_INTERACTION_CONTRACTS,
  PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS,
} from "./production-screen-coverage";
import {
  type AdminOperationsInteractionRoute,
  PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_CONTRACTS,
  PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_ROUTES,
  PRODUCTION_SCREEN_ADMIN_OPERATIONS_SEMANTIC_FORM_COUNTS,
} from "./production-screen-admin-operations-interactions";
import {
  findFormSubmissionSignals,
  getLocalSourceClosure,
} from "./screen-contract-source-audit";

// screen-evidence-test-id: PRODUCTION-SCREEN-ADMIN-OPERATIONS-INTERACTIONS

const TEST_ID = PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_EVIDENCE_TEST.id;
const TEST_PATH =
  PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_EVIDENCE_TEST.path;
const FORM_CONTROLS_PATH = "src/app/admin/form-controls.tsx";
const formExclusions = new Set<string>(PRODUCTION_SCREEN_FORM_EXCLUSION_ROUTES);
const actionExclusions = new Set<string>(
  PRODUCTION_SCREEN_ACTION_EXCLUSION_ROUTES,
);
const onboardingExclusions = new Set(
  Object.keys(PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS),
);

const EXPECTED_SHARED_FORM_DEFINITIONS = {
  AdminStatusForm: [["updateAdminStatus"]],
  AdminEnabledForm: [["updateAdminStatus"]],
  AdminSupportTicketForm: [["updateAdminSupportTicketAction"]],
  AdminBugReportForm: [["updateAdminBugReportAction"]],
  AdminCreateUserForm: [["createAdminUserAction"]],
  AdminUserAccessForm: [["updateAdminUserAccessAction"]],
  AdminPlanForms: [
    ["upsertAdminPlanAction"],
    ["createAdminPriceAction"],
    ["upsertAdminEntitlementAction"],
  ],
  AdminRetentionForms: [
    ["upsertAdminRetentionPolicyAction"],
    ["createAdminDeletionJobAction"],
  ],
  AdminOrganizationForms: [
    ["upsertAdminOrganizationAction"],
    ["createAdminInvitationAction"],
  ],
  AdminExportForm: [["createAdminExportAction"]],
  AdminSourceHealthForm: [["upsertAdminSourceHealthAction"]],
  AdminDogOwnershipForm: [
    ["approveDogOwnershipAction", "rejectDogOwnershipAction"],
  ],
} as const;

type SharedFormComponent = keyof typeof EXPECTED_SHARED_FORM_DEFINITIONS;

type ComponentBinding = {
  kind: "component";
  formId: string;
  component: SharedFormComponent;
  internalFormIndex: number;
  resource?: string;
};

type DirectBinding = {
  kind: "direct";
  formId: string;
  directFormIndex: number;
  submitsTo: string;
};

type ExpectedBinding = ComponentBinding | DirectBinding;

function componentBinding(
  formId: string,
  component: SharedFormComponent,
  resource?: string,
  internalFormIndex = 0,
): ComponentBinding {
  return { kind: "component", formId, component, internalFormIndex, resource };
}

function directBinding(
  formId: string,
  directFormIndex: number,
  submitsTo: string,
): DirectBinding {
  return { kind: "direct", formId, directFormIndex, submitsTo };
}

const EXPECTED_FORM_BINDINGS = {
  "/admin/account-deletion": [
    componentBinding(
      "ADMIN-ACCOUNT-DELETION.FORM.STATUS",
      "AdminStatusForm",
      "deletionJob",
    ),
  ],
  "/admin/billing": [
    componentBinding(
      "ADMIN-BILLING.FORM.STATUS",
      "AdminStatusForm",
      "billingCustomer",
    ),
  ],
  "/admin/billing-events": [
    componentBinding(
      "ADMIN-BILLING-EVENTS.FORM.STATUS",
      "AdminStatusForm",
      "billingEvent",
    ),
  ],
  "/admin/bug-reports": [
    componentBinding("ADMIN-BUG-REPORTS.FORM.UPDATE", "AdminBugReportForm"),
  ],
  "/admin/dog-ownership": [
    componentBinding(
      "ADMIN-DOG-OWNERSHIP.FORM.REVIEW",
      "AdminDogOwnershipForm",
    ),
  ],
  "/admin/entitlements": [
    componentBinding(
      "ADMIN-ENTITLEMENTS.FORM.STATUS",
      "AdminStatusForm",
      "entitlementSnapshot",
    ),
  ],
  "/admin/exports": [
    componentBinding("ADMIN-EXPORTS.FORM.CREATE", "AdminExportForm"),
    componentBinding(
      "ADMIN-EXPORTS.FORM.STATUS",
      "AdminStatusForm",
      "exportArtifact",
    ),
  ],
  "/admin/feedback": [
    componentBinding(
      "ADMIN-FEEDBACK.FORM.STATUS",
      "AdminStatusForm",
      "feedback",
    ),
  ],
  "/admin/invitations": [
    componentBinding(
      "ADMIN-INVITATIONS.FORM.STATUS",
      "AdminStatusForm",
      "organizationInvitation",
    ),
  ],
  "/admin/invoices": [
    componentBinding(
      "ADMIN-INVOICES.FORM.STATUS",
      "AdminStatusForm",
      "invoiceRecord",
    ),
  ],
  "/admin/jobs": [
    componentBinding(
      "ADMIN-JOBS.FORM.STATUS",
      "AdminStatusForm",
      "row.resource",
    ),
  ],
  "/admin/organizations": [
    componentBinding(
      "ADMIN-ORGANIZATIONS.FORM.UPSERT",
      "AdminOrganizationForms",
      undefined,
      0,
    ),
    componentBinding(
      "ADMIN-ORGANIZATIONS.FORM.INVITATION.CREATE",
      "AdminOrganizationForms",
      undefined,
      1,
    ),
  ],
  "/admin/payments": [
    componentBinding(
      "ADMIN-PAYMENTS.FORM.PAYMENT.STATUS",
      "AdminStatusForm",
      "paymentRecord",
    ),
    componentBinding(
      "ADMIN-PAYMENTS.FORM.REFUND.STATUS",
      "AdminStatusForm",
      "refundRecord",
    ),
    componentBinding(
      "ADMIN-PAYMENTS.FORM.CREDIT-NOTE.STATUS",
      "AdminStatusForm",
      "creditNoteRecord",
    ),
  ],
  "/admin/plans": [
    componentBinding(
      "ADMIN-PLANS.FORM.PLAN.UPSERT",
      "AdminPlanForms",
      undefined,
      0,
    ),
    componentBinding(
      "ADMIN-PLANS.FORM.PRICE.CREATE",
      "AdminPlanForms",
      undefined,
      1,
    ),
    componentBinding(
      "ADMIN-PLANS.FORM.ENTITLEMENT.UPSERT",
      "AdminPlanForms",
      undefined,
      2,
    ),
    componentBinding("ADMIN-PLANS.FORM.PLAN.STATUS", "AdminStatusForm", "plan"),
    componentBinding(
      "ADMIN-PLANS.FORM.PRICE.STATUS",
      "AdminStatusForm",
      "priceCatalog",
    ),
    componentBinding(
      "ADMIN-PLANS.FORM.ENTITLEMENT.TOGGLE",
      "AdminEnabledForm",
      "planEntitlement",
    ),
  ],
  "/admin/retention": [
    componentBinding(
      "ADMIN-RETENTION.FORM.POLICY.UPSERT",
      "AdminRetentionForms",
      undefined,
      0,
    ),
    componentBinding(
      "ADMIN-RETENTION.FORM.DELETION-JOB.CREATE",
      "AdminRetentionForms",
      undefined,
      1,
    ),
    componentBinding(
      "ADMIN-RETENTION.FORM.POLICY.TOGGLE",
      "AdminEnabledForm",
      "retentionPolicy",
    ),
    componentBinding(
      "ADMIN-RETENTION.FORM.DELETION-JOB.STATUS",
      "AdminStatusForm",
      "deletionJob",
    ),
  ],
  "/admin/source-health": [
    componentBinding(
      "ADMIN-SOURCE-HEALTH.FORM.UPSERT",
      "AdminSourceHealthForm",
    ),
    componentBinding(
      "ADMIN-SOURCE-HEALTH.FORM.STATUS",
      "AdminStatusForm",
      "dataSourceHealth",
    ),
  ],
  "/admin/subscriptions": [
    componentBinding(
      "ADMIN-SUBSCRIPTIONS.FORM.STATUS",
      "AdminStatusForm",
      "subscription",
    ),
  ],
  "/admin/support": [
    componentBinding(
      "ADMIN-SUPPORT.FORM.TICKET.UPDATE",
      "AdminSupportTicketForm",
    ),
  ],
  "/admin/usage": [
    componentBinding(
      "ADMIN-USAGE.FORM.AGGREGATE.STATUS",
      "AdminStatusForm",
      "usageAggregate",
    ),
    componentBinding(
      "ADMIN-USAGE.FORM.EVENT.STATUS",
      "AdminStatusForm",
      "usageEvent",
    ),
    componentBinding(
      "ADMIN-USAGE.FORM.OUTBOX.STATUS",
      "AdminStatusForm",
      "usageOutbox",
    ),
  ],
  "/admin/users": [
    directBinding(
      "ADMIN-USERS.FORM.SEARCH",
      0,
      "SERVER ACTION lookupAdminUserAction",
    ),
    directBinding("ADMIN-USERS.FORM.FILTER", 1, "GET /admin/users"),
    componentBinding("ADMIN-USERS.FORM.USER.UPSERT", "AdminCreateUserForm"),
    componentBinding("ADMIN-USERS.FORM.ACCESS.UPDATE", "AdminUserAccessForm"),
  ],
  "/admin/webhooks": [
    componentBinding(
      "ADMIN-WEBHOOKS.FORM.STATUS",
      "AdminStatusForm",
      "webhookEvent",
    ),
  ],
} as const satisfies Record<
  AdminOperationsInteractionRoute,
  readonly ExpectedBinding[]
>;

const EXPECTED_ACTION_IDS = {
  "/admin/account-deletion": ["ADMIN-ACCOUNT-DELETION.ACTION.STATUS.UPDATE"],
  "/admin/billing": ["ADMIN-BILLING.ACTION.STATUS.UPDATE"],
  "/admin/billing-events": ["ADMIN-BILLING-EVENTS.ACTION.STATUS.UPDATE"],
  "/admin/bug-reports": ["ADMIN-BUG-REPORTS.ACTION.UPDATE"],
  "/admin/dog-ownership": [
    "ADMIN-DOG-OWNERSHIP.ACTION.APPROVE",
    "ADMIN-DOG-OWNERSHIP.ACTION.REJECT",
  ],
  "/admin/entitlements": ["ADMIN-ENTITLEMENTS.ACTION.STATUS.UPDATE"],
  "/admin/exports": [
    "ADMIN-EXPORTS.ACTION.CREATE",
    "ADMIN-EXPORTS.ACTION.STATUS.UPDATE",
  ],
  "/admin/feedback": ["ADMIN-FEEDBACK.ACTION.STATUS.UPDATE"],
  "/admin/invitations": ["ADMIN-INVITATIONS.ACTION.STATUS.UPDATE"],
  "/admin/invoices": ["ADMIN-INVOICES.ACTION.STATUS.UPDATE"],
  "/admin/jobs": ["ADMIN-JOBS.ACTION.STATUS.UPDATE"],
  "/admin/organizations": [
    "ADMIN-ORGANIZATIONS.ACTION.UPSERT",
    "ADMIN-ORGANIZATIONS.ACTION.INVITATION.CREATE",
  ],
  "/admin/payments": [
    "ADMIN-PAYMENTS.ACTION.PAYMENT.STATUS.UPDATE",
    "ADMIN-PAYMENTS.ACTION.REFUND.STATUS.UPDATE",
    "ADMIN-PAYMENTS.ACTION.CREDIT-NOTE.STATUS.UPDATE",
  ],
  "/admin/plans": [
    "ADMIN-PLANS.ACTION.PLAN.UPSERT",
    "ADMIN-PLANS.ACTION.PRICE.CREATE",
    "ADMIN-PLANS.ACTION.ENTITLEMENT.UPSERT",
    "ADMIN-PLANS.ACTION.PLAN.STATUS.UPDATE",
    "ADMIN-PLANS.ACTION.PRICE.STATUS.UPDATE",
    "ADMIN-PLANS.ACTION.ENTITLEMENT.TOGGLE",
  ],
  "/admin/retention": [
    "ADMIN-RETENTION.ACTION.POLICY.UPSERT",
    "ADMIN-RETENTION.ACTION.DELETION-JOB.CREATE",
    "ADMIN-RETENTION.ACTION.POLICY.TOGGLE",
    "ADMIN-RETENTION.ACTION.DELETION-JOB.STATUS.UPDATE",
  ],
  "/admin/source-health": [
    "ADMIN-SOURCE-HEALTH.ACTION.UPSERT",
    "ADMIN-SOURCE-HEALTH.ACTION.STATUS.UPDATE",
  ],
  "/admin/subscriptions": ["ADMIN-SUBSCRIPTIONS.ACTION.STATUS.UPDATE"],
  "/admin/support": ["ADMIN-SUPPORT.ACTION.TICKET.UPDATE"],
  "/admin/usage": [
    "ADMIN-USAGE.ACTION.AGGREGATE.STATUS.UPDATE",
    "ADMIN-USAGE.ACTION.EVENT.STATUS.UPDATE",
    "ADMIN-USAGE.ACTION.OUTBOX.STATUS.UPDATE",
  ],
  "/admin/users": [
    "ADMIN-USERS.ACTION.SEARCH",
    "ADMIN-USERS.ACTION.FILTER",
    "ADMIN-USERS.ACTION.FILTER.CLEAR",
    "ADMIN-USERS.ACTION.DETAIL.OPEN",
    "ADMIN-USERS.ACTION.DETAIL.CLOSE",
    "ADMIN-USERS.ACTION.PAGE.NAVIGATE",
    "ADMIN-USERS.ACTION.USER.UPSERT",
    "ADMIN-USERS.ACTION.ACCESS.UPDATE",
  ],
  "/admin/webhooks": ["ADMIN-WEBHOOKS.ACTION.STATUS.UPDATE"],
} as const satisfies Record<AdminOperationsInteractionRoute, readonly string[]>;

const EXPECTED_PAGE_ROLES = Object.fromEntries(
  PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_ROUTES.map((route) => [
    route,
    [
      "/admin/bug-reports",
      "/admin/dog-ownership",
      "/admin/feedback",
      "/admin/support",
    ].includes(route)
      ? "moderator"
      : "admin",
  ]),
) as Record<AdminOperationsInteractionRoute, "admin" | "moderator">;

const sharedDefinitions = discoverSharedFormDefinitions(FORM_CONTROLS_PATH);
assert.deepEqual(
  sharedDefinitions,
  EXPECTED_SHARED_FORM_DEFINITIONS,
  "the shared form-control symbol registry must fail closed on form or submitter drift",
);

assert.deepEqual(
  PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_ROUTES,
  Object.keys(EXPECTED_FORM_BINDINGS),
  "the admin-operations batch must fail closed on route additions or removals",
);
assert.deepEqual(
  Object.keys(PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_CONTRACTS),
  PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_ROUTES,
  "the owned contract module may contain only the reviewed admin-operation routes",
);
assert.deepEqual(
  Object.keys(PRODUCTION_SCREEN_ADMIN_OPERATIONS_SEMANTIC_FORM_COUNTS),
  PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_ROUTES,
  "every reviewed route needs an explicit symbol-aware form count",
);
assert.equal(PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_ROUTES.length, 21);

const registeredPages = new Map(
  ADMIN_AUTHORIZATION_INVENTORY.pages.map((surface) => [surface.id, surface]),
);
const registeredActions = new Map(
  ADMIN_AUTHORIZATION_INVENTORY.serverActions.map((surface) => [
    surface.id,
    surface,
  ]),
);
assert.equal(ADMIN_AUTHORIZATION_INVENTORY.runtimeDenial.status, "unverified");

let semanticFormCount = 0;
const referencedSubmitters = new Set<string>();

for (const route of PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_ROUTES) {
  const screen = SCREEN_CONTRACT_BY_ROUTE.get(route);
  const ownedInteraction =
    PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_CONTRACTS[route];
  const interaction = PRODUCTION_SCREEN_INTERACTION_CONTRACTS[route];
  const expectedBindings = EXPECTED_FORM_BINDINGS[
    route
  ] as readonly ExpectedBinding[];
  assert.ok(screen, `${route}: missing production screen contract`);
  assert.equal(screen.productionEnabled, true, `${route}: must remain live`);
  assert.equal(screen.authentication, "required");
  assert.equal(interaction, ownedInteraction);
  assert.equal(formExclusions.has(route), false);
  assert.equal(actionExclusions.has(route), false);
  assert.equal(onboardingExclusions.has(route), false);
  assert.equal(screen.coverage.onboarding.status, "tested");

  assert.deepEqual(
    interaction.actions.map((candidate) => candidate.id),
    EXPECTED_ACTION_IDS[route],
  );
  assert.deepEqual(
    interaction.forms.map((candidate) => candidate.id),
    expectedBindings.map((binding) => binding.formId),
  );
  assert.equal(
    PRODUCTION_SCREEN_ADMIN_OPERATIONS_SEMANTIC_FORM_COUNTS[route],
    expectedBindings.length,
  );
  assert.equal(interaction.forms.length, expectedBindings.length);
  assert.deepEqual(screen.queryParameters, [...interaction.queryParameters]);
  assert.deepEqual(
    screen.primaryActions,
    interaction.actions.map((candidate) => candidate.id),
  );
  assert.deepEqual(
    screen.forms,
    interaction.forms.map(
      (candidate) => `${candidate.id} -> ${candidate.submitsTo}`,
    ),
  );

  const pagePath = screen.sourceFiles[0];
  const pageUses = discoverPageFormComponentUses(pagePath, sharedDefinitions);
  const expectedComponentUseKeys = [
    ...new Set(
      expectedBindings
        .filter(
          (binding): binding is ComponentBinding =>
            binding.kind === "component",
        )
        .map(componentUseKey),
    ),
  ].toSorted();
  assert.deepEqual(
    pageUses.map((use) => use.key).toSorted(),
    expectedComponentUseKeys,
    `${route}: shared form-control callsites must match the reviewed symbol set`,
  );

  const expandedSourceBindings: string[] = pageUses
    .flatMap((use): string[] =>
      sharedDefinitions[use.component].map((submitters, index): string =>
        sourceBindingToken(use.key, index, submitters),
      ),
    )
    .toSorted();
  const expectedExpandedBindings: string[] = expectedBindings
    .filter(
      (binding): binding is ComponentBinding => binding.kind === "component",
    )
    .map((binding): string => {
      const definition: string[][] = sharedDefinitions[binding.component];
      const submitters: string[] | undefined =
        definition[binding.internalFormIndex];
      assert.ok(
        submitters,
        `${route}: ${binding.formId} references a missing internal form`,
      );
      for (const submitter of submitters) referencedSubmitters.add(submitter);
      return sourceBindingToken(
        componentUseKey(binding),
        binding.internalFormIndex,
        submitters,
      );
    })
    .toSorted();
  assert.deepEqual(
    expandedSourceBindings,
    expectedExpandedBindings,
    `${route}: referenced component definitions must expand to the exact reviewed form multiset`,
  );

  const directForms = discoverDirectForms(pagePath, route);
  const expectedDirectBindings = expectedBindings.filter(
    (binding): binding is DirectBinding => binding.kind === "direct",
  );
  assert.deepEqual(
    directForms.map((candidate) => candidate.submitsTo),
    expectedDirectBindings.map((binding) => binding.submitsTo),
    `${route}: direct page forms must remain exact`,
  );
  for (const binding of expectedDirectBindings) {
    assert.equal(
      directForms[binding.directFormIndex]?.submitsTo,
      binding.submitsTo,
      `${route}: ${binding.formId} must retain its direct submission target`,
    );
  }

  const closureFormsOutsideSharedModule = [...getLocalSourceClosure(pagePath)]
    .filter((sourcePath) => sourcePath !== FORM_CONTROLS_PATH)
    .flatMap(findFormSubmissionSignals)
    .filter((signal) => signal.endsWith(":<form>"));
  assert.equal(
    closureFormsOutsideSharedModule.length,
    expectedDirectBindings.length,
    `${route}: a form outside the reviewed shared symbol expansion is unregistered\n${closureFormsOutsideSharedModule.join("\n")}`,
  );

  for (const [index, binding] of expectedBindings.entries()) {
    const manifestForm = interaction.forms[index];
    const expectedSubmitsTo: string =
      binding.kind === "direct"
        ? binding.submitsTo
        : `SERVER ACTION ${sharedDefinitions[binding.component][
            binding.internalFormIndex
          ].join(" | ")}`;
    assert.equal(manifestForm.submitsTo, expectedSubmitsTo);
    assert.ok(manifestForm.schema && manifestForm.schema.length > 0);
    assert.deepEqual(manifestForm.testIds, [TEST_ID]);
  }
  for (const candidate of interaction.actions) {
    assert.ok(candidate.result.length > 0);
    assert.ok(candidate.enforcement && candidate.enforcement.length > 0);
    assert.deepEqual(candidate.testIds, [TEST_ID]);
  }

  const pageAuthorization = registeredPages.get(route);
  assert.ok(
    pageAuthorization,
    `${route}: missing authorization inventory page`,
  );
  assert.equal(
    pageAuthorization.requiredRole,
    EXPECTED_PAGE_ROLES[route],
    `${route}: page authorization role drifted`,
  );
  assert.equal(screen.coverage.actions.status, "verified");
  assert.equal(screen.coverage.forms.status, "verified");
  assert.ok(screen.coverage.actions.evidence.includes(TEST_PATH));
  assert.ok(screen.coverage.forms.evidence.includes(TEST_PATH));

  assertLiteralStatusCallsitesMatchAllowlist(pagePath);
  semanticFormCount += expectedBindings.length;
}

assert.equal(semanticFormCount, 39);

for (const submitter of referencedSubmitters) {
  const registered = registeredActions.get(submitter);
  assert.ok(
    registered,
    `${submitter}: missing server-action authorization entry`,
  );
  assert.equal(
    registered.requiredRole,
    submitter === "approveDogOwnershipAction" ||
      submitter === "rejectDogOwnershipAction"
      ? "moderator"
      : "admin",
    `${submitter}: server-action role drifted`,
  );
}

assert.deepEqual(
  discoverOperationalJobStatuses("src/app/admin/jobs/page.tsx"),
  {
    usageOutbox: ADMIN_RESOURCE_STATUSES.usageOutbox,
    usageEvent: ADMIN_RESOURCE_STATUSES.usageEvent,
    webhookEvent: ADMIN_RESOURCE_STATUSES.webhookEvent,
    jobRun: ADMIN_RESOURCE_STATUSES.jobRun,
  },
);

for (const [pagePath, assertion] of [
  ["src/app/admin/bug-reports/page.tsx", "canManageReports ? ("] as const,
  ["src/app/admin/feedback/page.tsx", "canManageFeedback ? ("] as const,
  ["src/app/admin/support/page.tsx", "canManageTickets ? ("] as const,
]) {
  assert.ok(
    readFileSync(pagePath, "utf8").includes(assertion),
    `${pagePath}: moderator-readable page must hide admin-only form controls`,
  );
}

const usersSource = readFileSync("src/app/admin/users/page.tsx", "utf8");
for (const assertion of [
  "const current = await requireAdminProfile();",
  "const rawSearchParams = await searchParams;",
  "parseAdminUsersQuery(rawSearchParams)",
  "action={lookupAdminUserAction}",
  'name="lookup"',
  "ADMIN_USER_ID_PATTERN.test(selectedUserId)",
  "USER_TIERS.includes",
  "USER_ROLES.includes",
  "Number.isSafeInteger(pageValue) && pageValue > 0",
  'href="/admin/users"',
  "href={`${buildAdminUsersHref(query, result.page, user.id)}#selected-user`}",
  "href={buildAdminUsersHref(query, result.page - 1)}",
  "href={buildAdminUsersHref(query, result.page + 1)}",
]) {
  assert.ok(
    usersSource.includes(assertion),
    `/admin/users must preserve ${assertion}`,
  );
}

const mutationsSource = readFileSync("src/app/admin/mutations.ts", "utf8");
for (const assertion of [
  "const resourceSchema = z.enum([",
  "const statusInputSchema = z.object({",
  "assertAdminResourceMutation(",
  "const createUserSchema = z.object({",
  "const updateUserAccessSchema = z.object({",
  "const planSchema = z.object({",
  "const priceSchema = z.object({",
  "const retentionPolicySchema = z.object({",
  "const deletionJobSchema = z.object({",
  "const organizationSchema = z.object({",
  "const invitationSchema = z.object({",
  "const exportSchema = z.object({",
  "const sourceHealthSchema = z.object({",
  "const supportTicketSchema = z.object({",
  "const bugReportSchema = z.object({",
  "const dogOwnershipReviewSchema = z.object({",
]) {
  assert.ok(
    mutationsSource.includes(assertion),
    `admin mutation validation must preserve ${assertion}`,
  );
}

const submitButtonSource = readFileSync(
  "src/app/admin/admin-submit-button.tsx",
  "utf8",
);
for (const assertion of [
  "const { pending } = useFormStatus();",
  "disabled={pending || disabled}",
  "aria-busy={pending}",
  "window.confirm(confirmMessage)",
]) {
  assert.ok(
    submitButtonSource.includes(assertion),
    `admin submit feedback must preserve ${assertion}`,
  );
}

console.log(
  "Admin-operations interaction coverage passed: 21 routes, 39 symbol-bound forms, shared form definitions and authorization allowlists exact; request-level denial remains unverified",
);

function parseSource(repoPath: string) {
  const source = readFileSync(path.resolve(repoPath), "utf8");
  return ts.createSourceFile(
    repoPath,
    source,
    ts.ScriptTarget.Latest,
    true,
    repoPath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function visit(node: ts.Node, inspect: (candidate: ts.Node) => void) {
  inspect(node);
  ts.forEachChild(node, (child) => visit(child, inspect));
}

function discoverSharedFormDefinitions(repoPath: string) {
  const sourceFile = parseSource(repoPath);
  const definitions: Record<string, string[][]> = {};

  for (const statement of sourceFile.statements) {
    if (!ts.isFunctionDeclaration(statement) || !statement.name) continue;
    const exported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!exported || !statement.body) continue;
    const forms: string[][] = [];
    visit(statement.body, (node) => {
      if (!isJsxTag(node, "form")) return;
      const submitters: string[] = [];
      const action = jsxAttributeExpression(node, sourceFile, "action");
      if (action) submitters.push(action);
      const formSubtree =
        ts.isJsxOpeningElement(node) && ts.isJsxElement(node.parent)
          ? node.parent
          : node;
      visit(formSubtree, (descendant) => {
        if (!ts.isJsxAttribute(descendant)) return;
        if (descendant.name.getText(sourceFile) !== "formAction") return;
        const expression = jsxAttributeExpressionFromAttribute(
          descendant,
          sourceFile,
        );
        if (expression) submitters.push(expression);
      });
      assert.ok(
        submitters.length > 0,
        `${repoPath}:${statement.name?.text} contains an unbound form`,
      );
      forms.push(submitters);
    });
    if (forms.length > 0) definitions[statement.name.text] = forms;
  }

  return definitions as Record<SharedFormComponent, string[][]>;
}

function discoverPageFormComponentUses(
  repoPath: string,
  definitions: Record<SharedFormComponent, string[][]>,
) {
  const sourceFile = parseSource(repoPath);
  const components = new Set(Object.keys(definitions));
  const uses: Array<{ component: SharedFormComponent; key: string }> = [];
  visit(sourceFile, (node) => {
    if (!isJsxOpeningLike(node)) return;
    const component = node.tagName.getText(sourceFile);
    if (!components.has(component)) return;
    const resource = jsxAttributeText(node, sourceFile, "resource");
    uses.push({
      component: component as SharedFormComponent,
      key: componentUseKey({
        component: component as SharedFormComponent,
        resource,
      }),
    });
  });
  return uses;
}

function discoverDirectForms(repoPath: string, route: string) {
  const sourceFile = parseSource(repoPath);
  const forms: Array<{ submitsTo: string }> = [];
  visit(sourceFile, (node) => {
    if (!isJsxTag(node, "form")) return;
    const action = jsxAttributeText(node, sourceFile, "action");
    if (action && action !== route) {
      forms.push({ submitsTo: `SERVER ACTION ${action}` });
      return;
    }
    const method =
      jsxAttributeText(node, sourceFile, "method")?.toUpperCase() ?? "GET";
    forms.push({ submitsTo: `${method} ${action ?? route}` });
  });
  return forms;
}

function assertLiteralStatusCallsitesMatchAllowlist(repoPath: string) {
  const sourceFile = parseSource(repoPath);
  visit(sourceFile, (node) => {
    if (!isJsxOpeningLike(node)) return;
    const component = node.tagName.getText(sourceFile);
    if (component !== "AdminStatusForm" && component !== "AdminEnabledForm") {
      return;
    }
    const resource = jsxAttributeText(node, sourceFile, "resource");
    assert.ok(resource, `${repoPath}: ${component} needs a resource binding`);
    if (resource.includes(".")) return;
    assert.ok(
      resource in ADMIN_RESOURCE_STATUSES,
      `${repoPath}: unknown admin resource ${resource}`,
    );
    const allowed =
      ADMIN_RESOURCE_STATUSES[resource as keyof typeof ADMIN_RESOURCE_STATUSES];
    if (component === "AdminEnabledForm") {
      assert.deepEqual(allowed, []);
      return;
    }
    const statuses = jsxStringArrayAttribute(node, sourceFile, "statuses");
    assert.deepEqual(
      statuses,
      allowed,
      `${repoPath}: ${resource} UI statuses must equal the server allowlist`,
    );
  });
}

function discoverOperationalJobStatuses(repoPath: string) {
  const sourceFile = parseSource(repoPath);
  const statuses: Record<string, readonly string[]> = {};
  let target: ts.FunctionDeclaration | undefined;
  for (const statement of sourceFile.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === "statusesForOperationalRow"
    ) {
      target = statement;
      break;
    }
  }
  assert.ok(target?.body, `${repoPath}: missing statusesForOperationalRow`);
  visit(target.body, (node) => {
    if (!ts.isCaseClause(node) || !ts.isStringLiteral(node.expression)) return;
    const returned = node.statements.find(ts.isReturnStatement)?.expression;
    assert.ok(
      returned && ts.isArrayLiteralExpression(returned),
      `${repoPath}: ${node.expression.text} must return a literal status array`,
    );
    statuses[node.expression.text] = returned.elements.map((element) => {
      assert.ok(ts.isStringLiteral(element));
      return element.text;
    });
  });
  return statuses;
}

function isJsxOpeningLike(
  node: ts.Node,
): node is ts.JsxOpeningElement | ts.JsxSelfClosingElement {
  return ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node);
}

function isJsxTag(
  node: ts.Node,
  tag: string,
): node is ts.JsxOpeningElement | ts.JsxSelfClosingElement {
  return isJsxOpeningLike(node) && node.tagName.getText() === tag;
}

function jsxAttribute(
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  sourceFile: ts.SourceFile,
  name: string,
) {
  return node.attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && property.name.getText(sourceFile) === name,
  );
}

function jsxAttributeText(
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  sourceFile: ts.SourceFile,
  name: string,
) {
  const attribute = jsxAttribute(node, sourceFile, name);
  if (!attribute?.initializer) return undefined;
  if (ts.isStringLiteral(attribute.initializer))
    return attribute.initializer.text;
  if (
    ts.isJsxExpression(attribute.initializer) &&
    attribute.initializer.expression
  ) {
    return attribute.initializer.expression.getText(sourceFile);
  }
  return undefined;
}

function jsxAttributeExpression(
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  sourceFile: ts.SourceFile,
  name: string,
) {
  const attribute = jsxAttribute(node, sourceFile, name);
  return attribute
    ? jsxAttributeExpressionFromAttribute(attribute, sourceFile)
    : undefined;
}

function jsxAttributeExpressionFromAttribute(
  attribute: ts.JsxAttribute,
  sourceFile: ts.SourceFile,
) {
  const initializer = attribute.initializer;
  if (!initializer) return undefined;
  if (ts.isStringLiteral(initializer)) return initializer.text;
  if (ts.isJsxExpression(initializer) && initializer.expression) {
    return initializer.expression.getText(sourceFile);
  }
  return undefined;
}

function jsxStringArrayAttribute(
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  sourceFile: ts.SourceFile,
  name: string,
) {
  const attribute = jsxAttribute(node, sourceFile, name);
  const expression =
    attribute?.initializer && ts.isJsxExpression(attribute.initializer)
      ? attribute.initializer.expression
      : undefined;
  assert.ok(
    expression && ts.isArrayLiteralExpression(expression),
    `${sourceFile.fileName}: ${name} must remain a literal array`,
  );
  return expression.elements.map((element) => {
    assert.ok(ts.isStringLiteral(element));
    return element.text;
  });
}

function componentUseKey({
  component,
  resource,
}: Pick<ComponentBinding, "component" | "resource">) {
  return resource ? `${component}[resource=${resource}]` : component;
}

function sourceBindingToken(
  useKey: string,
  internalFormIndex: number,
  submitters: readonly string[],
) {
  return `${useKey}#${internalFormIndex}:${submitters.join("|")}`;
}
