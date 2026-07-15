import { SECURITY_CI_MASTER_EVIDENCE } from "./ci-gate-evidence";

export const WEBHOOK_AUTHENTICITY_IDEMPOTENCY_REQUIREMENT_IDS = [
  "security.idempotency-control.webhook-processing",
  "security.release.15.webhooks-authenticated-idempotent",
] as const;

export type WebhookAuthenticityIdempotencyFacts = Readonly<{
  exactRawBodyAuthentication: boolean;
  everyIngressRegistered: boolean;
  duplicateSuppression: boolean;
  failClosedCiEnforcement: boolean;
}>;

export const WEBHOOK_AUTHENTICITY_IDEMPOTENCY_FACTS: WebhookAuthenticityIdempotencyFacts = {
  exactRawBodyAuthentication: verified(
    "security.ci.16.payment-webhook-no-signature",
  ),
  everyIngressRegistered: verified("security.ci.17.webhook-no-dedupe"),
  duplicateSuppression: verified("security.ci.17.webhook-no-dedupe"),
  failClosedCiEnforcement:
    verified("security.ci.16.payment-webhook-no-signature") &&
    verified("security.ci.17.webhook-no-dedupe"),
};

const EVIDENCE = [
  "security/webhook-authenticity-idempotency-evidence.ts",
  "security/webhook-authenticity-idempotency-evidence.test.ts",
  "security/ci-gate-evidence.ts",
  "security/webhook-deduplication-ci-evidence.ts",
  "security/webhook-deduplication-ci-evidence.test.ts",
  "security/webhook-runtime-control.test.ts",
] as const;

export function buildWebhookAuthenticityIdempotencyMasterEvidence(
  facts: WebhookAuthenticityIdempotencyFacts,
) {
  if (!Object.values(facts).every(Boolean)) return {};

  return Object.fromEntries(
    WEBHOOK_AUTHENTICITY_IDEMPOTENCY_REQUIREMENT_IDS.map((requirementId) => [
      requirementId,
      { status: "verified" as const, evidence: EVIDENCE },
    ]),
  );
}

export const WEBHOOK_AUTHENTICITY_IDEMPOTENCY_MASTER_EVIDENCE =
  buildWebhookAuthenticityIdempotencyMasterEvidence(
    WEBHOOK_AUTHENTICITY_IDEMPOTENCY_FACTS,
  );

function verified(requirementId: keyof typeof SECURITY_CI_MASTER_EVIDENCE) {
  return SECURITY_CI_MASTER_EVIDENCE[requirementId].status === "verified";
}
