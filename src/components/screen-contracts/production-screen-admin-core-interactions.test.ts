import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SCREEN_CONTRACT_BY_ROUTE } from "../demo-experience-registry";
import {
  PRODUCTION_SCREEN_ACTION_EXCLUSION_ROUTES,
  PRODUCTION_SCREEN_FORM_EXCLUSION_ROUTES,
  PRODUCTION_SCREEN_INTERACTION_CONTRACTS,
  PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS,
} from "./production-screen-coverage";
import {
  PRODUCTION_SCREEN_ADMIN_CORE_INTERACTION_CONTRACTS,
  PRODUCTION_SCREEN_ADMIN_CORE_INTERACTION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_ADMIN_CORE_INTERACTION_ROUTES,
} from "./production-screen-admin-core-interactions";
import {
  findFormSubmissionSignals,
  findUserActionSignals,
  getLocalSourceClosure,
} from "./screen-contract-source-audit";

// screen-evidence-test-id: PRODUCTION-SCREEN-ADMIN-CORE-INTERACTIONS

const TEST_ID = PRODUCTION_SCREEN_ADMIN_CORE_INTERACTION_EVIDENCE_TEST.id;
const TEST_PATH = PRODUCTION_SCREEN_ADMIN_CORE_INTERACTION_EVIDENCE_TEST.path;
const actionExclusions = new Set<string>(
  PRODUCTION_SCREEN_ACTION_EXCLUSION_ROUTES,
);
const formExclusions = new Set<string>(PRODUCTION_SCREEN_FORM_EXCLUSION_ROUTES);
const onboardingExclusions = new Set(
  Object.keys(PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS),
);

const EXPECTED_ADMIN_CORE_INTERACTIONS = {
  "/admin": {
    queryParameters: [],
    actionIds: [
      "ADMIN.ACTION.QUEUE.OPEN",
      "ADMIN.ACTION.SOURCE-HEALTH.OPEN",
      "ADMIN.ACTION.SECTION.OPEN",
    ],
    forms: [],
    sourceAssertions: [
      "const operator = await requireModeratorProfile();",
      'if (operator.profileRole !== "admin") redirect("/admin/reports");',
      "const current = await requireAdminProfile();",
      "const sections = adminNavForRole(current.profileRole).filter(",
      'href="/admin/source-health"',
      "href={item.href}",
    ],
  },
  "/admin/bespoke": {
    queryParameters: [],
    actionIds: ["ADMIN-BESPOKE.ACTION.REQUEST.UPDATE"],
    forms: [
      [
        "ADMIN-BESPOKE.FORM.REQUEST-UPDATE",
        "SERVER ACTION updateBespokeRequestAction",
      ],
    ],
    sourceAssertions: [
      "const current = await requireModeratorProfile();",
      "listCustomDesignRequests(current)",
      "<form key={r.id} action={updateBespokeRequestAction}",
      'name="id" value={r.id}',
      'name="status"',
      'defaultValue={r.status}',
      'name="notes"',
      "maxLength={2000}",
    ],
  },
  "/admin/page-rules": {
    queryParameters: [],
    actionIds: ["ADMIN-PAGE-RULES.ACTION.UPDATE"],
    forms: [
      ["ADMIN-PAGE-RULES.FORM.UPDATE", "SERVER ACTION updatePageRulesAction"],
    ],
    sourceAssertions: [
      "await requireAdminProfile();",
      "<form action={updatePageRulesAction}",
      'name="cardGenerationEnabled"',
      "name={rule.name}",
      "<SubmitButton",
    ],
  },
  "/admin/site-content": {
    queryParameters: [],
    actionIds: ["ADMIN-SITE-CONTENT.ACTION.PRICING.UPDATE"],
    forms: [
      [
        "ADMIN-SITE-CONTENT.FORM.PRICING-UPDATE",
        "SERVER ACTION updatePricingContentAction",
      ],
    ],
    sourceAssertions: [
      "await requireAdminProfile();",
      "<form action={updatePricingContentAction}",
      "{plans.map((plan) => (",
      "name={`${plan.id}_features`}",
      "name={`${plan.id}_notIncluded`}",
      'name="yearlyNote"',
    ],
  },
} as const;

assert.deepEqual(
  PRODUCTION_SCREEN_ADMIN_CORE_INTERACTION_ROUTES,
  Object.keys(EXPECTED_ADMIN_CORE_INTERACTIONS),
  "the admin-core batch must fail closed on route additions or removals",
);
assert.deepEqual(
  Object.keys(PRODUCTION_SCREEN_ADMIN_CORE_INTERACTION_CONTRACTS),
  PRODUCTION_SCREEN_ADMIN_CORE_INTERACTION_ROUTES,
  "the owned module may contain only the reviewed admin-core routes",
);
assert.equal(PRODUCTION_SCREEN_ADMIN_CORE_INTERACTION_ROUTES.length, 4);

let actionInventoryCount = 0;
let structuredFormCount = 0;

for (const route of PRODUCTION_SCREEN_ADMIN_CORE_INTERACTION_ROUTES) {
  const expected = EXPECTED_ADMIN_CORE_INTERACTIONS[route];
  const ownedInteraction =
    PRODUCTION_SCREEN_ADMIN_CORE_INTERACTION_CONTRACTS[route];
  const interaction = PRODUCTION_SCREEN_INTERACTION_CONTRACTS[route];
  const screen = SCREEN_CONTRACT_BY_ROUTE.get(route);
  assert.ok(screen, `${route}: missing production screen contract`);
  assert.equal(
    screen.productionEnabled,
    true,
    `${route}: must be production-enabled`,
  );
  assert.equal(screen.authentication, "required");
  assert.equal(onboardingExclusions.has(route), false);
  assert.equal(
    screen.coverage.onboarding.status,
    "tested",
    `${route}: shared role-aware onboarding must remain tested`,
  );
  assert.equal(actionExclusions.has(route), false);
  assert.equal(formExclusions.has(route), expected.forms.length === 0);
  assert.equal(interaction, ownedInteraction);

  assert.deepEqual(interaction.queryParameters, expected.queryParameters);
  assert.deepEqual(
    interaction.actions.map((candidate) => candidate.id),
    expected.actionIds,
  );
  assert.deepEqual(
    interaction.forms.map((candidate) => [candidate.id, candidate.submitsTo]),
    expected.forms,
  );
  assert.deepEqual(screen.queryParameters, [...expected.queryParameters]);
  assert.deepEqual(screen.primaryActions, [...expected.actionIds]);
  assert.deepEqual(
    screen.forms,
    expected.forms.map(([id, submitsTo]) => `${id} -> ${submitsTo}`),
  );

  const closure = getLocalSourceClosure(screen.sourceFiles[0]);
  const formSignals = [...closure].flatMap(findFormSubmissionSignals);
  const actionSignals = [...closure].flatMap(findUserActionSignals);
  const sourceForms = formSignals.filter((signal) =>
    signal.endsWith(":<form>"),
  );
  assert.equal(
    sourceForms.length,
    expected.forms.length,
    `${route}: every source-owned form must have exactly one manifest entry\n${sourceForms.join("\n")}`,
  );
  assert.ok(
    actionSignals.length > 0,
    `${route}: verified actions require a source-owned interaction signal`,
  );
  if (expected.forms.length === 0) {
    assert.deepEqual(
      formSignals,
      [],
      `${route}: form exclusion must stay exact`,
    );
  }

  assert.equal(screen.coverage.actions.status, "verified");
  assert.equal(
    screen.coverage.forms.status,
    expected.forms.length === 0 ? "excluded" : "verified",
  );
  assert.ok(screen.coverage.actions.evidence.includes(TEST_PATH));
  assert.ok(screen.coverage.forms.evidence.includes(TEST_PATH));
  for (const candidate of interaction.actions) {
    assert.ok(candidate.result.length > 0);
    assert.ok(candidate.enforcement && candidate.enforcement.length > 0);
    assert.deepEqual(candidate.testIds, [TEST_ID]);
  }
  for (const candidate of interaction.forms) {
    assert.match(candidate.submitsTo, /^SERVER ACTION /);
    assert.ok(candidate.schema && candidate.schema.length > 0);
    assert.deepEqual(candidate.testIds, [TEST_ID]);
  }

  const source = readFileSync(screen.sourceFiles[0], "utf8");
  for (const assertion of expected.sourceAssertions) {
    assert.ok(
      source.includes(assertion),
      `${route}: source assertion is absent: ${assertion}`,
    );
  }

  actionInventoryCount += interaction.actions.length;
  structuredFormCount += interaction.forms.length;
}

assert.equal(actionInventoryCount, 6);
assert.equal(structuredFormCount, 3);

const authSource = readFileSync("src/lib/auth.ts", "utf8");
for (const assertion of [
  "export async function requireModeratorProfile()",
  "if (!isModeratorRole(current.profileRole))",
  "export async function requireAdminProfile()",
  "if (!isAdminRole(current.profileRole))",
]) {
  assert.ok(
    authSource.includes(assertion),
    `admin auth must preserve ${assertion}`,
  );
}

const mutationsSource = readFileSync("src/app/admin/mutations.ts", "utf8");
for (const assertion of [
  "export async function updatePageRulesAction(formData: FormData)",
  "const current = await requireAdminProfile();",
  "PLATFORM_FLAGS.cardGenerationEnabled",
  "export async function updateBespokeRequestAction(formData: FormData)",
  "status: z.enum(BESPOKE_STATUSES)",
  "notes: z.string().max(2000).optional()",
  "export async function updatePricingContentAction(formData: FormData)",
  "const plans: PricingPlan[] = PRICING_PLAN_IDS.map((id) => ({",
  "await setPricingContent(current, content);",
  'revalidatePath("/pricing");',
]) {
  assert.ok(
    mutationsSource.includes(assertion),
    `admin mutation boundary must preserve ${assertion}`,
  );
}

const bespokeSource = readFileSync("src/lib/bespoke-service.ts", "utf8");
for (const assertion of [
  "withDbRequestContext(current, (tx) =>",
  "notes.slice(0, 2000)",
  'action: "bespoke_request.update"',
]) {
  assert.ok(
    bespokeSource.includes(assertion),
    `bespoke service must preserve ${assertion}`,
  );
}

const platformSettingsSource = readFileSync(
  "src/lib/platform-settings.ts",
  "utf8",
);
for (const assertion of [
  "export async function setPlatformFlag(",
  "withDbRequestContext(current, (tx) =>",
  'action: "platform_setting.update"',
]) {
  assert.ok(
    platformSettingsSource.includes(assertion),
    `page-rule service must preserve ${assertion}`,
  );
}

const siteContentSource = readFileSync("src/lib/site-content.ts", "utf8");
for (const assertion of [
  'export const PRICING_PLAN_IDS: PricingPlanId[] = ["free", "pro", "pro_plus"]',
  "const normalized = normalize(content);",
  "withDbRequestContext(current, (tx) =>",
  'action: "site_content.pricing.update"',
]) {
  assert.ok(
    siteContentSource.includes(assertion),
    `site-content service must preserve ${assertion}`,
  );
}

console.log(
  "Admin-core interaction coverage passed: 4 action routes, 3 verified form routes, 1 exact zero-form exclusion, 6 action entries, 3 structured forms, shared onboarding retained",
);
