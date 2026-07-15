const AUSTRALIAN_REGIONS = [
  "australia-southeast1",
  "australia-southeast2",
] as const;

type JsonObject = Record<string, unknown>;

export function validateGcpArchitectureContract(value: unknown) {
  const findings: string[] = [];
  const root = objectValue(value, "contract", findings);

  if (root.schemaVersion !== 2) {
    findings.push("schemaVersion: must be 2");
  }
  if (root.status !== "selected-target-unverified") {
    findings.push("status: must identify the contract as selected-target-unverified");
  }

  const account = objectValue(root.accountBoundary, "accountBoundary", findings);
  if (account.status !== "new-account-project-unselected") {
    findings.push("accountBoundary.status: target project must remain explicitly unselected");
  }
  if (account.projectAccess !== "unverified") {
    findings.push("accountBoundary.projectAccess: must remain unverified until a live preflight passes");
  }
  if (account.billingMode !== "non-billable-free-trial-only") {
    findings.push("accountBoundary.billingMode: must remain non-billable-free-trial-only");
  }
  if (account.creditSpendApproval !== "required-before-credit-consuming-resource") {
    findings.push(
      "accountBoundary.creditSpendApproval: must be required before a credit-consuming resource",
    );
  }
  if (account.paidUpgradePolicy !== "prohibited-without-explicit-approval") {
    findings.push(
      "accountBoundary.paidUpgradePolicy: paid upgrade requires explicit approval",
    );
  }

  const current = objectValue(root.currentDeployment, "currentDeployment", findings);
  const target = objectValue(root.selectedTarget, "selectedTarget", findings);
  if (current === target) {
    findings.push("currentDeployment and selectedTarget must be separate records");
  }
  if (target.status !== "selected-not-deployed") {
    findings.push("selectedTarget.status: must remain selected-not-deployed");
  }

  const regionIds = selectedRegionIds(target.regions, findings);
  for (const region of AUSTRALIAN_REGIONS) {
    if (!regionIds.includes(region)) {
      findings.push(`selectedTarget.regions: missing ${region}`);
    }
  }
  for (const region of regionIds) {
    if (!AUSTRALIAN_REGIONS.includes(region as (typeof AUSTRALIAN_REGIONS)[number])) {
      findings.push(`selectedTarget.regions: non-Australian target ${region}`);
    }
  }

  const publicIngress = objectValue(
    target.publicServiceIngress,
    "selectedTarget.publicServiceIngress",
    findings,
  );
  if (publicIngress.ingress !== "internal-and-cloud-load-balancing") {
    findings.push(
      "selectedTarget.publicServiceIngress.ingress: must be internal-and-cloud-load-balancing",
    );
  }
  if (publicIngress.defaultUrlPolicy !== "disabled") {
    findings.push("selectedTarget.publicServiceIngress.defaultUrlPolicy: must be disabled");
  }
  const internalIngress = objectValue(
    target.internalServiceIngress,
    "selectedTarget.internalServiceIngress",
    findings,
  );
  if (internalIngress.ingress !== "internal") {
    findings.push("selectedTarget.internalServiceIngress.ingress: must be internal");
  }
  if (
    internalIngress.platformEndpointPolicy !==
    "enabled-for-iam-authenticated-google-callers-only"
  ) {
    findings.push(
      "selectedTarget.internalServiceIngress.platformEndpointPolicy: must require IAM-authenticated Google callers",
    );
  }

  const services = objectValue(target.services, "selectedTarget.services", findings);
  const app = validateService(
    services.app,
    "app",
    "modular-monolith",
    "public",
    findings,
  );
  const worker = validateService(
    services.worker,
    "worker",
    "separate-worker",
    "internal",
    findings,
  );
  const realtime = validateService(
    services.realtime,
    "realtime",
    "regional-websocket-gateway",
    "public",
    findings,
  );
  const budget = objectValue(
    target.databaseConnectionBudget,
    "selectedTarget.databaseConnectionBudget",
    findings,
  );
  const safeConnections = positiveInteger(
    budget.safeConnections,
    "selectedTarget.databaseConnectionBudget.safeConnections",
    findings,
  );
  const operatorReserve = nonNegativeInteger(
    budget.operatorReserve,
    "selectedTarget.databaseConnectionBudget.operatorReserve",
    findings,
  );

  if (safeConnections !== null && operatorReserve !== null) {
    if (operatorReserve >= safeConnections) {
      findings.push(
        "selectedTarget.databaseConnectionBudget: operator reserve must be below safe connections",
      );
    }

    if (app && worker && realtime && regionIds.length > 0) {
      const maxPoolConnections =
        regionIds.length *
        (app.maxInstances * app.connectionLimit +
          worker.maxInstances * worker.connectionLimit +
          realtime.maxInstances * realtime.connectionLimit);
      const applicationBudget = safeConnections - operatorReserve;
      if (maxPoolConnections > applicationBudget) {
        findings.push(
          `selectedTarget.databaseConnectionBudget: regional maximum pool sum ${maxPoolConnections} exceeds application budget ${applicationBudget}`,
        );
      }
    }
  }

  validateRequiredCapabilities(target.capabilities, findings);

  return findings;
}

function validateService(
  value: unknown,
  name: string,
  architecture: string,
  ingressProfile: "public" | "internal",
  findings: string[],
) {
  const path = `selectedTarget.services.${name}`;
  const service = objectValue(value, path, findings);
  if (service.architecture !== architecture) {
    findings.push(`${path}.architecture: must be ${architecture}`);
  }
  if (service.ingressProfile !== ingressProfile) {
    findings.push(`${path}.ingressProfile: must be ${ingressProfile}`);
  }

  positiveNumber(service.cpu, `${path}.cpu`, findings);
  if (typeof service.memory !== "string" || !/^\d+(?:Mi|Gi)$/.test(service.memory)) {
    findings.push(`${path}.memory: must be a Mi or Gi quantity`);
  }
  positiveInteger(service.concurrency, `${path}.concurrency`, findings);
  const minInstances = nonNegativeInteger(
    service.minInstancesPerRegion,
    `${path}.minInstancesPerRegion`,
    findings,
  );
  const maxInstances = positiveInteger(
    service.maxInstancesPerRegion,
    `${path}.maxInstancesPerRegion`,
    findings,
  );
  const connectionLimit = positiveInteger(
    service.connectionLimitPerInstance,
    `${path}.connectionLimitPerInstance`,
    findings,
  );
  positiveInteger(
    service.requestTimeoutSeconds,
    `${path}.requestTimeoutSeconds`,
    findings,
  );

  const probes = objectValue(service.probes, `${path}.probes`, findings);
  for (const probe of ["startup", "liveness", "readiness"] as const) {
    if (typeof probes[probe] !== "string" || !probes[probe].startsWith("/")) {
      findings.push(`${path}.probes.${probe}: must be an absolute path`);
    }
  }

  if (
    minInstances !== null &&
    maxInstances !== null &&
    minInstances > maxInstances
  ) {
    findings.push(`${path}: minimum instances must not exceed maximum instances`);
  }

  if (maxInstances === null || connectionLimit === null) return null;
  return { maxInstances, connectionLimit };
}

function validateRequiredCapabilities(value: unknown, findings: string[]) {
  const capabilities = objectValue(value, "selectedTarget.capabilities", findings);
  const required = [
    ["database", "engine", "alloydb-postgresql"],
    ["storage", "engine", "cloud-storage-configurable-au-dual-region"],
    ["asynchronousDelivery", "engine", "alloydb-outbox-pubsub"],
    [
      "applicationRealtime",
      "engine",
      "pubsub-regional-websocket-redis-cursor-replay",
    ],
    ["livekit", "engine", "self-hosted-independent-regional-cells"],
    [
      "observability",
      "engine",
      "cloud-monitoring-logging-australian-regional-sinks",
    ],
  ] as const;

  for (const [name, key, expected] of required) {
    const capability = objectValue(
      capabilities[name],
      `selectedTarget.capabilities.${name}`,
      findings,
    );
    if (capability[key] !== expected) {
      findings.push(`selectedTarget.capabilities.${name}.${key}: must be ${expected}`);
    }
    if (capability.status !== "required-unverified") {
      findings.push(
        `selectedTarget.capabilities.${name}.status: must remain required-unverified`,
      );
    }
  }

  const database = objectValue(
    capabilities.database,
    "selectedTarget.capabilities.database",
    findings,
  );
  if (database.primaryRegion !== AUSTRALIAN_REGIONS[0]) {
    findings.push("selectedTarget.capabilities.database.primaryRegion: must be Sydney");
  }
  if (database.secondaryRegion !== AUSTRALIAN_REGIONS[1]) {
    findings.push("selectedTarget.capabilities.database.secondaryRegion: must be Melbourne");
  }

  const providers = objectValue(
    capabilities.externalProviders,
    "selectedTarget.capabilities.externalProviders",
    findings,
  );
  if (providers.authentication !== "workos-preserve-and-verify") {
    findings.push(
      "selectedTarget.capabilities.externalProviders.authentication: must preserve WorkOS",
    );
  }
  if (providers.payments !== "stripe-preserve-and-verify") {
    findings.push(
      "selectedTarget.capabilities.externalProviders.payments: must preserve Stripe",
    );
  }
  if (providers.status !== "required-unverified") {
    findings.push(
      "selectedTarget.capabilities.externalProviders.status: must remain required-unverified",
    );
  }
}

function selectedRegionIds(value: unknown, findings: string[]) {
  if (!Array.isArray(value)) {
    findings.push("selectedTarget.regions: must be an array");
    return [];
  }

  const ids = value.flatMap((region, index) => {
    const record = objectValue(
      region,
      `selectedTarget.regions[${index}]`,
      findings,
    );
    if (typeof record.id !== "string" || !record.id.trim()) {
      findings.push(`selectedTarget.regions[${index}].id: must be a region id`);
      return [];
    }
    return [record.id];
  });
  if (new Set(ids).size !== ids.length) {
    findings.push("selectedTarget.regions: region ids must be unique");
  }
  return ids;
}

function objectValue(value: unknown, path: string, findings: string[]): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    findings.push(`${path}: must be an object`);
    return {};
  }
  return value as JsonObject;
}

function positiveNumber(value: unknown, path: string, findings: string[]) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    findings.push(`${path}: must be a positive number`);
  }
}

function positiveInteger(value: unknown, path: string, findings: string[]) {
  if (!Number.isInteger(value) || (value as number) < 1) {
    findings.push(`${path}: must be a positive integer`);
    return null;
  }
  return value as number;
}

function nonNegativeInteger(value: unknown, path: string, findings: string[]) {
  if (!Number.isInteger(value) || (value as number) < 0) {
    findings.push(`${path}: must be a non-negative integer`);
    return null;
  }
  return value as number;
}
