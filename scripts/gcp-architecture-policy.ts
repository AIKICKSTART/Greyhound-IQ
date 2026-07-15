const AUSTRALIAN_REGIONS = [
  "australia-southeast1",
  "australia-southeast2",
] as const;

type JsonObject = Record<string, unknown>;

export function validateGcpArchitectureContract(value: unknown) {
  const findings: string[] = [];
  const root = objectValue(value, "contract", findings);

  if (root.status !== "selected-target-unverified") {
    findings.push("status: must identify the contract as selected-target-unverified");
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

  if (target.ingress === "all") {
    findings.push("selectedTarget.ingress: must not be all");
  } else if (target.ingress !== "internal-and-cloud-load-balancing") {
    findings.push(
      "selectedTarget.ingress: must be internal-and-cloud-load-balancing",
    );
  }
  if (target.defaultUrlPolicy !== "disabled") {
    findings.push("selectedTarget.defaultUrlPolicy: must be disabled");
  }

  const services = objectValue(target.services, "selectedTarget.services", findings);
  const app = validateService(services.app, "app", "modular-monolith", findings);
  const worker = validateService(
    services.worker,
    "worker",
    "separate-worker",
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

    if (app && worker && regionIds.length > 0) {
      const maxPoolConnections =
        regionIds.length *
        (app.maxInstances * app.connectionLimit +
          worker.maxInstances * worker.connectionLimit);
      const applicationBudget = safeConnections - operatorReserve;
      if (maxPoolConnections > applicationBudget) {
        findings.push(
          `selectedTarget.databaseConnectionBudget: regional maximum pool sum ${maxPoolConnections} exceeds application budget ${applicationBudget}`,
        );
      }
    }
  }

  return findings;
}

function validateService(
  value: unknown,
  name: string,
  architecture: string,
  findings: string[],
) {
  const path = `selectedTarget.services.${name}`;
  const service = objectValue(value, path, findings);
  if (service.architecture !== architecture) {
    findings.push(`${path}.architecture: must be ${architecture}`);
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
