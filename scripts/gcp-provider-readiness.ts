import { createHash } from "node:crypto";

export const REQUIRED_GREEN_APIS = [
  "alloydb.googleapis.com",
  "artifactregistry.googleapis.com",
  "billingbudgets.googleapis.com",
  "certificatemanager.googleapis.com",
  "cloudbuild.googleapis.com",
  "cloudresourcemanager.googleapis.com",
  "cloudscheduler.googleapis.com",
  "cloudtasks.googleapis.com",
  "compute.googleapis.com",
  "dns.googleapis.com",
  "iam.googleapis.com",
  "iamcredentials.googleapis.com",
  "logging.googleapis.com",
  "monitoring.googleapis.com",
  "pubsub.googleapis.com",
  "redis.googleapis.com",
  "run.googleapis.com",
  "secretmanager.googleapis.com",
  "servicecontrol.googleapis.com",
  "servicemanagement.googleapis.com",
  "serviceusage.googleapis.com",
  "storage.googleapis.com",
  "sts.googleapis.com",
] as const;

export const REQUIRED_QUOTA_EVIDENCE = [
  "cloud-run-regional-cpu-memory",
  "cloud-run-regional-max-instances",
  "external-application-load-balancer",
  "alloydb-primary-secondary-capacity",
  "pubsub-regional-throughput",
  "cloud-tasks-dispatch-rate",
  "cloud-build-concurrency",
  "artifact-storage-and-egress",
] as const;

export const EXISTING_RELEASE_GATES = [
  "PREPROD.GCP.MANAGED_SERVICE_PARITY",
  "PREPROD.ARCHITECTURE.RESILIENCE_EVIDENCE",
  "PREPROD.CAPACITY.50000_DAU",
  "PREPROD.PROMOTION.EVIDENCE_MANIFEST",
] as const;

export type ProbeErrorCode =
  | "BILLING_DISABLED"
  | "SERVICE_DISABLED"
  | "PERMISSION_DENIED"
  | "NOT_FOUND"
  | "CLI_UNAVAILABLE"
  | "INVALID_OUTPUT"
  | "UNKNOWN";

export type DiscoveryError = {
  operation: string;
  code: ProbeErrorCode;
};

export type CloudRunServiceSnapshot = {
  name: string;
  environment: "staging" | "prod" | "other";
  region: string | null;
  url: string | null;
  ingress: string | null;
  defaultUrlEnabled: boolean | null;
  publicInvocation: boolean | null;
  minScale: number | null;
  maxScale: number | null;
  concurrency: number | null;
  cpu: string | null;
  memory: string | null;
};

export type IamSnapshot = {
  policyVerified: boolean;
  publicRoleBindings: string[];
  primitiveRoleBindings: Array<{ role: string; memberCount: number }>;
  memberTypeCounts: Record<string, number>;
  serviceAccountCount: number | null;
  userManagedKeyCount: number | null;
  distinctBuildDeployRuntimeAccounts: boolean | null;
};

export type WifSnapshot = {
  discoveryVerified: boolean;
  poolCount: number | null;
  providerCount: number | null;
  repositoryBoundProvider: boolean | null;
};

export type QuotaSnapshot = {
  capacityBaselineApproved: boolean;
  regionalDiscovery: Record<string, boolean>;
  globalDiscoveryVerified: boolean;
};

export type ProjectSnapshot = {
  projectId: string | null;
  exists: boolean | null;
  lifecycleState: string | null;
  billingEnabled: boolean | null;
  enabledApis: string[];
  cloudRunServices: CloudRunServiceSnapshot[];
  iam: IamSnapshot;
  wif: WifSnapshot;
  quotas: QuotaSnapshot;
  discoveryErrors: DiscoveryError[];
};

export type GithubSnapshot = {
  repository: string | null;
  environmentName: string;
  discoveryVerified: boolean;
  environmentExists: boolean | null;
  canAdminsBypass: boolean | null;
  protectionRuleCount: number | null;
  requiredSecretNames: string[];
  presentSecretNames: string[];
  optionalVariableNames: string[];
  presentVariableNames: string[];
  discoveryErrors: DiscoveryError[];
};

export type ProviderReadinessInput = {
  capturedAt: string;
  sourceSha: string;
  sourceDirty: boolean;
  activeAccount: string | null;
  targetRegions: string[];
  targetIngress: string;
  targetDefaultUrlPolicy: string;
  blue: ProjectSnapshot;
  green: ProjectSnapshot | null;
  github: GithubSnapshot;
  commandAudit: Array<{
    tool: "gcloud" | "gh" | "git";
    operation: string;
    ok: boolean;
    errorCode: ProbeErrorCode | null;
  }>;
};

export type ReadinessFinding = {
  id: string;
  severity: "blocker" | "warning";
  scope: "blue" | "green" | "github" | "evidence";
  message: string;
};

export function buildProviderReadinessEvidence(input: ProviderReadinessInput) {
  const findings: ReadinessFinding[] = [];
  const missingApis = REQUIRED_GREEN_APIS.filter(
    (service) => !input.green?.enabledApis.includes(service),
  );
  const missingGithubSecrets = input.github.requiredSecretNames.filter(
    (name) => !input.github.presentSecretNames.includes(name),
  );
  const missingGithubVariables = input.github.optionalVariableNames.filter(
    (name) => !input.github.presentVariableNames.includes(name),
  );

  if (input.blue.billingEnabled === false) {
    findings.push({
      id: "GCP-BLUE-001",
      severity: "blocker",
      scope: "blue",
      message: "The existing blue project has billing disabled and cannot be availability evidence.",
    });
  }
  if (
    input.blue.cloudRunServices.some(
      (service) =>
        service.environment === "staging" && service.publicInvocation === true,
    )
  ) {
    findings.push({
      id: "GCP-BLUE-002",
      severity: "blocker",
      scope: "blue",
      message: "A blue staging Cloud Run service permits direct public invocation.",
    });
  }
  if (
    input.blue.cloudRunServices.some((service) => service.environment === "staging") &&
    input.blue.cloudRunServices.some((service) => service.environment === "prod")
  ) {
    findings.push({
      id: "GCP-BLUE-003",
      severity: "blocker",
      scope: "blue",
      message: "Blue staging and production services share one project failure boundary.",
    });
  }

  if (!input.green?.projectId) {
    findings.push({
      id: "GCP-GREEN-001",
      severity: "blocker",
      scope: "green",
      message: "No isolated green project identifier is configured.",
    });
  } else if (input.green.projectId === input.blue.projectId) {
    findings.push({
      id: "GCP-GREEN-002",
      severity: "blocker",
      scope: "green",
      message: "The green target must not reuse the blue project.",
    });
  }
  if (input.green?.projectId && input.green.exists !== true) {
    findings.push({
      id: "GCP-GREEN-003",
      severity: "blocker",
      scope: "green",
      message: "The configured green project could not be verified as an active project.",
    });
  }
  if (input.green?.projectId && input.green.billingEnabled !== true) {
    findings.push({
      id: "GCP-GREEN-004",
      severity: "blocker",
      scope: "green",
      message: "The configured green project does not have verified billing.",
    });
  }
  if (missingApis.length > 0) {
    findings.push({
      id: "GCP-GREEN-005",
      severity: "blocker",
      scope: "green",
      message: `${missingApis.length} required green APIs are not verified as enabled.`,
    });
  }
  if (
    !input.green ||
    input.targetRegions.some(
      (region) => input.green?.quotas.regionalDiscovery[region] !== true,
    ) ||
    input.green.quotas.globalDiscoveryVerified !== true ||
    input.green.quotas.capacityBaselineApproved !== true
  ) {
    findings.push({
      id: "GCP-QUOTA-001",
      severity: "blocker",
      scope: "green",
      message: "Regional/global quota discovery and an approved measured capacity baseline are required.",
    });
  }

  const greenIam = input.green?.iam;
  if (!greenIam?.policyVerified) {
    findings.push({
      id: "GCP-IAM-001",
      severity: "blocker",
      scope: "green",
      message: "Green project IAM policy evidence is unavailable.",
    });
  } else {
    if (greenIam.publicRoleBindings.length > 0) {
      findings.push({
        id: "GCP-IAM-002",
        severity: "blocker",
        scope: "green",
        message: "Green project IAM contains public role bindings.",
      });
    }
    if (
      greenIam.primitiveRoleBindings.some(
        (binding) => binding.role === "roles/editor" || binding.role === "roles/owner",
      )
    ) {
      findings.push({
        id: "GCP-IAM-003",
        severity: "blocker",
        scope: "green",
        message: "Green project workload access must not rely on primitive owner/editor roles.",
      });
    }
    if (greenIam.distinctBuildDeployRuntimeAccounts !== true) {
      findings.push({
        id: "GCP-IAM-004",
        severity: "blocker",
        scope: "green",
        message: "Distinct green build, deploy and runtime service accounts are not proved.",
      });
    }
    if (greenIam.userManagedKeyCount !== 0) {
      findings.push({
        id: "GCP-IAM-005",
        severity: "blocker",
        scope: "green",
        message: "Green service accounts must have zero user-managed keys.",
      });
    }
  }

  if (
    !input.green?.wif.discoveryVerified ||
    (input.green.wif.providerCount ?? 0) < 1 ||
    input.green.wif.repositoryBoundProvider !== true
  ) {
    findings.push({
      id: "GCP-WIF-001",
      severity: "blocker",
      scope: "green",
      message: "A repository-bound Workload Identity Federation provider is not proved.",
    });
  }

  if (!input.github.discoveryVerified || input.github.environmentExists !== true) {
    findings.push({
      id: "GH-ENV-001",
      severity: "blocker",
      scope: "github",
      message: `GitHub environment ${input.github.environmentName} is not verified.`,
    });
  } else {
    if ((input.github.protectionRuleCount ?? 0) < 1) {
      findings.push({
        id: "GH-ENV-002",
        severity: "blocker",
        scope: "github",
        message: `GitHub environment ${input.github.environmentName} has no protection rule.`,
      });
    }
    if (input.github.canAdminsBypass !== false) {
      findings.push({
        id: "GH-ENV-003",
        severity: "blocker",
        scope: "github",
        message: `GitHub environment ${input.github.environmentName} permits or does not disprove administrator bypass.`,
      });
    }
  }
  if (missingGithubSecrets.length > 0) {
    findings.push({
      id: "GH-ENV-004",
      severity: "blocker",
      scope: "github",
      message: `${missingGithubSecrets.length} workflow secret names are not available to the green environment.`,
    });
  }
  if (missingGithubVariables.length > 0) {
    findings.push({
      id: "GH-ENV-005",
      severity: "warning",
      scope: "github",
      message: `${missingGithubVariables.length} optional workflow variables are not configured.`,
    });
  }

  const orderedFindings = findings.toSorted((a, b) => a.id.localeCompare(b.id));
  const blockers = orderedFindings.filter((finding) => finding.severity === "blocker");
  const contract = {
    requiredApis: [...REQUIRED_GREEN_APIS],
    requiredQuotaEvidence: [...REQUIRED_QUOTA_EVIDENCE],
    targetRegions: [...input.targetRegions].toSorted(),
    targetIngress: input.targetIngress,
    targetDefaultUrlPolicy: input.targetDefaultUrlPolicy,
    requiredGithubSecrets: [...input.github.requiredSecretNames].toSorted(),
  };

  return {
    schemaVersion: 1,
    status: blockers.length === 0 ? "ready" : "blocked",
    preflightControl: {
      id: "GCP.PREFLIGHT.READ_ONLY_DISCOVERY",
      status: "passed",
      mutationsExecuted: 0,
      productionTrafficProbesExecuted: 0,
      secretValuesRead: 0,
      preservesExistingServices: true,
    },
    releaseGateClaims: Object.fromEntries(
      EXISTING_RELEASE_GATES.map((id) => [id, "not-verified"]),
    ),
    identity: {
      capturedAt: input.capturedAt,
      sourceSha: input.sourceSha,
      sourceDirty: input.sourceDirty,
      activeAccount: redactIdentity(input.activeAccount),
      contractDigest: `sha256:${createHash("sha256")
        .update(stableJson(contract))
        .digest("hex")}`,
    },
    targetContract: contract,
    blue: normalizeProject(input.blue),
    green: input.green ? normalizeProject(input.green) : null,
    github: {
      repository: input.github.repository,
      environmentName: input.github.environmentName,
      discoveryVerified: input.github.discoveryVerified,
      environmentExists: input.github.environmentExists,
      canAdminsBypass: input.github.canAdminsBypass,
      protectionRuleCount: input.github.protectionRuleCount,
      missingSecretNames: missingGithubSecrets.toSorted(),
      missingOptionalVariableNames: missingGithubVariables.toSorted(),
      discoveryErrors: [...input.github.discoveryErrors].toSorted(compareErrors),
    },
    commandAudit: input.commandAudit.map((entry) => ({ ...entry })),
    findings: orderedFindings,
    blockerCount: blockers.length,
  } as const;
}

export function extractWorkflowNames(source: string, namespace: "secrets" | "vars") {
  const expression = new RegExp(`\\b${namespace}\\.([A-Z][A-Z0-9_]*)`, "g");
  return [...source.matchAll(expression)]
    .map((match) => match[1])
    .filter((name): name is string => Boolean(name))
    .filter((name, index, names) => names.indexOf(name) === index)
    .toSorted();
}

export function redactIdentity(value: string | null) {
  const normalized = value?.trim();
  if (!normalized) return null;
  const at = normalized.indexOf("@");
  if (at < 1) return "[redacted]";
  return `${normalized[0]}***${normalized.slice(at)}`;
}

export function stableJson(value: unknown) {
  return `${JSON.stringify(sortObject(value), null, 2)}\n`;
}

export function renderProviderReadinessMarkdown(
  evidence: ReturnType<typeof buildProviderReadinessEvidence>,
) {
  const services = evidence.blue.cloudRunServices.length
    ? evidence.blue.cloudRunServices
        .map(
          (service) =>
            `| ${service.name} | ${service.environment} | ${service.region ?? "unknown"} | ${service.ingress ?? "unknown"} | ${formatBoolean(service.publicInvocation)} |`,
        )
        .join("\n")
    : "| None verified | — | — | — | — |";
  const findings = evidence.findings.length
    ? evidence.findings
        .map(
          (finding) =>
            `| ${finding.id} | ${finding.severity} | ${finding.scope} | ${finding.message} |`,
        )
        .join("\n")
    : "| None | — | — | No readiness blocker found by this preflight. |";

  return `# GCP provider-readiness preflight

Status: **${evidence.status}**  
Captured: ${evidence.identity.capturedAt}  
Source: \`${evidence.identity.sourceSha}\`  
Contract: \`${evidence.identity.contractDigest}\`

This artifact is a redacted, read-only inventory. It executed zero cloud mutations,
zero production traffic probes and read no secret values. It does not verify any
managed-staging, capacity, resilience or production-promotion gate.

## Blue inventory

- Project: \`${evidence.blue.projectId ?? "not-verified"}\`
- Billing enabled: ${formatBoolean(evidence.blue.billingEnabled)}
- Active account: \`${evidence.identity.activeAccount ?? "not-verified"}\`

| Service | Classification | Region | Ingress | Public invocation |
|---|---|---|---|---|
${services}

## Green target

- Project: \`${evidence.green?.projectId ?? "not-configured"}\`
- Billing enabled: ${formatBoolean(evidence.green?.billingEnabled ?? null)}
- Required regions: ${evidence.targetContract.targetRegions.map((region) => `\`${region}\``).join(", ")}
- Required ingress: \`${evidence.targetContract.targetIngress}\`
- Default URL policy: \`${evidence.targetContract.targetDefaultUrlPolicy}\`

## GitHub boundary

- Repository: \`${evidence.github.repository ?? "not-verified"}\`
- Environment: \`${evidence.github.environmentName}\`
- Environment exists: ${formatBoolean(evidence.github.environmentExists)}
- Protection rules: ${evidence.github.protectionRuleCount ?? "not-verified"}
- Administrator bypass disabled: ${formatBoolean(
    evidence.github.canAdminsBypass === null
      ? null
      : !evidence.github.canAdminsBypass,
  )}
- Missing workflow secret names: ${evidence.github.missingSecretNames.length}

## Findings

| ID | Severity | Scope | Finding |
|---|---|---|---|
${findings}

## Release boundary

${Object.entries(evidence.releaseGateClaims)
  .map(([id, status]) => `- \`${id}\`: **${status}**`)
  .join("\n")}
`;
}

function normalizeProject(project: ProjectSnapshot) {
  return {
    ...project,
    enabledApis: [...project.enabledApis].toSorted(),
    cloudRunServices: project.cloudRunServices
      .map((service) => ({ ...service }))
      .toSorted((a, b) => a.name.localeCompare(b.name)),
    iam: {
      ...project.iam,
      publicRoleBindings: [...project.iam.publicRoleBindings].toSorted(),
      primitiveRoleBindings: project.iam.primitiveRoleBindings
        .map((binding) => ({ ...binding }))
        .toSorted((a, b) => a.role.localeCompare(b.role)),
      memberTypeCounts: Object.fromEntries(
        Object.entries(project.iam.memberTypeCounts).toSorted(([a], [b]) =>
          a.localeCompare(b),
        ),
      ),
    },
    quotas: {
      ...project.quotas,
      regionalDiscovery: Object.fromEntries(
        Object.entries(project.quotas.regionalDiscovery).toSorted(([a], [b]) =>
          a.localeCompare(b),
        ),
      ),
    },
    discoveryErrors: [...project.discoveryErrors].toSorted(compareErrors),
  };
}

function compareErrors(a: DiscoveryError, b: DiscoveryError) {
  return a.operation.localeCompare(b.operation) || a.code.localeCompare(b.code);
}

function formatBoolean(value: boolean | null) {
  if (value === null) return "not verified";
  return value ? "yes" : "no";
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .toSorted(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, sortObject(item)]),
  );
}
