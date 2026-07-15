import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import { billingCheckoutRequestSchema } from "../src/lib/billing/checkout-validation";
import {
  PCI_SCOPE_EVIDENCE_SCOPE,
  PCI_SCOPE_MASTER_EVIDENCE,
} from "./pci-scope-evidence";

const verifiedRequirementIds = [
  "security.billing-control.no-card-logs",
  "security.billing-control.card-provider",
] as const;
for (const requirementId of verifiedRequirementIds) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    ({ id }) => id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    PCI_SCOPE_MASTER_EVIDENCE[requirementId],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
}
const openPciScopeRequirement = MASTER_AUDIT_REQUIREMENTS.find(
  ({ id }) => id === "security.standards-baseline.pci-scope",
);
assert.ok(openPciScopeRequirement, "missing PCI scope requirement");
assert.equal(isMasterRequirementComplete(openPciScopeRequirement), false);
assert.equal(
  SECURITY_MASTER_EVIDENCE["security.standards-baseline.pci-scope"],
  undefined,
);
assert.equal(
  openPciScopeRequirement.requirement,
  "Apply PCI DSS 4.0.1 only where GreyhoundIQ enters payment-card-data scope.",
);

const checkoutRoute = readFileSync("src/app/api/billing/checkout/route.ts", "utf8");
const checkoutValidation = readFileSync(
  "src/lib/billing/checkout-validation.ts",
  "utf8",
);
assert.match(
  checkoutValidation,
  /billingCheckoutRequestSchema = z\.object\(\{[\s\S]*interval: z\.enum\(\["monthly", "yearly"\]\)\.default\("monthly"\)[\s\S]*plan: z\.literal\("pro"\)/,
);
assert.match(
  checkoutRoute,
  /import \{ billingCheckoutRequestSchema \} from "@\/lib\/billing\/checkout-validation";/,
);
assert.match(
  checkoutRoute,
  /const checkoutRequestSchema = billingCheckoutRequestSchema;/,
);
assert.match(
  checkoutRoute,
  /checkoutRequestSchema\.parse\(\s*await readBoundedJsonOrFormRequest\(request\),?\s*\)/,
);
assert.doesNotMatch(checkoutRoute, /request\.json\s*\(/);
assert.match(checkoutRoute, /\{ failClosed: true \}/);

assert.deepEqual(
  billingCheckoutRequestSchema.parse({ interval: "monthly", plan: "pro" }),
  { interval: "monthly", plan: "pro" },
);
for (const hostileInput of [
  {},
  { interval: "weekly", plan: "pro" },
  { interval: "monthly", plan: "pro_plus" },
  { interval: "monthly", plan: { $ne: "free" } },
]) {
  assert.equal(
    billingCheckoutRequestSchema.safeParse(hostileInput).success,
    false,
  );
}
assert.deepEqual(
  billingCheckoutRequestSchema.parse({
    cardNumber: "not-collected",
    cvc: "not-collected",
    expiryMonth: "not-collected",
    interval: "yearly",
    plan: "pro",
  }),
  { interval: "yearly", plan: "pro" },
);
assert.ok(!/card_?number|\bcvc\b|expir(?:y|ation)/i.test(checkoutRoute));
const bespokeRoute = readFileSync(
  "src/app/api/billing/bespoke/checkout/route.ts",
  "utf8",
);
assert.ok(!/card_?number|\bcvc\b|expir(?:y|ation)/i.test(bespokeRoute));
const portalRoute = readFileSync("src/app/api/billing/portal/route.ts", "utf8");
assert.ok(!/card_?number|\bcvc\b|expir(?:y|ation)/i.test(portalRoute));

const service = readFileSync("src/lib/billing/stripe-service.ts", "utf8");
assert.match(service, /stripe\.checkout\.sessions\.create/);
assert.match(service, /line_items: \[\{ price: env\.prices\[plan\]\[interval\]/);
assert.match(service, /billingPortal\.sessions\.create/);
assert.ok(!/card_?number|\bcvc\b|expir(?:y|ation)/i.test(service));

const webhookSource = readFileSync("src/lib/billing/stripe-webhooks.ts", "utf8");
assert.match(webhookSource, /stripe-signature/i);
assert.match(webhookSource, /webhooks\.constructEvent/);

const billingRuntime = [
  ...collectRuntimeSource("src/app/api/billing"),
  ...collectRuntimeSource("src/app/api/webhooks/stripe"),
  ...collectRuntimeSource("src/lib/billing"),
]
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");
assert.doesNotMatch(
  billingRuntime,
  /\b(?:card_?number|cardNumber|primaryAccountNumber|paymentCardNumber|cvc|cvv|securityCode|expiryMonth|expiryYear)\b/,
);
assert.doesNotMatch(billingRuntime, /\bconsole\.(?:debug|info|log|warn|error)\s*\(/);

const logger = readFileSync("src/lib/logger.ts", "utf8");
assert.match(logger, /"pan"/);
assert.match(logger, /"cvc"/);
assert.match(logger, /"cvv"/);
assert.match(logger, /"cardnumber"/);
assert.match(logger, /"primaryaccountnumber"/);
assert.match(logger, /"paymentcardnumber"/);
assert.ok(
  logger.includes("(?:payment[-_ ]?)?card[-_ ]?(?:number|cvc|cvv)"),
);
assert.match(PCI_SCOPE_EVIDENCE_SCOPE, /not a PCI compliance attestation/i);
assert.match(PCI_SCOPE_EVIDENCE_SCOPE, /must reopen the gate/i);

console.log(
  "PCI card-data controls passed; qualified merchant and SAQ scope approval remains open",
);

function collectRuntimeSource(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) return collectRuntimeSource(path);
    return /\.[cm]?[jt]sx?$/.test(entry.name) && !/\.test\.[cm]?[jt]sx?$/.test(entry.name)
      ? [path]
      : [];
  });
}
