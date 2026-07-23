export type SecretInventoryStatus =
  | "source-referenced"
  | "shared-credential"
  | "managed-identity"
  | "not-configured"
  | "provider-managed-unverified";

export type SecretInventoryRecord = {
  requirementId: `security.secret-inventory.${string}`;
  category: string;
  identifierNames: readonly string[];
  sourceFiles: readonly string[];
  status: SecretInventoryStatus;
  currentFinding: string;
  owner: string;
  purpose: string;
  environment: string;
  storage: string;
  scope: string;
  rotationProcess: string;
  rotationFrequency: string;
  revocationProcess: string;
  lastRotation: string;
  servicesUsingIt: readonly string[];
  loggingExposure: string;
  buildTimeExposure: string;
  clientBundleExposure: string;
  incidentProcedure: string;
};

/**
 * Names-only source inventory. It deliberately does not read local environment
 * files, Secret Manager values, GitHub secret values, or live cloud custody.
 * An inventoried category can remain operationally unverified.
 */
export const SECRET_INVENTORY: readonly SecretInventoryRecord[] = [
  record("database-credentials", "Database credentials", ["DATABASE_URL", "DIRECT_URL", "DATABASE_IMPORT_URL", "CHECK_RLS_DB"], [".env.example", "docs/security/secrets-register.md"], "source-referenced", "Runtime, migration, import and authorised audit principals are named; live scope, TLS and rotation remain unverified.", "database-security"),
  record("session-keys", "Session keys", ["NEXTAUTH_SECRET", "AUTH_SECRET"], [".env.example", "docs/security/secrets-register.md"], "source-referenced", "Session invalidation and rotation evidence is missing.", "identity-security"),
  record("cookie-signing-keys", "Cookie-signing keys", ["WORKOS_COOKIE_PASSWORD"], [".env.example", "docs/security/secrets-register.md"], "source-referenced", "Provider cookie-key versioning and rotation evidence is missing.", "identity-security"),
  record("token-signing-keys", "Token-signing keys", ["SUPABASE_JWT_SECRET", "REALTIME_CHANNEL_SECRET", "LIVEKIT_API_SECRET"], [".env.example", "docs/security/secrets-register.md"], "source-referenced", "Signing scopes, overlap rotation and revocation are not live-verified.", "identity-security"),
  record("oauth-credentials", "OAuth credentials", ["WORKOS_API_KEY"], [".env.example", "docs/security/secrets-register.md"], "source-referenced", "WORKOS_CLIENT_ID is public configuration; the server API credential scope and rotation remain unverified.", "identity-security"),
  record("webhook-secrets", "Webhook secrets", ["STRIPE_WEBHOOK_SECRET", "LAGO_WEBHOOK_SECRET", "NOTIFICATION_WEBHOOK_SECRET"], [".env.example", "docs/security/secrets-register.md"], "source-referenced", "Webhook secret versioning, overlap and revocation remain unverified.", "integration-security"),
  record("payment-credentials", "Payment credentials", ["STRIPE_SECRET_KEY", "STRIPE_RESTRICTED_KEY", "LAGO_API_KEY"], [".env.example", "docs/security/secrets-register.md"], "source-referenced", "Restricted grants and production custody remain unverified.", "billing-security"),
  record("email-credentials", "Email credentials", [], ["src/components/design-lab-architecture-inventory.ts", "docs/security/secrets-register.md"], "not-configured", "The email provider is undecided and no tracked email credential name exists.", "platform-security"),
  record("storage-credentials", "Storage credentials", ["SUPABASE_SERVICE_ROLE_KEY"], [".env.example", "src/lib/supabase-storage.ts", "docs/security/secrets-register.md"], "source-referenced", "The server storage credential grant and rotation remain unverified.", "media-security"),
  record("queue-credentials", "Queue credentials", ["DATABASE_URL"], [".env.example", "docs/security/secrets-register.md"], "shared-credential", "Current durable outboxes share the database credential; there is no separately configured managed-queue credential.", "platform-security"),
  record("ai-provider-keys", "AI-provider keys", ["OPENAI_API_KEY"], ["src/lib/dog-card-service.ts", "docs/security/secrets-register.md"], "source-referenced", "Provider scope, spend limit, rotation and data retention remain unverified.", "ai-security"),
  record("racing-provider-keys", "Racing-provider keys", ["TOPAZ_API_KEY"], [".env.example", "src/lib/live/provider.ts", "docs/security/secrets-register.md"], "source-referenced", "Other named racing sources are public or unauthenticated in source; live Topaz scope and rotation remain unverified.", "racing-data-security"),
  record("monitoring-tokens", "Monitoring tokens", [], ["scripts/gcp-monitoring-setup.sh", "docs/security/secrets-register.md"], "managed-identity", "GCP monitoring setup uses operator/workload identity; no application monitoring token is named in tracked source and live IAM remains unverified.", "observability-security"),
  record("deployment-credentials", "Deployment credentials", ["GCP_WIF_PROVIDER", "GCP_BUILD_SERVICE_ACCOUNT", "GCP_DEPLOY_SERVICE_ACCOUNT", "GCP_RUNTIME_SERVICE_ACCOUNT"], [".github/workflows/cloud-run-deploy.yml", "docs/security/secrets-register.md"], "managed-identity", "Deployment uses Workload Identity Federation identifiers; GitHub environment protection and live IAM grants remain unverified.", "cloud-platform-security"),
  record("backup-keys", "Backup keys", [], ["docs/security/backup-and-recovery.md", "docs/security/secrets-register.md"], "provider-managed-unverified", "No live backup key, encryption configuration or recovery custody was inspected.", "database-security"),
  record("encryption-keys", "Encryption keys", [], ["docs/security/backup-and-recovery.md", "docs/security/secrets-register.md"], "provider-managed-unverified", "No application-managed data-encryption key is named; provider encryption and KMS custody remain unverified.", "cloud-platform-security"),
];

export function validateSecretInventoryRecord(record: SecretInventoryRecord) {
  const requiredText = [
    record.owner,
    record.purpose,
    record.environment,
    record.storage,
    record.scope,
    record.rotationProcess,
    record.rotationFrequency,
    record.revocationProcess,
    record.lastRotation,
    record.loggingExposure,
    record.buildTimeExposure,
    record.clientBundleExposure,
    record.incidentProcedure,
  ];
  const issues: string[] = [];
  if (requiredText.some((value) => !value.trim())) issues.push("missing-text-field");
  if (record.servicesUsingIt.length === 0) issues.push("missing-service-usage");
  return issues;
}

function record(
  id: string,
  category: string,
  identifierNames: readonly string[],
  sourceFiles: readonly string[],
  status: SecretInventoryStatus,
  currentFinding: string,
  owner: string,
): SecretInventoryRecord {
  return {
    requirementId: `security.secret-inventory.${id}`,
    category,
    identifierNames,
    sourceFiles,
    status,
    currentFinding,
    owner,
    purpose: `${category} used by the source boundaries named in this record.`,
    environment:
      "Environment-specific configuration is required; live separation is not verified.",
    storage:
      status === "managed-identity"
        ? "Workload identity or provider-managed identity; live IAM is not verified."
        : status === "not-configured"
          ? "No credential storage is configured."
          : "Google Secret Manager or a protected deployment secret is expected; live custody is not verified.",
    scope: currentFinding,
    rotationProcess: "Rotation process is not live-verified.",
    rotationFrequency: "Rotation frequency is not approved or verified.",
    revocationProcess:
      "Revoke or replace the provider, identity, or Secret Manager version; the procedure is not exercised.",
    lastRotation: "Last rotation is not verified.",
    servicesUsingIt: sourceFiles,
    loggingExposure:
      "Secret values are prohibited from logs; live-log absence is not verified.",
    buildTimeExposure:
      "Build-time exposure is prohibited unless explicitly required; candidate isolation is not verified.",
    clientBundleExposure:
      "Client-bundle exposure is prohibited; public identifiers are not classified as secrets.",
    incidentProcedure:
      "docs/security/incident-response.md applies; a category-specific rotation drill is not verified.",
  };
}
