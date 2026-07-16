import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

import { isAdminRole } from "@/lib/auth-roles";
import { resolveDesignLabAccessDecision } from "@/lib/design-lab-access-policy";

import {
  DESIGN_LAB_ACCESS_SCENARIOS,
  DESIGN_LAB_SCREEN_PERMISSION_CONTRACTS,
  PUBLIC_SCREEN_PERMISSION_CONTRACTS,
  PUBLIC_SIGNED_OUT_MUTATION_DENIAL_CONTRACTS,
  SCREEN_PERMISSION_EVIDENCE_TEST,
} from "./screen-permission-evidence";

// screen-evidence-test-id: SCREEN-PERMISSION-EVIDENCE

const EXPECTED_PUBLIC_ROUTES = [
  "/",
  "/about",
  "/auth/error",
  "/contact",
  "/pricing",
  "/privacy",
  "/responsible-use",
  "/terms",
  "/breeding",
  "/dogs",
  "/dogs/[id]",
  "/races",
  "/races/[id]",
  "/meetings/[id]",
  "/results",
  "/statistics",
  "/tracks",
  "/tracks/[id]",
  "/discover",
  "/feed",
  "/forum",
  "/forum/[slug]",
  "/forum/threads/[id]",
  "/groups",
  "/groups/[slug]",
  "/groups/threads/[id]",
  "/p/[handle]",
  "/listings",
  "/listings/[id]",
  "/listings/new",
  "/marketplace",
  "/marketplace/[id]",
  "/marketplace/new",
] as const;
const EXPECTED_DESIGN_LAB_ROUTES = [
  "/design-lab",
  "/design-lab/demo-experience",
  "/design-lab/dock-skins",
  "/design-lab/role-blueprints",
  "/feed/device-preview",
  "/marketplace/design-lab",
] as const;
const REQUIRED_AUTH_GUARD =
  /\b(?:requireCurrentUserProfile|requireModeratorProfile|requireAdminProfile|requireDesignLabReviewer)\s*\(/;

assert.equal(
  SCREEN_PERMISSION_EVIDENCE_TEST.path,
  "src/components/screen-contracts/screen-permission-evidence.test.ts",
);
assert.deepEqual(
  PUBLIC_SCREEN_PERMISSION_CONTRACTS.map(({ route }) => route),
  EXPECTED_PUBLIC_ROUTES,
  "The permission batch must remain the exact 33-route public-browsing family.",
);
assert.equal(
  new Set(PUBLIC_SCREEN_PERMISSION_CONTRACTS.map(({ route }) => route)).size,
  EXPECTED_PUBLIC_ROUTES.length,
);

for (const contract of PUBLIC_SCREEN_PERMISSION_CONTRACTS) {
  assert.equal(existsSync(contract.sourcePath), true, `${contract.sourcePath} is missing.`);
  const source = readFileSync(contract.sourcePath, "utf8");
  assert.match(source, /export default/, `${contract.route} must still export a page.`);
  assert.doesNotMatch(
    source,
    REQUIRED_AUTH_GUARD,
    `${contract.route} must not gain a required-auth page guard while declared public.`,
  );
  assert.doesNotMatch(
    source,
    /\bredirect\(\s*["']\/sign-in/,
    `${contract.route} must not redirect its signed-out view to sign-in.`,
  );

  const viewPermission = contract.permissions.find(
    ({ actor }) => actor === "Signed-out visitor viewing the page",
  );
  assert.ok(viewPermission, `${contract.route} needs its signed-out view decision.`);
  assert.equal(viewPermission.decision, "allow");
  assert.deepEqual(viewPermission.testIds, [SCREEN_PERMISSION_EVIDENCE_TEST.id]);
}

const rootLayout = functionSource("src/app/layout.tsx", "RootLayout");
assert.doesNotMatch(rootLayout, REQUIRED_AUTH_GUARD);
assertOrdered(
  rootLayout,
  [
    "await withAuth()",
    "await getCurrentUser()",
    "if (user?.dbUserId && user.profileId)",
    "listConversationsForProfile(current)",
  ],
  "RootLayout must keep private conversation reads behind optional identity.",
);

const getCurrentUser = functionSource("src/lib/auth.ts", "getCurrentUser");
assertOrdered(
  getCurrentUser,
  ["const { user } = await withAuth();", "if (!user) return null;", "safeQuery("],
  "getCurrentUser must return null for a missing session before local user reads.",
);

const contactPage = readFileSync("src/app/contact/page.tsx", "utf8");
assert.match(
  contactPage,
  /\{user \? \([\s\S]*<form action=\{createSupportTicket\}[\s\S]*\) : \([\s\S]*href="\/sign-in"/,
  "The public contact view must show the ticket form only to a signed-in user and a sign-in path otherwise.",
);
const pricingPage = readFileSync("src/app/pricing/page.tsx", "utf8");
assert.match(
  pricingPage,
  /<form action="\/api\/billing\/checkout" method="post">/,
  "The public pricing view must submit checkout through the authenticated server boundary.",
);

assert.deepEqual(
  PUBLIC_SIGNED_OUT_MUTATION_DENIAL_CONTRACTS.map(({ route }) => route),
  ["/contact", "/pricing"],
);
for (const contract of PUBLIC_SIGNED_OUT_MUTATION_DENIAL_CONTRACTS) {
  const screenContract = PUBLIC_SCREEN_PERMISSION_CONTRACTS.find(
    ({ route }) => route === contract.route,
  );
  assert.ok(screenContract, `${contract.route} must be one of the public screens.`);
  const denialPermission = screenContract.permissions.find(
    ({ actor }) => actor === contract.permissionActor,
  );
  assert.ok(denialPermission, `${contract.route} needs its signed-out mutation denial.`);
  assert.equal(denialPermission.decision, "deny");
  assert.deepEqual(denialPermission.testIds, [SCREEN_PERMISSION_EVIDENCE_TEST.id]);

  const source = functionSource(contract.sourcePath, contract.exportedFunction);
  assertOrdered(
    source,
    [contract.authenticationCall, ...contract.protectedEffects],
    `${contract.exportedFunction} must authenticate before protected effects.`,
  );

  if (contract.denialMode === "redirect-before-effects") {
    assertOrdered(
      source,
      [
        contract.authenticationCall,
        contract.denialSignal,
        contract.denialExit,
        contract.protectedEffects[0],
      ],
      "Checkout must return the signed-out redirect before rate limiting or Stripe calls.",
    );
  } else {
    assert.match(
      source,
      /^export async function createSupportTicket\(formData: FormData\) \{\s*const current = await requireCurrentUserProfile\(\);/,
      "The support action must authenticate as its first executable statement.",
    );
  }
}

assert.deepEqual(
  DESIGN_LAB_SCREEN_PERMISSION_CONTRACTS.map(({ route }) => route),
  EXPECTED_DESIGN_LAB_ROUTES,
  "The permission batch must remain the exact six-route Design Lab family.",
);
assert.equal(
  new Set(DESIGN_LAB_SCREEN_PERMISSION_CONTRACTS.map(({ route }) => route)).size,
  EXPECTED_DESIGN_LAB_ROUTES.length,
);
for (const contract of DESIGN_LAB_SCREEN_PERMISSION_CONTRACTS) {
  const source = readFileSync(contract.sourcePath, "utf8");
  assert.match(source, /robots: \{ index: false, follow: false \}/);
  assert.match(source, /await requireDesignLabReviewer\(\)/);
  assert.deepEqual(
    contract.permissions.map(({ decision }) => decision),
    ["allow", "deny", "allow", "allow", "deny"],
  );
  for (const permission of contract.permissions) {
    assert.deepEqual(permission.testIds, [SCREEN_PERMISSION_EVIDENCE_TEST.id]);
  }
}

const accessBoundary = functionSource(
  "src/lib/design-lab-access.ts",
  "requireDesignLabReviewer",
);
assert.match(accessBoundary, /if \(decision === "deny"\) notFound\(\)/);
assert.match(
  accessBoundary,
  /if \(decision === "require-administrator"\)[\s\S]*await requireAdminProfile\(\)[\s\S]*catch[\s\S]*notFound\(\)/,
);

const requireAdminProfile = functionSource("src/lib/auth.ts", "requireAdminProfile");
assertOrdered(
  requireAdminProfile,
  [
    "requireCurrentUserProfile()",
    "if (!isAdminRole(current.profileRole))",
    'throw new Error("auth.forbidden")',
  ],
  "The Design Lab administrator boundary must use the exact admin-role predicate.",
);

assert.deepEqual(
  DESIGN_LAB_ACCESS_SCENARIOS.map(({ id }) => id),
  [
    "non-production-signed-out",
    "production-flag-missing-admin",
    "production-flag-not-exact-admin",
    "production-isolated-demo-flag-missing",
    "production-isolated-demo-flag-enabled",
    "production-admin-flag-enabled",
    "production-moderator-flag-enabled",
    "production-member-flag-enabled",
    "production-reviewer-label-flag-enabled",
    "production-signed-out-flag-enabled",
  ],
);
for (const scenario of DESIGN_LAB_ACCESS_SCENARIOS) {
  const policyDecision = resolveDesignLabAccessDecision({
    nodeEnv: scenario.nodeEnv,
    enabled: scenario.enabled,
    isolatedDemo: scenario.isolatedDemo,
  });
  assert.equal(policyDecision, scenario.policyDecision, scenario.id);

  const finalDecision =
    policyDecision === "deny"
      ? "deny"
      : policyDecision === "require-administrator"
        ? isAdminRole(scenario.actorRole)
          ? "allow"
          : "deny"
        : "allow";
  assert.equal(finalDecision, scenario.finalDecision, scenario.id);
}

console.log(
  "screen permission source evidence passed (33 public views, 2 signed-out mutation denials, 6 Design Lab route gates); no deployed-role or browser-session claim",
);

function functionSource(sourcePath: string, name: string) {
  const source = readFileSync(sourcePath, "utf8");
  const sourceFile = ts.createSourceFile(
    sourcePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    sourcePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const declaration = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  assert.ok(declaration, `${sourcePath} must export ${name}.`);
  return declaration.getText(sourceFile);
}

function assertOrdered(source: string, needles: readonly string[], message: string) {
  let previousIndex = -1;
  for (const needle of needles) {
    const index = source.indexOf(needle);
    assert.ok(index >= 0, `${message} Missing: ${needle}`);
    assert.ok(index > previousIndex, `${message} Out of order: ${needle}`);
    previousIndex = index;
  }
}
