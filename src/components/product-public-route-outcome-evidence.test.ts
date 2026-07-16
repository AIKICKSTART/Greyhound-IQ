import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { discoverRouteHandlers } from "../../security/endpoints";
import {
  initialNetworkRecoveryState,
  transitionNetworkRecoveryState,
} from "../lib/network-recovery-state";
import { maintenanceModeResponse } from "../lib/maintenance-mode";
import {
  SCREEN_CONTRACT_BY_ROUTE,
  SCREEN_CONTRACTS,
} from "./demo-experience-registry";
import {
  PRODUCT_PUBLIC_ROUTE_OUTCOME_EVIDENCE_FILE,
  PRODUCT_PUBLIC_ROUTE_OUTCOME_EXPECTED_GAIN,
  PRODUCT_PUBLIC_ROUTE_OUTCOME_MASTER_EVIDENCE,
  PRODUCT_PUBLIC_ROUTE_OUTCOME_OPEN_GAPS,
  PRODUCT_PUBLIC_ROUTE_OUTCOME_OPEN_REQUIREMENT_IDS,
  PRODUCT_PUBLIC_ROUTE_OUTCOME_REQUIREMENT_IDS,
  PRODUCT_PUBLIC_ROUTE_OUTCOME_EVIDENCE_SCOPE,
  PRODUCT_PUBLIC_ROUTE_OUTCOME_TEST_FILE,
} from "./product-public-route-outcome-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCTION_SCREEN_COMMERCE_INTERACTION_EVIDENCE_TEST,
} from "./screen-contracts/production-screen-commerce-interactions";
import {
  PRODUCTION_SCREEN_INTERACTION_CONTRACTS,
} from "./screen-contracts/production-screen-coverage";
import {
  PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_EVIDENCE_TEST,
} from "./screen-contracts/production-screen-member-support-interactions";
import {
  PRODUCTION_SCREEN_PUBLIC_NAVIGATION_INTERACTION_EVIDENCE_TEST,
} from "./screen-contracts/production-screen-public-navigation-interactions";
import { PUBLIC_SCREEN_PERMISSION_CONTRACTS } from "./screen-contracts/screen-permission-evidence";

const repositoryRoot = path.resolve(".");
const completedIds = [...PRODUCT_PUBLIC_ROUTE_OUTCOME_REQUIREMENT_IDS];
const intentionallyOpenIds = [
  ...PRODUCT_PUBLIC_ROUTE_OUTCOME_OPEN_REQUIREMENT_IDS,
];
const preExistingCompletedIds = [
  "ROUTE.PUBLIC.home",
  "ROUTE.PUBLIC.about",
  "ROUTE.PUBLIC.contact",
  "ROUTE.PUBLIC.pricing",
  "ROUTE.PUBLIC.privacy",
  "ROUTE.PUBLIC.terms",
  "ROUTE.PUBLIC.responsible-use",
  "ROUTE.PUBLIC.auth-cancelled",
  "ROUTE.PUBLIC.auth-expired",
  "ROUTE.PUBLIC.auth-provider-failure",
  "ROUTE.PUBLIC.safe-return",
  "ROUTE.PUBLIC.not-found",
  "ROUTE.PUBLIC.no-open-redirect",
  "ROUTE.PUBLIC.auth-retry",
] as const;

assert.equal(completedIds.length, 8);
assert.equal(new Set(completedIds).size, completedIds.length);
assert.equal(intentionallyOpenIds.length, 5);
assert.equal(PRODUCT_PUBLIC_ROUTE_OUTCOME_EXPECTED_GAIN, 8);
assert.deepEqual(
  Object.keys(PRODUCT_PUBLIC_ROUTE_OUTCOME_MASTER_EVIDENCE),
  completedIds,
);

const publicRouteRequirementIds = PRODUCT_MASTER_REQUIREMENTS.filter(
  (requirement) => requirement.id.startsWith("ROUTE.PUBLIC."),
).map((requirement) => requirement.id);
assert.equal(publicRouteRequirementIds.length, 27);
assert.deepEqual(
  [
    ...preExistingCompletedIds,
    ...completedIds,
    ...intentionallyOpenIds,
  ].toSorted(),
  publicRouteRequirementIds.toSorted(),
  "Every public-route requirement must be explicitly completed elsewhere, completed by this batch, or preserved as a named gap",
);

const productRequirementIds = new Set(
  PRODUCT_MASTER_REQUIREMENTS.map((requirement) => requirement.id),
);
for (const requirementId of completedIds) {
  assert.ok(productRequirementIds.has(requirementId), requirementId);
  const evidence = PRODUCT_PUBLIC_ROUTE_OUTCOME_MASTER_EVIDENCE[requirementId];
  assert.equal(evidence.status, "tested", requirementId);
  assert.deepEqual(
    evidence.evidence.slice(0, 2),
    [
      PRODUCT_PUBLIC_ROUTE_OUTCOME_EVIDENCE_FILE,
      PRODUCT_PUBLIC_ROUTE_OUTCOME_TEST_FILE,
    ],
    requirementId,
  );
  assert.equal(
    new Set(evidence.evidence).size,
    evidence.evidence.length,
    `${requirementId} contains duplicate evidence paths`,
  );
  for (const evidencePath of evidence.evidence) {
    assert.equal(existsSync(evidencePath), true, evidencePath);
  }
}

for (const requirementId of intentionallyOpenIds) {
  assert.equal(
    requirementId in PRODUCT_PUBLIC_ROUTE_OUTCOME_MASTER_EVIDENCE,
    false,
    `${requirementId} must remain open`,
  );
  assert.ok(
    PRODUCT_PUBLIC_ROUTE_OUTCOME_OPEN_GAPS[requirementId].length > 120,
    `${requirementId} needs a precise residual-gap explanation`,
  );
}
assert.match(PRODUCT_PUBLIC_ROUTE_OUTCOME_OPEN_GAPS["ROUTE.PUBLIC.auth-loading"], /two-stage callback.*browser proof/i);
assert.match(PRODUCT_PUBLIC_ROUTE_OUTCOME_OPEN_GAPS["ROUTE.PUBLIC.auth-success"], /user-visible.*authorised live-provider/i);
assert.match(PRODUCT_PUBLIC_ROUTE_OUTCOME_OPEN_GAPS["ROUTE.PUBLIC.pricing-truth"], /no invariant.*prices.*entitlement/i);
assert.match(PRODUCT_PUBLIC_ROUTE_OUTCOME_OPEN_GAPS["ROUTE.PUBLIC.a11y"], /no exhaustive keyboard.*focus.*accessible-name.*44-pixel/i);
assert.match(PRODUCT_PUBLIC_ROUTE_OUTCOME_OPEN_GAPS["ROUTE.PUBLIC.responsive"], /browser evidence.*stale.*source.*cannot prove/i);

const evidenceSource = readFileSync(
  PRODUCT_PUBLIC_ROUTE_OUTCOME_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(PRODUCT_PUBLIC_ROUTE_OUTCOME_EVIDENCE_SCOPE, /deterministic source and focused-unit/i);
assert.match(PRODUCT_PUBLIC_ROUTE_OUTCOME_EVIDENCE_SCOPE, /does not prove live WorkOS or Stripe behavior/i);
assert.match(PRODUCT_PUBLIC_ROUTE_OUTCOME_EVIDENCE_SCOPE, /browser rendering/i);
assert.match(PRODUCT_PUBLIC_ROUTE_OUTCOME_EVIDENCE_SCOPE, /production readiness/i);

const handlerRows = discoverRouteHandlers(repositoryRoot)
  .filter(({ route }) => route === "/sign-in" || route === "/callback")
  .map(({ handler, method, route, sourceFile }) => ({
    handler,
    method,
    route,
    sourceFile,
  }))
  .toSorted((left, right) => left.route.localeCompare(right.route));
assert.deepEqual(handlerRows, [
  {
    handler: "GET",
    method: "GET",
    route: "/callback",
    sourceFile: "src/app/callback/route.ts",
  },
  {
    handler: "GET",
    method: "GET",
    route: "/sign-in",
    sourceFile: "src/app/sign-in/route.ts",
  },
]);

const signInSource = readFileSync("src/app/sign-in/route.ts", "utf8");
assert.match(signInSource, /export const GET = async/);
assert.match(signInSource, /resolveWorkosReturnTo/);
assert.match(signInSource, /resolveWorkosRedirectUri/);
assert.match(signInSource, /getSignInUrl/);
assert.match(signInSource, /isFullAccessDemo/);
assert.match(signInSource, /new URL\(returnTo, request\.url\)/);

const callbackSource = readFileSync("src/app/callback/route.ts", "utf8");
assert.match(callbackSource, /export const GET = handleAuth/);
assert.match(callbackSource, /baseURL: resolveWorkosBaseUrl\(\)/);
assert.match(callbackSource, /onSuccess: async \(\{ user \}\)/);
assert.match(callbackSource, /await syncAuthUser\(user\)/);
assert.match(callbackSource, /throw new Error\("auth\.local_acceptance_failed"\)/);
assert.match(callbackSource, /onError:/);
assert.match(callbackSource, /new URL\("\/auth\/error", baseUrl\)/);
assert.doesNotMatch(callbackSource, /searchParams\.get\("returnTo"\)/);

const authErrorScreen = SCREEN_CONTRACT_BY_ROUTE.get("/auth/error");
assert.ok(authErrorScreen);
assert.equal(authErrorScreen.authentication, "public");
assert.deepEqual(authErrorScreen.primaryActions, [
  "AUTH-ERROR.ACTION.SIGN-IN.RETRY",
  "AUTH-ERROR.ACTION.CONTACT.OPEN",
  "AUTH-ERROR.ACTION.HOME.OPEN",
]);
assert.deepEqual(authErrorScreen.supportedStates, [
  "PRODUCTION.STATE.AUTH-ERROR.RECOVERY",
  "PRODUCTION.STATE.AUTH-ERROR.REFERENCE",
]);
assert.equal(authErrorScreen.coverage.actions.status, "verified");
assert.equal(authErrorScreen.coverage.permissions.status, "tested");
assert.equal(authErrorScreen.coverage.states.status, "verified");
const authErrorSource = readFileSync("src/app/auth/error/page.tsx", "utf8");
assert.match(authErrorSource, /parseAuthCallbackFailureReason/);
assert.match(authErrorSource, /parseAuthCallbackReference/);
assert.match(authErrorSource, /AUTH_CALLBACK_RECOVERY_COPY/);
assert.match(authErrorSource, /href="\/sign-in\?returnTo=%2Ffeed"/);
assert.match(authErrorSource, /href="\/contact"/);
assert.match(authErrorSource, /href="\/"/);

assert.equal(initialNetworkRecoveryState(true), "online");
assert.equal(initialNetworkRecoveryState(false), "offline");
assert.equal(transitionNetworkRecoveryState("online", false), "offline");
assert.equal(transitionNetworkRecoveryState("offline", true), "restored");
assert.equal(transitionNetworkRecoveryState("restored", true), "restored");
const layoutSource = readFileSync("src/app/layout.tsx", "utf8");
const networkBannerSource = readFileSync(
  "src/components/network-recovery-banner.tsx",
  "utf8",
);
assert.match(layoutSource, /<NetworkRecoveryBanner \/>/);
assert.match(networkBannerSource, /addEventListener\("offline", sync\)/);
assert.match(networkBannerSource, /addEventListener\("online", sync\)/);
assert.match(networkBannerSource, /Previously loaded information may be stale/);
assert.match(networkBannerSource, /Refresh live data/);
assert.match(networkBannerSource, /Check connection/);

const legalRoutes = ["/privacy", "/terms", "/responsible-use"] as const;
for (const route of legalRoutes) {
  const permissionContract = PUBLIC_SCREEN_PERMISSION_CONTRACTS.find(
    (contract) => contract.route === route,
  );
  assert.ok(permissionContract, route);
  assert.ok(
    permissionContract.permissions.some(
      (permission) =>
        permission.actor === "Signed-out visitor viewing the page" &&
        permission.decision === "allow",
    ),
    route,
  );
  const screen = SCREEN_CONTRACT_BY_ROUTE.get(route);
  assert.ok(screen, route);
  assert.equal(screen.authentication, "public", route);
  assert.equal(screen.coverage.permissions.status, "tested", route);
  assert.equal(existsSync(permissionContract.sourcePath), true, route);
  const source = readFileSync(permissionContract.sourcePath, "utf8");
  assert.doesNotMatch(source, /\brequireCurrentUser\b|\bredirect\s*\(/, route);
}

const expectedPublicActionCounts = new Map<string, number>([
  ["/", 6],
  ["/about", 1],
  ["/auth/error", 3],
  ["/contact", 2],
  ["/pricing", 4],
  ["/privacy", 4],
  ["/responsible-use", 5],
  ["/terms", 1],
]);
const canonicalPublicScreens = SCREEN_CONTRACTS.filter(
  (screen) => screen.productionEnabled && screen.authentication === "public",
);
assert.deepEqual(
  canonicalPublicScreens.map((screen) => screen.route),
  [...expectedPublicActionCounts.keys()],
);
const interactionTestPathById = new Map<string, string>([
  [
    PRODUCTION_SCREEN_PUBLIC_NAVIGATION_INTERACTION_EVIDENCE_TEST.id,
    PRODUCTION_SCREEN_PUBLIC_NAVIGATION_INTERACTION_EVIDENCE_TEST.path,
  ],
  [
    PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_EVIDENCE_TEST.id,
    PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_EVIDENCE_TEST.path,
  ],
  [
    PRODUCTION_SCREEN_COMMERCE_INTERACTION_EVIDENCE_TEST.id,
    PRODUCTION_SCREEN_COMMERCE_INTERACTION_EVIDENCE_TEST.path,
  ],
]);
let publicActionCount = 0;
for (const screen of canonicalPublicScreens) {
  const contract =
    PRODUCTION_SCREEN_INTERACTION_CONTRACTS[
      screen.route as keyof typeof PRODUCTION_SCREEN_INTERACTION_CONTRACTS
    ];
  assert.ok(contract, screen.route);
  assert.equal(
    contract.actions.length,
    expectedPublicActionCounts.get(screen.route),
    screen.route,
  );
  assert.deepEqual(
    screen.primaryActions,
    contract.actions.map((action) => action.id),
    screen.route,
  );
  for (const action of contract.actions) {
    publicActionCount += 1;
    assert.ok(action.result.trim(), action.id);
    assert.equal(typeof action.enforcement, "string", action.id);
    assert.ok(action.enforcement?.trim(), action.id);
    assert.equal(action.testIds.length, 1, action.id);
    const testPath = interactionTestPathById.get(action.testIds[0]);
    assert.ok(testPath, action.id);
    assert.equal(existsSync(testPath), true, action.id);
    assert.match(
      readFileSync(testPath, "utf8"),
      new RegExp(`screen-evidence-test-id: ${action.testIds[0]}`),
      action.id,
    );
  }
}
assert.equal(publicActionCount, 26);

const pricingSource = readFileSync("src/app/pricing/page.tsx", "utf8");
const stripeWebhookSource = readFileSync(
  "src/lib/billing/stripe-webhooks.ts",
  "utf8",
);
assert.match(pricingSource, /We are verifying the signed Stripe webhook/);
assert.match(pricingSource, /tier only changes\s+after that trusted confirmation/);
assert.match(pricingSource, /const checkout = singleQueryValue\(query\.checkout\)/);
assert.doesNotMatch(
  pricingSource,
  /\bsubscriptionTier\b|\bdb\.user\.update\b|\bprisma\b/,
  "The public return query must not mutate billing state",
);
assert.match(stripeWebhookSource, /webhooks\.constructEvent/);
assert.match(stripeWebhookSource, /case "invoice\.paid"/);
assert.match(stripeWebhookSource, /subscriptionTier: grant\.plan/);

async function verifyMaintenanceResponse() {
  const htmlResponse = maintenanceModeResponse(
    new Request("https://greyhoundsiq.com.au/feed", {
      headers: { accept: "text/html", "sec-fetch-dest": "document" },
    }),
  );
  assert.equal(htmlResponse.status, 503);
  assert.equal(htmlResponse.headers.get("cache-control"), "no-store");
  assert.equal(htmlResponse.headers.get("retry-after"), "60");
  assert.equal(htmlResponse.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.match(await htmlResponse.text(), /GreyhoundIQ will be back shortly/);

  const apiResponse = maintenanceModeResponse(
    new Request("https://greyhoundsiq.com.au/api/dogs/search", {
      method: "POST",
      headers: { accept: "application/json" },
    }),
  );
  assert.equal(apiResponse.status, 503);
  assert.deepEqual(await apiResponse.json(), {
    error: {
      code: "service.maintenance",
      message: "GreyhoundIQ is temporarily unavailable for maintenance",
    },
  });
}

void verifyMaintenanceResponse()
  .then(() => {
    console.log(
      "Public route outcome evidence passed: 8 truthful gates; 5 named gaps remain open.",
    );
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
