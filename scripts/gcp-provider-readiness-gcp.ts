import type {
  CloudRunServiceSnapshot,
  DiscoveryError,
  IamSnapshot,
  ProjectSnapshot,
  WifSnapshot,
} from "./gcp-provider-readiness";
import {
  parseProbeJson,
  type ReadOnlyProbeRunner,
} from "./gcp-provider-readiness-command";

export function discoverGcpProject(
  runner: ReadOnlyProbeRunner,
  projectId: string,
  regions: string[],
  repository: string | null,
  auditServiceAccountKeys: boolean,
): ProjectSnapshot {
  const snapshot = emptyProjectSnapshot(projectId, regions);
  const describeOperation = `gcp.project.describe.${projectId}`;
  const project = parseProbeJson<{
    projectId?: string;
    lifecycleState?: string;
  }>(
    runner.run({
      tool: "gcloud",
      args: ["projects", "describe", projectId, "--format=json"],
      operation: describeOperation,
    }),
    describeOperation,
    snapshot.discoveryErrors,
  );
  snapshot.exists = project?.projectId === projectId;
  snapshot.lifecycleState = project?.lifecycleState ?? null;

  const billingOperation = `gcp.billing.describe.${projectId}`;
  const billing = parseProbeJson<{ billingEnabled?: boolean }>(
    runner.run({
      tool: "gcloud",
      args: ["billing", "projects", "describe", projectId, "--format=json"],
      operation: billingOperation,
    }),
    billingOperation,
    snapshot.discoveryErrors,
  );
  snapshot.billingEnabled =
    typeof billing?.billingEnabled === "boolean" ? billing.billingEnabled : null;

  const apiOperation = `gcp.services.enabled.${projectId}`;
  const apis = parseProbeJson<Array<{ config?: { name?: string } }>>(
    runner.run({
      tool: "gcloud",
      args: ["services", "list", "--enabled", `--project=${projectId}`, "--format=json"],
      operation: apiOperation,
    }),
    apiOperation,
    snapshot.discoveryErrors,
  );
  snapshot.enabledApis = (apis ?? [])
    .flatMap((entry) => (entry.config?.name ? [entry.config.name] : []))
    .toSorted();

  snapshot.cloudRunServices = discoverCloudRun(
    runner,
    projectId,
    snapshot.discoveryErrors,
  );
  snapshot.iam = discoverIam(
    runner,
    projectId,
    snapshot.discoveryErrors,
    auditServiceAccountKeys,
  );
  snapshot.wif = discoverWif(
    runner,
    projectId,
    repository,
    snapshot.discoveryErrors,
  );
  discoverQuotas(runner, projectId, regions, snapshot);
  return snapshot;
}

function emptyIamSnapshot(): IamSnapshot {
  return {
    policyVerified: false,
    publicRoleBindings: [],
    primitiveRoleBindings: [],
    memberTypeCounts: {},
    serviceAccountCount: null,
    userManagedKeyCount: null,
    distinctBuildDeployRuntimeAccounts: null,
  };
}

function emptyWifSnapshot(): WifSnapshot {
  return {
    discoveryVerified: false,
    poolCount: null,
    providerCount: null,
    repositoryBoundProvider: null,
  };
}

function emptyProjectSnapshot(
  projectId: string | null,
  regions: string[],
): ProjectSnapshot {
  return {
    projectId,
    exists: null,
    lifecycleState: null,
    billingEnabled: null,
    enabledApis: [],
    cloudRunServices: [],
    iam: emptyIamSnapshot(),
    wif: emptyWifSnapshot(),
    quotas: {
      capacityBaselineApproved: false,
      regionalDiscovery: Object.fromEntries(
        regions.map((region) => [region, false]),
      ),
      globalDiscoveryVerified: false,
    },
    discoveryErrors: [],
  };
}

function discoverCloudRun(
  runner: ReadOnlyProbeRunner,
  projectId: string,
  errors: DiscoveryError[],
) {
  const listOperation = `gcp.run.services.list.${projectId}`;
  const services = parseProbeJson<
    Array<{ metadata?: { name?: string; labels?: Record<string, string> } }>
  >(
    runner.run({
      tool: "gcloud",
      args: [
        "run",
        "services",
        "list",
        "--platform=managed",
        `--project=${projectId}`,
        "--format=json(metadata.name,metadata.labels,status.url)",
      ],
      operation: listOperation,
    }),
    listOperation,
    errors,
  );
  if (!services) return [];

  const snapshots: CloudRunServiceSnapshot[] = [];
  for (const entry of services) {
    const name = entry.metadata?.name;
    const region = entry.metadata?.labels?.["cloud.googleapis.com/location"];
    if (!name || !region) continue;
    const describeOperation = `gcp.run.services.describe.${projectId}.${name}`;
    const detail = parseProbeJson<CloudRunDescription>(
      runner.run({
        tool: "gcloud",
        args: [
          "run",
          "services",
          "describe",
          name,
          `--region=${region}`,
          "--platform=managed",
          `--project=${projectId}`,
          "--format=json(metadata.name,metadata.labels,metadata.annotations,status.url,status.traffic,spec.template.metadata.annotations,spec.template.spec.containerConcurrency,spec.template.spec.containers.resources.limits)",
        ],
        operation: describeOperation,
      }),
      describeOperation,
      errors,
    );
    if (!detail) continue;

    const iamOperation = `gcp.run.iam.${projectId}.${name}`;
    const iam = parseProbeJson<{
      bindings?: Array<{ role?: string; members?: string[] }>;
    }>(
      runner.run({
        tool: "gcloud",
        args: [
          "run",
          "services",
          "get-iam-policy",
          name,
          `--region=${region}`,
          "--platform=managed",
          `--project=${projectId}`,
          "--format=json",
        ],
        operation: iamOperation,
      }),
      iamOperation,
      errors,
    );
    snapshots.push(toCloudRunSnapshot(name, region, detail, iam));
  }
  return snapshots.toSorted((a, b) => a.name.localeCompare(b.name));
}

function toCloudRunSnapshot(
  name: string,
  region: string,
  detail: CloudRunDescription,
  iam: { bindings?: Array<{ role?: string; members?: string[] }> } | null,
): CloudRunServiceSnapshot {
  const annotations = detail.metadata?.annotations ?? {};
  const templateAnnotations = detail.spec?.template?.metadata?.annotations ?? {};
  const limits = detail.spec?.template?.spec?.containers?.[0]?.resources?.limits ?? {};
  const invokerIamDisabled = annotations["run.googleapis.com/invoker-iam-disabled"];
  const publicIam = (iam?.bindings ?? []).some(
    (binding) =>
      binding.role === "roles/run.invoker" &&
      (binding.members ?? []).some(
        (member) => member === "allUsers" || member === "allAuthenticatedUsers",
      ),
  );
  return {
    name,
    environment: name.includes("-staging")
      ? "staging"
      : name.includes("-prod")
        ? "prod"
        : "other",
    region,
    url: detail.status?.url ?? null,
    ingress: annotations["run.googleapis.com/ingress"] ?? null,
    defaultUrlEnabled: annotations["run.googleapis.com/default-url-disabled"] !== "true",
    publicInvocation: invokerIamDisabled === "true" ? true : iam ? publicIam : null,
    minScale: integerOrNull(templateAnnotations["autoscaling.knative.dev/minScale"]),
    maxScale: integerOrNull(templateAnnotations["autoscaling.knative.dev/maxScale"]),
    concurrency: integerOrNull(detail.spec?.template?.spec?.containerConcurrency),
    cpu: stringOrNull(limits.cpu),
    memory: stringOrNull(limits.memory),
  };
}

function discoverIam(
  runner: ReadOnlyProbeRunner,
  projectId: string,
  errors: DiscoveryError[],
  auditServiceAccountKeys: boolean,
): IamSnapshot {
  const snapshot = emptyIamSnapshot();
  const policyOperation = `gcp.iam.policy.${projectId}`;
  const policy = parseProbeJson<{
    bindings?: Array<{ role?: string; members?: string[] }>;
  }>(
    runner.run({
      tool: "gcloud",
      args: ["projects", "get-iam-policy", projectId, "--format=json"],
      operation: policyOperation,
    }),
    policyOperation,
    errors,
  );
  if (policy) populateIamPolicy(snapshot, policy.bindings ?? []);

  const serviceAccountOperation = `gcp.iam.service-accounts.${projectId}`;
  const accounts = parseProbeJson<Array<{ email?: string; disabled?: boolean }>>(
    runner.run({
      tool: "gcloud",
      args: [
        "iam",
        "service-accounts",
        "list",
        `--project=${projectId}`,
        "--format=json(email,disabled)",
      ],
      operation: serviceAccountOperation,
    }),
    serviceAccountOperation,
    errors,
  );
  if (!accounts) return snapshot;
  const activeEmails = accounts
    .filter((account) => !account.disabled && account.email)
    .map((account) => account.email as string);
  snapshot.serviceAccountCount = accounts.length;
  snapshot.distinctBuildDeployRuntimeAccounts =
    activeEmails.some((email) => /build/i.test(email)) &&
    activeEmails.some((email) => /deploy/i.test(email)) &&
    activeEmails.some((email) => /runtime|giq-web-/i.test(email));

  if (auditServiceAccountKeys) {
    snapshot.userManagedKeyCount = discoverUserManagedKeys(
      runner,
      projectId,
      activeEmails,
      errors,
    );
  }
  return snapshot;
}

function populateIamPolicy(
  snapshot: IamSnapshot,
  bindings: Array<{ role?: string; members?: string[] }>,
) {
  snapshot.policyVerified = true;
  for (const binding of bindings) {
    const role = binding.role ?? "unknown";
    const members = binding.members ?? [];
    if (
      members.some(
        (member) => member === "allUsers" || member === "allAuthenticatedUsers",
      )
    ) {
      snapshot.publicRoleBindings.push(role);
    }
    if (["roles/owner", "roles/editor", "roles/viewer"].includes(role)) {
      snapshot.primitiveRoleBindings.push({ role, memberCount: members.length });
    }
    for (const member of members) {
      const type = member.includes(":")
        ? member.slice(0, member.indexOf(":"))
        : member;
      snapshot.memberTypeCounts[type] =
        (snapshot.memberTypeCounts[type] ?? 0) + 1;
    }
  }
}

function discoverUserManagedKeys(
  runner: ReadOnlyProbeRunner,
  projectId: string,
  activeEmails: string[],
  errors: DiscoveryError[],
) {
  let userManagedKeyCount = 0;
  let keyDiscoveryComplete = true;
  for (const email of activeEmails) {
    const operation = `gcp.iam.user-keys.${projectId}`;
    const keys = parseProbeJson<unknown[]>(
      runner.run({
        tool: "gcloud",
        args: [
          "iam",
          "service-accounts",
          "keys",
          "list",
          `--iam-account=${email}`,
          "--managed-by=user",
          `--project=${projectId}`,
          "--format=json(name)",
        ],
        operation,
      }),
      operation,
      errors,
    );
    if (!keys) {
      keyDiscoveryComplete = false;
      continue;
    }
    userManagedKeyCount += keys.length;
  }
  return keyDiscoveryComplete ? userManagedKeyCount : null;
}

function discoverWif(
  runner: ReadOnlyProbeRunner,
  projectId: string,
  repository: string | null,
  errors: DiscoveryError[],
): WifSnapshot {
  const operation = `gcp.wif.pools.${projectId}`;
  const pools = parseProbeJson<
    Array<{ name?: string; state?: string; disabled?: boolean }>
  >(
    runner.run({
      tool: "gcloud",
      args: [
        "iam",
        "workload-identity-pools",
        "list",
        "--location=global",
        `--project=${projectId}`,
        "--format=json(name,state,disabled)",
      ],
      operation,
    }),
    operation,
    errors,
  );
  if (!pools) return emptyWifSnapshot();

  let providerCount = 0;
  let repositoryBoundProvider = false;
  for (const pool of pools.filter((item) => !item.disabled)) {
    const poolId = pool.name?.split("/").at(-1);
    if (!poolId) continue;
    const providerOperation = `gcp.wif.providers.${projectId}.${poolId}`;
    const providers = parseProbeJson<
      Array<{
        disabled?: boolean;
        attributeCondition?: string;
        attributeMapping?: Record<string, string>;
      }>
    >(
      runner.run({
        tool: "gcloud",
        args: [
          "iam",
          "workload-identity-pools",
          "providers",
          "list",
          `--workload-identity-pool=${poolId}`,
          "--location=global",
          `--project=${projectId}`,
          "--format=json(disabled,attributeCondition,attributeMapping)",
        ],
        operation: providerOperation,
      }),
      providerOperation,
      errors,
    );
    if (!providers) continue;
    const activeProviders = providers.filter((provider) => !provider.disabled);
    providerCount += activeProviders.length;
    repositoryBoundProvider ||= activeProviders.some((provider) => {
      const mapsRepository = Object.values(provider.attributeMapping ?? {}).some(
        (value) => value.includes("assertion.repository"),
      );
      return Boolean(
        repository &&
          mapsRepository &&
          provider.attributeCondition?.includes(repository),
      );
    });
  }
  return {
    discoveryVerified: true,
    poolCount: pools.filter((item) => !item.disabled).length,
    providerCount,
    repositoryBoundProvider,
  };
}

function discoverQuotas(
  runner: ReadOnlyProbeRunner,
  projectId: string,
  regions: string[],
  snapshot: ProjectSnapshot,
) {
  for (const region of regions) {
    const operation = `gcp.quota.region.${projectId}.${region}`;
    const result = runner.run({
      tool: "gcloud",
      args: [
        "compute",
        "regions",
        "describe",
        region,
        `--project=${projectId}`,
        "--format=json(name,quotas.metric,quotas.limit,quotas.usage)",
      ],
      operation,
    });
    snapshot.quotas.regionalDiscovery[region] = result.ok;
    if (!result.ok) {
      snapshot.discoveryErrors.push({
        operation,
        code: result.errorCode ?? "UNKNOWN",
      });
    }
  }
  const operation = `gcp.quota.global.${projectId}`;
  const result = runner.run({
    tool: "gcloud",
    args: [
      "compute",
      "project-info",
      "describe",
      `--project=${projectId}`,
      "--format=json(quotas.metric,quotas.limit,quotas.usage)",
    ],
    operation,
  });
  snapshot.quotas.globalDiscoveryVerified = result.ok;
  if (!result.ok) {
    snapshot.discoveryErrors.push({
      operation,
      code: result.errorCode ?? "UNKNOWN",
    });
  }
}

type CloudRunDescription = {
  metadata?: { annotations?: Record<string, string> };
  status?: { url?: string };
  spec?: {
    template?: {
      metadata?: { annotations?: Record<string, string> };
      spec?: {
        containerConcurrency?: number | string;
        containers?: Array<{
          resources?: { limits?: Record<string, string> };
        }>;
      };
    };
  };
};

function integerOrNull(value: unknown) {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}
