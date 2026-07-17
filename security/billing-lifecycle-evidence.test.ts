import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  BILLING_LIFECYCLE_MASTER_EVIDENCE,
  BILLING_LIFECYCLE_SOURCE_TRACE,
  BILLING_LIFECYCLE_UNRESOLVED_CONTROL_IDS,
  STRIPE_TEST_MODE_BILLING_ACCEPTANCE,
} from "./billing-lifecycle-evidence";

const lifecycleRequirementIds = SECURITY_MASTER_REQUIREMENTS.filter(
  (requirement) => requirement.section === "billing-lifecycle",
).map((requirement) => requirement.id);
const tracedRequirementIds = BILLING_LIFECYCLE_SOURCE_TRACE.map(
  (step) => step.requirementId,
);

assert.equal(tracedRequirementIds.length, 15);
assert.equal(new Set(tracedRequirementIds).size, tracedRequirementIds.length);
assert.deepEqual(
  tracedRequirementIds.toSorted(),
  lifecycleRequirementIds.toSorted(),
);
assert.deepEqual(
  Object.keys(BILLING_LIFECYCLE_MASTER_EVIDENCE).toSorted(),
  lifecycleRequirementIds.toSorted(),
);

const evidenceRecords = Object.values(BILLING_LIFECYCLE_MASTER_EVIDENCE);
assert.equal(
  evidenceRecords.filter((record) => record.status === "verified").length,
  14,
);
assert.equal(
  evidenceRecords.filter(
    (record) => record.status === "not-applicable-with-justification",
  ).length,
  1,
);

for (const step of BILLING_LIFECYCLE_SOURCE_TRACE) {
  assert.ok(
    step.boundary.length > 80,
    `${step.requirementId}: boundary is vague`,
  );
  const record = BILLING_LIFECYCLE_MASTER_EVIDENCE[step.requirementId];
  assert.ok(record, `${step.requirementId}: missing evidence record`);
  assert.deepEqual(record.evidence, step.evidence);
  for (const evidencePath of record.evidence) {
    assert.ok(
      existsSync(evidencePath),
      `${step.requirementId}: missing ${evidencePath}`,
    );
  }
}

const cacheEvidence =
  BILLING_LIFECYCLE_MASTER_EVIDENCE["security.billing-lifecycle.cache"];
assert.equal(cacheEvidence.status, "not-applicable-with-justification");
assert.ok("notApplicableJustification" in cacheEvidence);
assert.match(cacheEvidence.notApplicableJustification, /force-dynamic/);
assert.match(
  cacheEvidence.notApplicableJustification,
  /no billing cache to invalidate/,
);

for (const requirementId of BILLING_LIFECYCLE_UNRESOLVED_CONTROL_IDS) {
  assert.equal(
    Object.hasOwn(BILLING_LIFECYCLE_MASTER_EVIDENCE, requirementId),
    false,
    `${requirementId}: source trace must not promote an unresolved control`,
  );
}
assert.equal(STRIPE_TEST_MODE_BILLING_ACCEPTANCE.status, "open");
assert.equal(STRIPE_TEST_MODE_BILLING_ACCEPTANCE.requiredEvidence.length, 3);

const pricingPage = read("src/app/pricing/page.tsx");
const accountPage = read("src/app/account/page.tsx");
assert.match(
  pricingPage,
  /<form action="\/api\/billing\/checkout" method="post">/,
);
assert.match(
  pricingPage,
  /<input name="plan" type="hidden" value=\{plan\} \/>/,
);
assert.match(
  pricingPage,
  /<input name="interval" type="hidden" value=\{interval\} \/>/,
);
assert.match(
  accountPage,
  /<form action="\/api\/billing\/checkout" method="post"/,
);
assert.match(accountPage, /<input name="plan" type="hidden" value="pro" \/>/);

const checkoutRoute = read("src/app/api/billing/checkout/route.ts");
const checkoutValidation = read("src/lib/billing/checkout-validation.ts");
assert.match(
  checkoutValidation,
  /billingCheckoutRequestSchema = z\.object\(\{[\s\S]*interval: z\.enum\(\["monthly", "yearly"\]\)[\s\S]*plan: z\.literal\("pro"\)/,
);
assert.match(checkoutRoute, /const checkoutRequestSchema = billingCheckoutRequestSchema/);
assert.match(checkoutRoute, /assertTrustedOrigin\(request, env\)/);
assert.match(checkoutRoute, /current = await requireCurrentUserProfile\(\)/);
assert.match(checkoutRoute, /\{ failClosed: true \}/);
assert.match(checkoutRoute, /await createStripeCheckoutSession\(\{/);
assert.match(checkoutRoute, /NextResponse\.redirect\(session\.url, 303\)/);
assertInOrder(checkoutRoute, [
  "checkoutRequestSchema.parse",
  "requireCurrentUserProfile()",
  "createStripeCheckoutSession({",
  "NextResponse.redirect(session.url, 303)",
]);

const stripeService = read("src/lib/billing/stripe-service.ts");
assert.match(stripeService, /import "server-only"/);
assert.match(stripeService, /stripe\.checkout\.sessions\.create\(/);
assert.match(
  stripeService,
  /line_items: \[\{ price: env\.prices\[plan\]\[interval\], quantity: 1 \}\]/,
);
assert.match(stripeService, /client_reference_id: current\.dbUserId/);
assert.match(
  stripeService,
  /successUrl = new URL\("\/account\/billing", env\.appUrl\)/,
);
assert.doesNotMatch(stripeService, /payment_method_types/);

const webhookRoute = read("src/app/api/webhooks/stripe/route.ts");
assert.match(
  webhookRoute,
  /Buffer\.from\(await readBoundedWebhookBody\(request\)\)/,
);
assert.match(webhookRoute, /await ingestStripeWebhook\(\{/);

const stripeWebhook = read("src/lib/billing/stripe-webhooks.ts");
assert.match(
  stripeWebhook,
  /webhooks\.constructEvent\([\s\S]*rawBody,[\s\S]*signature,[\s\S]*env\.webhookSecret/,
);
assertInOrder(stripeWebhook, [
  "const stripeEvent = verifyStripeWebhook(headers, rawBody)",
  'provider: "stripe"',
  "withDbSystemContext(async (tx)",
  "reduceStripeWebhook(tx, stored.id, stripeEvent)",
]);
assert.match(
  stripeWebhook,
  /class StripeWebhookDuplicateDelivery extends Error/,
);
assert.match(stripeWebhook, /where: \{ lagoEventId: stripeEventId \}/);
assert.match(
  stripeWebhook,
  /where: \{ provider_payloadHash: \{ provider: "stripe", payloadHash \} \}/,
);
assert.match(stripeWebhook, /case "invoice\.paid"/);
assert.match(stripeWebhook, /invoice\.status !== "paid"/);
assert.match(stripeWebhook, /invoice\.amount_remaining !== 0/);
assert.match(stripeWebhook, /const plan = planForStripePriceId\(priceId\)/);
assert.match(stripeWebhook, /function planForStripePriceId\(priceId: string\)/);
assert.doesNotMatch(
  stripeWebhook.match(/function planForStripePriceId[\s\S]*?\n}/)?.[0] ?? "",
  /metadata/,
);
assert.match(stripeWebhook, /findUserIdForStripeBinding/);
assert.match(stripeWebhook, /subscriptionTier: grant\.plan/);
assert.match(stripeWebhook, /function stripeWebhookAuditPayload/);
assert.match(stripeWebhook, /processedAt: new Date\(\), status: "processed"/);

const dbContext = read("src/lib/db-context.ts");
assert.match(
  dbContext,
  /export async function withDbSystemContext[\s\S]*return prisma\.\$transaction\(/,
);

const auth = read("src/lib/auth.ts");
assert.match(
  auth,
  /dbUser = await safeQuery\(\(\) => syncAuthUser\(user\), dbUser\)/,
);
assert.match(auth, /tier: normalizeTier\(dbUser\?\.subscriptionTier\)/);

const entitlementService = read("src/lib/billing/entitlement-service.ts");
assert.match(
  entitlementService,
  /const fallback = DEFAULT_TIER_ENTITLEMENT_LIMITS\[current\.tier\]/,
);
assert.match(entitlementService, /tx\.entitlementSnapshot\.findFirst\(\{/);
assert.match(entitlementService, /if \(!snapshot\) return fallback/);

const billingPage = read("src/app/account/billing/page.tsx");
assert.match(billingPage, /export const dynamic = "force-dynamic"/);
assert.match(billingPage, /const user = await getCurrentUser\(\)/);
assert.match(
  billingPage,
  /The local plan only changes after the signed Stripe webhook is[\s\S]*verified/,
);
assert.match(billingPage, /getEntitlementLimitsForCurrentUser\(user\)/);
assert.match(billingPage, /withDbRequestContext\(dbContext/);
assert.match(billingPage, /tx\.invoiceRecord\.findMany\(\{/);
assert.match(billingPage, /take: 5/);

const billingRuntimeSource = [
  ...collectSourceFiles("src/app/account/billing"),
  ...collectSourceFiles("src/app/api/billing"),
  ...collectSourceFiles("src/lib/billing"),
]
  .map(read)
  .join("\n");
assert.doesNotMatch(
  billingRuntimeSource,
  /\b(?:unstable_cache|revalidatePath|revalidateTag|cacheLife|cacheTag)\s*\(|["']use cache["']/,
);

console.log(
  "billing lifecycle evidence passed: 14 source traces verified, cache justified N/A, four billing controls and live Stripe acceptance remain open",
);

function assertInOrder(source: string, needles: readonly string[]) {
  let previous = -1;
  for (const needle of needles) {
    const index = source.indexOf(needle);
    assert.ok(index >= 0, `missing ordered source marker: ${needle}`);
    assert.ok(index > previous, `source marker is out of order: ${needle}`);
    previous = index;
  }
}

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function read(path: string) {
  return readFileSync(path, "utf8");
}
