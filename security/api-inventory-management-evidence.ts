import type { EndpointContract } from "./endpoints";

export const VERIFIED_API_INVENTORY_MANAGEMENT_IDS = [
  "security.api-inventory-management.complete-deployed",
  "security.api-inventory-management.deprecated-owner-date",
  "security.api-inventory-management.generated-docs-redact",
] as const;

export type ApiDocumentationExposureInputs = {
  readonly publicFiles: readonly { path: string; content: string }[];
  readonly routePatterns: readonly string[];
  readonly productionPackages: readonly string[];
};

export function validateApiDocumentationExposure({
  publicFiles,
  routePatterns,
  productionPackages,
}: ApiDocumentationExposureInputs) {
  const issues: string[] = [];
  for (const file of publicFiles) {
    if (/(?:^|\/)(?:openapi|swagger)(?:\.[^/]*)?\.json$/i.test(file.path)) {
      issues.push(`PUBLIC_API_CONTRACT:${file.path}`);
    }
    if (/\/api\/internal\/|x-internal-secret|InternalBearer|InternalSecret/.test(file.content)) {
      issues.push(`PUBLIC_INTERNAL_OPERATION_REFERENCE:${file.path}`);
    }
  }
  for (const route of routePatterns) {
    if (/(?:^|\/)(?:api-docs?|docs\/api|openapi|redoc|swagger)(?:\/|$)/i.test(route)) {
      issues.push(`PUBLIC_API_DOCUMENTATION_ROUTE:${route}`);
    }
  }
  for (const packageName of productionPackages) {
    if (/^(?:@scalar\/|redoc|redoc-express|swagger-ui|swagger-ui-express)/.test(packageName)) {
      issues.push(`PUBLIC_API_DOCUMENTATION_PACKAGE:${packageName}`);
    }
  }
  return issues.toSorted();
}

export function validateEndpointLifecycle(
  endpoints: readonly EndpointContract[],
) {
  const issues: string[] = [];
  for (const endpoint of endpoints) {
    if (endpoint.deprecationStatus === "unknown") {
      issues.push(`LIFECYCLE_UNKNOWN:${endpoint.endpointId}`);
    }
    if (endpoint.deprecationStatus !== "deprecated") continue;
    if (!endpoint.owner.trim() || endpoint.owner === "unassigned") {
      issues.push(`DEPRECATED_OWNER_MISSING:${endpoint.endpointId}`);
    }
    if (
      !endpoint.retirementDate ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endpoint.retirementDate) ||
      !Number.isFinite(Date.parse(`${endpoint.retirementDate}T00:00:00Z`))
    ) {
      issues.push(`DEPRECATED_RETIREMENT_DATE_MISSING:${endpoint.endpointId}`);
    }
  }
  return issues.toSorted();
}

export const API_INVENTORY_MANAGEMENT_EVIDENCE = [
  "security/endpoints.ts",
  "security/registry.test.ts",
  "security/api-surface-inventory.test.ts",
  "security/ci-gate-evidence.ts",
  "security/ci-gate-evidence.test.ts",
  "security/api-inventory-management-evidence.ts",
  "security/api-inventory-management-evidence.test.ts",
] as const;

export const API_INVENTORY_MANAGEMENT_MASTER_EVIDENCE = Object.fromEntries(
  VERIFIED_API_INVENTORY_MANAGEMENT_IDS.map((requirementId) => [
    requirementId,
    {
      status: "verified" as const,
      evidence: API_INVENTORY_MANAGEMENT_EVIDENCE,
    },
  ]),
);
