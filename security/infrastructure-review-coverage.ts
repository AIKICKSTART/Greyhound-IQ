export const INFRASTRUCTURE_REVIEW_STATUSES = [
  "partially-verified",
  "not-verified",
  "blocked-from-release",
] as const;

export type InfrastructureReviewStatus =
  (typeof INFRASTRUCTURE_REVIEW_STATUSES)[number];

type InfrastructureReviewSeed = readonly [
  slug: string,
  surface: string,
  status: InfrastructureReviewStatus,
  observedState: string,
  openAction: string,
  evidence: readonly string[],
];

const SECURITY_ARCHITECTURE = "docs/security/security-architecture.md";
const TRUST_BOUNDARIES = "docs/security/trust-boundaries.md";
const PRODUCTION_ARCHITECTURE =
  "docs/architecture/greyhoundiq-australia-production-architecture.md";
const BACKUP_RECOVERY = "docs/security/backup-and-recovery.md";
const INCIDENT_CONTROLS = "docs/architecture/incident-response-controls.md";

const REVIEW_SEEDS = [
  ["cloud-accounts", "cloud accounts", "blocked-from-release", "Repository deployment configuration uses Google Cloud, but the running project/account separation and organisation policy were not verified.", "Prove separate production, non-production, security and log ownership boundaries from authorised cloud inventory.", [SECURITY_ARCHITECTURE, PRODUCTION_ARCHITECTURE]],
  ["iam", "IAM", "blocked-from-release", "GitHub deployment and Cloud Run identities are documented, with shared or broad privilege retained as a high finding.", "Apply and inspect service-specific least-privilege roles, workload identity and break-glass access.", [SECURITY_ARCHITECTURE, TRUST_BOUNDARIES, PRODUCTION_ARCHITECTURE]],
  ["network-policies", "network policies", "not-verified", "The target private-service and origin-restriction topology is designed but not evidenced in a running environment.", "Export and test VPC, ingress, egress, private-service and origin-only rules.", [TRUST_BOUNDARIES, PRODUCTION_ARCHITECTURE]],
  ["public-endpoints", "public endpoints", "partially-verified", "Application and route inventories exist; internal endpoints still rely on interchangeable static secrets.", "Prove exact public exposure and replace internal static secrets with route-scoped workload identity.", [SECURITY_ARCHITECTURE, "docs/security/api-inventory.md"]],
  ["database-exposure", "database exposure", "not-verified", "The database is intended to be private, while the live network path and non-bypass runtime role remain unverified.", "Prove private connectivity, firewall denial, non-public DNS and runtime role restrictions.", [SECURITY_ARCHITECTURE, TRUST_BOUNDARIES, "docs/security/database-inventory.md"]],
  ["storage-policies", "storage policies", "partially-verified", "Private/public media paths and signed access are implemented in source; deployed bucket policies and public-access prevention are unverified.", "Inspect bucket IAM, public-access prevention, retention, CORS and signed URL behavior in staging.", [SECURITY_ARCHITECTURE, TRUST_BOUNDARIES, "docs/security/file-upload-review.md"]],
  ["security-groups", "security groups", "not-verified", "Cloud-neutral network boundaries are documented, but no authorised deployed firewall/security-group export was captured.", "Capture and policy-test every ingress and egress rule for application, data and administration planes.", [TRUST_BOUNDARIES, PRODUCTION_ARCHITECTURE]],
  ["firewalls", "firewalls", "not-verified", "Edge and VPC firewall responsibilities are designed without running-rule evidence.", "Prove default-deny origin/data-plane rules and authorised edge-only access.", [TRUST_BOUNDARIES, PRODUCTION_ARCHITECTURE]],
  ["cdn-configuration", "CDN configuration", "not-verified", "Australian CDN cache classes, origin shielding and private-response exclusions are specified but not deployed or tested.", "Apply and test cache keys, bypass rules, stale behavior, purge, origin authentication and cost limits.", [PRODUCTION_ARCHITECTURE, SECURITY_ARCHITECTURE]],
  ["tls", "TLS", "partially-verified", "HTTPS termination is required by the target edge and Cloud Run path; exact protocol and cipher policy is not captured from deployment.", "Verify edge-to-origin TLS policy, redirect behavior and downgrade resistance.", [PRODUCTION_ARCHITECTURE, TRUST_BOUNDARIES]],
  ["certificates", "certificates", "not-verified", "Managed certificate automation is planned; issuance, renewal ownership and expiry alerts are not evidenced.", "Prove automated renewal, expiry alerting, rollback and emergency replacement.", [PRODUCTION_ARCHITECTURE, INCIDENT_CONTROLS]],
  ["dns", "DNS", "not-verified", "DNS, TTL and regional recovery behavior are designed without an authoritative zone export or failover exercise.", "Review zone records, DNSSEC decision, TTLs, health behavior and tested rollback/failover.", [PRODUCTION_ARCHITECTURE, INCIDENT_CONTROLS]],
  ["domain-ownership", "domain ownership", "not-verified", "Registrar locking, account ownership and recovery are required but not evidenced from the registrar.", "Assign named ownership and prove registrar lock, phishing-resistant MFA and recovery controls.", [PRODUCTION_ARCHITECTURE, "docs/security/risk-register.md"]],
  ["container-configuration", "container configuration", "partially-verified", "Docker and Cloud Run configuration are versioned; runtime hardening and deployed image posture remain incomplete.", "Verify non-root execution, read-only filesystem where possible, image scanning, digest pinning and resource limits.", [SECURITY_ARCHITECTURE, "Dockerfile", ".github/workflows/cloud-run-deploy.yml"]],
  ["serverless-configuration", "serverless configuration", "partially-verified", "Cloud Run service configuration and deployment workflow exist, while deployed concurrency, ingress, min/max instances and isolation are not captured.", "Compare authorised Cloud Run service exports to capacity, identity and network policy.", [PRODUCTION_ARCHITECTURE, ".github/workflows/cloud-run-deploy.yml"]],
  ["runtime-permissions", "runtime permissions", "blocked-from-release", "Shared runtime/service privilege and secrets remain a high finding.", "Deploy separate least-privilege identities for web, worker, scanner, migration and internal jobs; verify denied capabilities.", [SECURITY_ARCHITECTURE, TRUST_BOUNDARIES, "docs/security/risk-register.md"]],
  ["metadata-access", "metadata access", "not-verified", "SSRF and workload identity boundaries are documented; metadata-server access behavior is not tested.", "Prove metadata concealment/headers, egress restrictions and SSRF denial from every URL-fetching surface.", [TRUST_BOUNDARIES, "docs/security/threat-model.md"]],
  ["build-systems", "build systems", "partially-verified", "GitHub Actions and Cloud Build inputs are versioned with security scans and immutable image resolution.", "Prove protected workflow changes, build provenance, dependency trust and isolated untrusted pull requests.", [SECURITY_ARCHITECTURE, ".github/workflows/ci.yml", ".github/workflows/cloud-run-deploy.yml"]],
  ["deployment-identities", "deployment identities", "blocked-from-release", "OIDC deployment exists, but project-wide privilege and identity separation are unresolved.", "Use environment-bound deploy identities with narrowly scoped impersonation and approval evidence.", [SECURITY_ARCHITECTURE, TRUST_BOUNDARIES, "docs/security/risk-register.md"]],
  ["environment-separation", "environment separation", "partially-verified", "The repository defines Design Lab, staging and production intent; cloud project, credential and data isolation is not proven end to end.", "Test that local/preview/staging identities cannot read or mutate production resources.", [SECURITY_ARCHITECTURE, TRUST_BOUNDARIES, PRODUCTION_ARCHITECTURE]],
  ["backups", "backups", "not-verified", "Backup architecture and restore procedures are documented, but a successful isolated restore and deletion lifecycle are unproven.", "Capture backup policy and complete timed restore, corruption, account-compromise and regional-recovery exercises.", [BACKUP_RECOVERY, PRODUCTION_ARCHITECTURE]],
  ["monitoring", "monitoring", "not-verified", "Required golden signals, dashboards and incident desk are designed; production telemetry and paging delivery are not evidenced.", "Deploy SLO dashboards, multi-window burn alerts, synthetic journeys and paging tests with named owners.", [PRODUCTION_ARCHITECTURE, INCIDENT_CONTROLS, "docs/security/logging-and-alerting.md"]],
  ["patch-management", "patch management", "not-verified", "Dependency scanning exists, but runtime/base-image/provider patch ownership and service-level targets are not approved.", "Define severity-based patch SLAs, supported-runtime inventory, emergency workflow and compliance evidence.", [SECURITY_ARCHITECTURE, "docs/security/supply-chain-review.md"]],
] as const satisfies readonly InfrastructureReviewSeed[];

export const INFRASTRUCTURE_REVIEW_RECORDS = REVIEW_SEEDS.map(
  ([slug, surface, status, observedState, openAction, evidence]) => ({
    requirementId: `security.infrastructure-review.${slug}`,
    surface,
    status,
    observedState,
    openAction,
    evidence,
    owner: "GreyhoundIQ platform and security leads",
  }),
);

export function validateInfrastructureReviewCoverage() {
  const failures: string[] = [];
  const ids = new Set<string>();

  for (const record of INFRASTRUCTURE_REVIEW_RECORDS) {
    if (ids.has(record.requirementId)) {
      failures.push(`${record.requirementId}:duplicate`);
    }
    ids.add(record.requirementId);
    for (const field of ["surface", "observedState", "openAction", "owner"] as const) {
      if (!record[field].trim()) failures.push(`${record.requirementId}:${field}`);
    }
    if ((record.evidence as readonly string[]).length === 0) {
      failures.push(`${record.requirementId}:evidence`);
    }
  }

  return failures;
}
