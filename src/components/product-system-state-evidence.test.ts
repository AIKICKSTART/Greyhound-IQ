import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_SYSTEM_STATE_EVIDENCE_FILE,
  PRODUCT_SYSTEM_STATE_MASTER_EVIDENCE,
  PRODUCT_SYSTEM_STATE_REQUIREMENT_IDS,
  PRODUCT_SYSTEM_STATE_TEST_FILE,
} from "./product-system-state-evidence";

const repositoryRoot = path.resolve(__dirname, "../..");
const expectedRequirementIds = [
  "SYSTEM.forbidden",
  "SYSTEM.auth-required",
  "SYSTEM.subscription-required",
  "SYSTEM.feature-unavailable",
  "SYSTEM.private",
  "SYSTEM.blocked",
  "SYSTEM.deleted",
  "SYSTEM.recoverable-error",
  "SYSTEM.auth-callback-failure",
  "SYSTEM.billing-loading",
  "SYSTEM.upload-failure",
] as const;
const unresolvedRequirementIds = [
  "SYSTEM.invitation-expired",
  "SYSTEM.invitation-invalid",
  "SYSTEM.maintenance",
  "SYSTEM.offline",
  "SYSTEM.unsupported-browser",
  "SYSTEM.auth-callback-loading",
  "SYSTEM.billing-failure",
  "SYSTEM.rate-limit",
  "SYSTEM.design-lab",
  "SYSTEM.automated-tests",
  "SYSTEM.specific-recovery",
] as const;

function source(relativePath: string) {
  return readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

function compact(value: string) {
  return value.replace(/\s+/g, " ");
}

function assertIncludes(value: string, expected: string, message: string) {
  assert.ok(value.includes(expected), message);
}

assert.deepEqual(
  [...PRODUCT_SYSTEM_STATE_REQUIREMENT_IDS].sort(),
  [...expectedRequirementIds].sort(),
  "The exported system-state ID list must remain the reviewed eleven-state batch",
);
assert.deepEqual(
  Object.keys(PRODUCT_SYSTEM_STATE_MASTER_EVIDENCE).sort(),
  [...expectedRequirementIds].sort(),
  "System-state evidence must close exactly the reviewed eleven requirements",
);

const masterRequirementIds = new Set(
  PRODUCT_MASTER_REQUIREMENTS.map((requirement) => requirement.id),
);
for (const requirementId of expectedRequirementIds) {
  assert.ok(
    masterRequirementIds.has(requirementId),
    `${requirementId} must be a durable product master requirement`,
  );
  const record = PRODUCT_SYSTEM_STATE_MASTER_EVIDENCE[requirementId];
  assert.equal(record.status, "tested", `${requirementId} must be tested`);
  assert.ok(
    record.evidence.includes(PRODUCT_SYSTEM_STATE_EVIDENCE_FILE),
    `${requirementId} must cite its evidence registry`,
  );
  assert.ok(
    record.evidence.includes(PRODUCT_SYSTEM_STATE_TEST_FILE),
    `${requirementId} must cite this executable contract`,
  );
  for (const evidencePath of record.evidence) {
    assert.ok(existsSync(path.join(repositoryRoot, evidencePath)), evidencePath);
  }
}
for (const requirementId of unresolvedRequirementIds) {
  assert.equal(
    PRODUCT_SYSTEM_STATE_MASTER_EVIDENCE[requirementId],
    undefined,
    `${requirementId} is a genuine gap and must not be evidence-closed`,
  );
}

const messagesPage = source("src/app/messages/page.tsx");
const messageThread = source("src/app/messages/[id]/page.tsx");
const conversationService = source("src/lib/conversation-service.ts");
assertIncludes(messagesPage, "Sign in to open Pulse", "Pulse needs a signed-out boundary");
assertIncludes(
  messageThread,
  "if (!user?.profileId || !user.dbUserId) return <SignedOutThread />;",
  "A private thread must stop before lookup when authentication is absent",
);

const forbiddenPage = source("src/app/forbidden.tsx");
const adminLayout = source("src/app/admin/layout.tsx");
const nextConfig = source("next.config.ts");
assertIncludes(nextConfig, "authInterrupts: true", "Forbidden interrupts must be enabled");
assertIncludes(adminLayout, 'err.message === "auth.forbidden"', "Admin denial must remain distinct");
assertIncludes(adminLayout, "forbidden();", "Admin denial must invoke the 403 boundary");
assertIncludes(forbiddenPage, "403 · Permission required", "The boundary needs an explicit status");
assertIncludes(forbiddenPage, "Access denied.", "The boundary needs a clear outcome");
assertIncludes(forbiddenPage, 'href="/account"', "The boundary needs account recovery");
assertIncludes(forbiddenPage, 'href="/"', "The boundary needs a public recovery path");
assertIncludes(messageThread, "Private Pulse conversation", "Private content must be labelled");
assertIncludes(
  conversationService,
  "{ participantAId: current.profileId }",
  "Conversation lookup must include participant A ownership",
);
assertIncludes(
  conversationService,
  "{ participantBId: current.profileId }",
  "Conversation lookup must include participant B ownership",
);
assertIncludes(
  messageThread,
  "You blocked this conversation. Unblock before sending new messages.",
  "A user-created block needs its specific recovery action",
);
assertIncludes(
  messageThread,
  "This conversation is blocked by the other participant.",
  "A remote block must not offer a false recovery action",
);
assertIncludes(messageThread, "Unblock", "A local block needs an unblock control");
assertIncludes(
  messageThread,
  "disabled={Boolean(conversation.blockedAt)}",
  "The blocked conversation composer must be disabled",
);

const listingCreate = compact(source("src/app/listings/new/page.tsx"));
const listingDetail = compact(source("src/app/listings/[id]/page.tsx"));
assertIncludes(listingCreate, "Upgrade to create marketplace items", "Listing creation needs an upgrade state");
assertIncludes(listingCreate, "Listing creation is included with Pro.", "The upgrade state must explain entitlement");
assertIncludes(listingCreate, 'href="/pricing"', "The creation gate must link to pricing");
assertIncludes(listingDetail, "Upgrade to message seller", "Seller contact needs an upgrade state");
assertIncludes(listingDetail, "Seller enquiries are included with Pro.", "The seller gate must explain entitlement");

const proGate = source("src/components/pro-gate.tsx");
const pricingPage = source("src/app/pricing/page.tsx");
const siteContent = source("src/lib/site-content.ts");
assertIncludes(proGate, 'const isUnavailable = minTier === "pro_plus";', "Pro+ must resolve to unavailable state");
assertIncludes(proGate, "is not currently offered.", "Unavailable features need explanatory copy");
assertIncludes(proGate, "See available plans", "Unavailable features need a clear action label");
assertIncludes(
  pricingPage,
  'plan.id === "pro_plus"',
  "Pricing must distinguish the unavailable Pro+ plan",
);
assertIncludes(
  pricingPage,
  "disabled",
  "The unavailable Pro+ plan must not submit a checkout",
);
assertIncludes(
  siteContent,
  'description: "Not currently offered."',
  "Unavailable pricing needs explanatory copy",
);
assertIncludes(
  siteContent,
  'cta: "Unavailable"',
  "Unavailable pricing needs a clear action label",
);

const accountService = source("src/lib/account-service.ts");
assertIncludes(
  accountService,
  'const DELETED_MESSAGE_BODY = "This message was removed after account deletion.";',
  "Account deletion needs durable replacement copy",
);
assertIncludes(accountService, "body: DELETED_MESSAGE_BODY", "Deletion must persist the replacement body");
assertIncludes(messageThread, "{message.body}", "The thread must render the persisted deletion marker");

for (const errorBoundaryPath of [
  "src/app/error.tsx",
  "src/app/races/error.tsx",
  "src/app/messages/error.tsx",
]) {
  const errorBoundary = source(errorBoundaryPath);
  assertIncludes(errorBoundary, '"use client";', `${errorBoundaryPath} must be interactive`);
  assertIncludes(errorBoundary, "onClick={reset}", `${errorBoundaryPath} must call the framework reset`);
  assertIncludes(errorBoundary, "Try again", `${errorBoundaryPath} must explain recovery`);
}

const authCallback = source("src/app/callback/route.ts");
const authRecovery = source("src/app/auth/error/page.tsx");
assertIncludes(authCallback, "classifyAuthCallbackFailure", "Callback failures must be classified");
assertIncludes(authCallback, "crypto.randomUUID()", "Callback failures need a correlation reference");
assertIncludes(authCallback, 'new URL("/auth/error", baseUrl)', "Callback failures must reach recovery UI");
assertIncludes(authCallback, 'searchParams.set("reason", reason)', "Recovery UI needs a safe reason code");
assertIncludes(authRecovery, "AUTH_CALLBACK_RECOVERY_COPY[reason]", "Recovery copy must match the failure class");
assertIncludes(authRecovery, "Try sign-in again", "Authentication recovery needs a retry action");
assertIncludes(authRecovery, "Contact support", "Authentication recovery needs support escalation");

const stripeService = source("src/lib/billing/stripe-service.ts");
const billingPage = compact(source("src/app/account/billing/page.tsx"));
assertIncludes(stripeService, 'new URL("/account/billing", env.appUrl)', "Stripe must return to billing");
assertIncludes(stripeService, 'successUrl.searchParams.set("checkout", "success")', "Stripe success needs an explicit state");
assertIncludes(billingPage, 'if (checkout === "success")', "Billing must render the success return state");
assertIncludes(
  billingPage,
  "The local plan only changes after the signed Stripe webhook is verified, which may take a moment.",
  "Billing must explain asynchronous webhook settlement",
);
assertIncludes(billingPage, "Refresh billing status", "Billing settlement needs a refresh action");

const mediaAttachments = source("src/components/media-attachment-fields.tsx");
assertIncludes(mediaAttachments, 'item.step === "error"', "Failed uploads need a distinct visual state");
assertIncludes(
  mediaAttachments,
  'runUpload(item.key, item.failedStep ?? "signing")',
  "Retry must resume the failed upload stage",
);
assertIncludes(mediaAttachments, "Retry", "Failed uploads need a retry control");
assertIncludes(mediaAttachments, "removeItem(item.key)", "Failed uploads need a remove control");
assertIncludes(
  mediaAttachments,
  "Retry or remove the failed upload before saving.",
  "The form must explain why a failed upload blocks submission",
);
assertIncludes(
  mediaAttachments,
  "setFormUploadBlocked(form, owner, true)",
  "The form must remain blocked until upload recovery",
);

console.log("Product system-state evidence contract passed (11 verified closures, 11 gaps preserved).");
