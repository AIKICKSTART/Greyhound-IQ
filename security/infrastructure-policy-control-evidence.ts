export const VERIFIED_INFRASTRUCTURE_POLICY_CONTROL_IDS = [
  "security.infrastructure-control.storage-private",
  "security.infrastructure-control.public-object-intentional",
  "security.infrastructure-control.no-stack-traces",
] as const;

export const INFRASTRUCTURE_POLICY_EVIDENCE_BOUNDARY =
  "Local executable evidence verifies source defaults and public HTTP error behavior only; it does not verify deployed cloud, IAM, backup, restore or patch-management state.";

const STORAGE_POLICY_EVIDENCE = [
  "src/lib/storage-paths.ts",
  "prisma/migrations/20260710133500_private_user_media_quarantine/migration.sql",
  "scripts/check-production-safety.ts",
  "scripts/check-visibility-policies.ts",
  "security/infrastructure-policy-control-evidence.test.ts",
] as const;

const PUBLIC_OBJECT_EVIDENCE = [
  "src/lib/storage-paths.ts",
  "prisma/migrations/20260630170000_supabase_storage/migration.sql",
  "prisma/migrations/20260710133500_private_user_media_quarantine/migration.sql",
  "security/infrastructure-policy-control-evidence.test.ts",
] as const;

const PUBLIC_ERROR_EVIDENCE = [
  "src/lib/api-errors.ts",
  "src/lib/api-errors.test.ts",
  "security/endpoints.ts",
  "docs/security/api-inventory.json",
  "security/infrastructure-policy-control-evidence.test.ts",
] as const;

export const INFRASTRUCTURE_POLICY_CONTROL_MASTER_EVIDENCE = {
  "security.infrastructure-control.storage-private": {
    status: "verified" as const,
    evidence: STORAGE_POLICY_EVIDENCE,
  },
  "security.infrastructure-control.public-object-intentional": {
    status: "verified" as const,
    evidence: PUBLIC_OBJECT_EVIDENCE,
  },
  "security.infrastructure-control.no-stack-traces": {
    status: "verified" as const,
    evidence: PUBLIC_ERROR_EVIDENCE,
  },
};

export const OPEN_INFRASTRUCTURE_POLICY_CONTROL_GAPS = [
  {
    requirementId: "security.infrastructure-control.database-private",
    reason:
      "Terraform policy rejects public datastore source patterns, but the deployed production database network path, DNS and firewall policy were not inspected.",
    requiredEvidence:
      "Capture authorised staging and production network/IAM exports and prove direct public database access is denied.",
  },
  {
    requirementId: "security.infrastructure-control.dev-no-prod",
    reason:
      "Local configuration accepts any valid self-hosted PostgreSQL URL; no executable environment identity check proves that a developer URL is non-production.",
    requiredEvidence:
      "Add an approved environment identity contract and a fail-closed local guard that rejects production resource identifiers by default.",
  },
  {
    requirementId: "security.infrastructure-control.staging-no-prod",
    reason:
      "Deployment source derives environment-specific secret names, but deployed staging IAM and Secret Manager grants were not inspected.",
    requiredEvidence:
      "Prove with authorised denied-access tests that staging identities cannot read or mutate production resources.",
  },
  {
    requirementId: "security.infrastructure-control.ci-min-secrets",
    reason:
      "The main CI gate uses local sentinels, while other automation consumes repository secrets; local source cannot prove the live secret inventory and job grants are minimal.",
    requiredEvidence:
      "Inventory each GitHub environment and job secret grant, remove unused grants, and capture denied access from jobs that do not require a secret.",
  },
  {
    requirementId: "security.infrastructure-control.management-controls",
    reason:
      "Source declares restricted origin and application authorization controls, but deployed management-plane authentication, network restrictions and break-glass access were not verified.",
    requiredEvidence:
      "Inspect authorised WorkOS, Google Cloud IAM and network policy, then run negative management-access tests from untrusted networks and roles.",
  },
  {
    requirementId: "security.infrastructure-control.backup-encryption",
    reason:
      "Backup encryption is a documented requirement only; no live backup policy, key, encrypted object or isolated backup role was inspected.",
    requiredEvidence:
      "Capture provider backup encryption configuration, key ownership, access policy and a recent encrypted backup identifier without exposing secrets.",
  },
  {
    requirementId: "security.infrastructure-control.restore-test",
    reason:
      "A representative full-data restore with authorization and deletion-integrity checks has not been executed successfully.",
    requiredEvidence:
      "Complete a timed isolated restore and retain the backup identifier, target, source revision, validation results and approvals.",
  },
  {
    requirementId: "security.infrastructure-control.recovery-objectives",
    reason:
      "The current recovery documents explicitly leave RPO and RTO unapproved and unverified.",
    requiredEvidence:
      "Approve named RPO and RTO values and validate them with timed restore and regional recovery drills.",
  },
  {
    requirementId: "security.infrastructure-control.patch-sla",
    reason:
      "Dependency scanning exists, but severity-based patch targets and runtime/base-image/provider ownership are not approved.",
    requiredEvidence:
      "Approve severity-based patch SLAs, assign owners and produce compliance evidence from dependency, image, runtime and provider inventories.",
  },
] as const;
