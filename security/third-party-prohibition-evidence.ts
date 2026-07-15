export type ThirdPartyRetryBinding = {
  readonly surface: string;
  readonly sourceFile: string;
  readonly requiredMarkers: readonly string[];
};

export const THIRD_PARTY_RETRY_BINDINGS = [
  binding("Stripe mutating API calls", "src/lib/billing/stripe-service.ts", [
    'stripeMutationOptions("subscription-checkout"',
    'stripeMutationOptions("bespoke-checkout"',
    'stripeMutationOptions("billing-portal"',
    "stripeCustomerCreationOptions(current.dbUserId)",
    "idempotencyKey:",
  ]),
  binding("Stripe bounded transport retry", "src/lib/billing/stripe-client.ts", [
    "maxNetworkRetries: 2",
  ]),
  binding(
    "notification webhook at-least-once delivery",
    "src/lib/notification-webhook-policy.ts",
    ['"idempotency-key": payload.id', 'method: "POST"'],
  ),
  binding("Lago usage outbox delivery", "src/lib/billing/lago-client.ts", [
    "transaction_id: string",
    "body: JSON.stringify({ event })",
  ]),
  binding("Topaz read retry", "src/lib/live/topaz.ts", [
    "async get<T>",
    "return this.get(path, params, schema, attempt + 1)",
  ]),
] as const satisfies readonly ThirdPartyRetryBinding[];

export const THIRD_PARTY_PERMISSION_BINDINGS = [
  binding("WorkOS identity to local authority", "src/lib/auth.ts", [
    "tier: normalizeTier(dbUser?.subscriptionTier)",
    "role: dbUser?.profile?.role ?? null",
    "if (!isAdminRole(current.profileRole))",
  ]),
  binding("Stripe settlement to local authority", "src/lib/billing/stripe-webhooks.ts", [
    "const plan = planForStripePriceId(priceId)",
    "findUserIdForStripeBinding",
    "stripe.webhook_customer_mismatch",
  ]),
  binding("LiveKit event to provisioned participant", "src/lib/call-service.ts", [
    "tx.callRoom.findUnique({ where: { roomName } })",
    "Only touch participants provisioned at room creation",
    "tx.callParticipant.updateMany",
  ]),
] as const satisfies readonly ThirdPartyRetryBinding[];

const THIRD_PARTY_PROHIBITION_EVIDENCE = [
  "security/third-party-prohibition-evidence.ts",
  "security/third-party-prohibition-evidence.test.ts",
  "security/third-parties.ts",
  "src/lib/auth.ts",
  "src/lib/billing/stripe-client.ts",
  "src/lib/billing/stripe-service.ts",
  "src/lib/billing/stripe-readiness.test.ts",
  "src/lib/billing/stripe-webhooks.ts",
  "src/lib/billing/stripe-webhook-settlement.test.ts",
  "src/lib/call-service.ts",
  "src/lib/live/topaz.ts",
  "src/lib/notification-service.ts",
  "src/lib/notification-webhook-policy.ts",
  "src/lib/notification-webhook.test.ts",
] as const;

export const THIRD_PARTY_PROHIBITION_MASTER_EVIDENCE = {
  "security.third-party-prohibition.non-idempotent-retry": {
    status: "verified" as const,
    evidence: THIRD_PARTY_PROHIBITION_EVIDENCE,
  },
  "security.third-party-prohibition.metadata-permission": {
    status: "verified" as const,
    evidence: THIRD_PARTY_PROHIBITION_EVIDENCE,
  },
};

function binding(
  surface: string,
  sourceFile: string,
  requiredMarkers: readonly string[],
): ThirdPartyRetryBinding {
  return { surface, sourceFile, requiredMarkers };
}
