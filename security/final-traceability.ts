import { DATABASE_OPERATIONS } from "./database-operations";
import { ENDPOINTS } from "./endpoints";
import type { VerificationStatus } from "./shared";
import { THIRD_PARTIES } from "./third-parties";
import { SECURITY_TRACES, type SecurityTraceContract } from "./traces";

export const FINAL_TRACEABILITY_FIELD_REQUIREMENTS = {
  "security.final-traceability-field.field.trace-id": "traceId",
  "security.final-traceability-field.field.product-area": "productArea",
  "security.final-traceability-field.field.route": "route",
  "security.final-traceability-field.field.user-action": "userAction",
  "security.final-traceability-field.field.frontend-source": "frontendSource",
  "security.final-traceability-field.field.request": "request",
  "security.final-traceability-field.field.server-handler": "serverHandler",
  "security.final-traceability-field.field.authentication": "authentication",
  "security.final-traceability-field.field.authorization-policy":
    "authorizationPolicy",
  "security.final-traceability-field.field.validation-schema":
    "validationSchema",
  "security.final-traceability-field.field.service": "service",
  "security.final-traceability-field.field.database-query-ids":
    "databaseQueryIds",
  "security.final-traceability-field.field.database-role": "databaseRole",
  "security.final-traceability-field.field.tables": "tables",
  "security.final-traceability-field.field.sensitive-data": "sensitiveData",
  "security.final-traceability-field.field.cache-effects": "cacheEffects",
  "security.final-traceability-field.field.background-effects":
    "backgroundEffects",
  "security.final-traceability-field.field.external-effects": "externalEffects",
  "security.final-traceability-field.field.audit-event": "auditEvent",
  "security.final-traceability-field.field.security-tests": "securityTests",
  "security.final-traceability-field.field.open-findings": "openFindings",
  "security.final-traceability-field.field.verification-status":
    "verificationStatus",
  "security.final-traceability-field.field.owner": "owner",
} as const;

export const FINAL_SUMMARY_METRIC_REQUIREMENTS = {
  "security.final-summary-metric.total-frontend-actions":
    "totalFrontendActions",
  "security.final-summary-metric.total-apis": "totalApis",
  "security.final-summary-metric.total-database-operations":
    "totalDatabaseOperations",
  "security.final-summary-metric.total-external-integrations":
    "totalExternalIntegrations",
  "security.final-summary-metric.total-privileged-operations":
    "totalPrivilegedOperations",
  "security.final-summary-metric.total-traces-verified": "totalTracesVerified",
  "security.final-summary-metric.total-traces-partially-verified":
    "totalTracesPartiallyVerified",
  "security.final-summary-metric.total-missing-traces": "totalMissingTraces",
  "security.final-summary-metric.critical-findings": "criticalFindings",
  "security.final-summary-metric.high-findings": "highFindings",
  "security.final-summary-metric.medium-findings": "mediumFindings",
  "security.final-summary-metric.low-findings": "lowFindings",
  "security.final-summary-metric.accepted-risks": "acceptedRisks",
  "security.final-summary-metric.expired-risk-acceptances":
    "expiredRiskAcceptances",
  "security.final-summary-metric.missing-tests": "missingTests",
  "security.final-summary-metric.missing-owners": "missingOwners",
  "security.final-summary-metric.missing-audit-events": "missingAuditEvents",
  "security.final-summary-metric.unbounded-queries": "unboundedQueries",
  "security.final-summary-metric.unauthorized-data-paths":
    "unauthorizedDataPaths",
  "security.final-summary-metric.deprecated-endpoints": "deprecatedEndpoints",
  "security.final-summary-metric.publicly-exposed-internal-services":
    "publiclyExposedInternalServices",
} as const;

export type EvidenceEnvelope<T> =
  | {
      status: "known";
      value: T;
      scope: string;
      reason: string;
      evidence: readonly string[];
      observed?: never;
    }
  | {
      status: "partial";
      value: T;
      scope: string;
      reason: string;
      evidence: readonly string[];
      observed?: Readonly<Record<string, number>>;
    }
  | {
      status: "unknown";
      value: null;
      scope: string;
      reason: string;
      evidence: readonly string[];
      observed?: Readonly<Record<string, number>>;
    };

export type FinalTraceabilityRow = {
  traceId: string;
  productArea: string;
  route: readonly string[];
  userAction: string;
  frontendSource: readonly string[];
  request: SecurityTraceContract["transport"];
  serverHandler: {
    sourceFiles: readonly string[];
    handlers: readonly string[];
  };
  authentication: {
    mode: SecurityTraceContract["authentication"];
    authenticationFunction: string;
    sessionValidationFunction: string;
  };
  authorizationPolicy: {
    function: string;
    object: string;
    property: string;
    requiredPermissions: readonly string[];
    requiredRelationships: readonly string[];
  };
  validationSchema: {
    client: readonly string[];
    server: string;
  };
  service: string;
  databaseQueryIds: readonly string[];
  databaseRole: readonly string[];
  tables: readonly string[];
  sensitiveData: readonly string[];
  cacheEffects: SecurityTraceContract["cacheOperations"];
  backgroundEffects: SecurityTraceContract["backgroundOperations"];
  externalEffects: SecurityTraceContract["externalOperations"];
  auditEvent: readonly string[];
  securityTests: readonly string[];
  openFindings: EvidenceEnvelope<readonly string[]>;
  verificationStatus: VerificationStatus;
  owner: string;
};

export type FinalSummaryMetricKey =
  (typeof FINAL_SUMMARY_METRIC_REQUIREMENTS)[keyof typeof FINAL_SUMMARY_METRIC_REQUIREMENTS];

export type FinalSummaryMetric = EvidenceEnvelope<number>;
export type FinalTraceabilitySummary = Readonly<
  Record<FinalSummaryMetricKey, FinalSummaryMetric>
>;

export type FinalSummaryInputs = {
  mandatoryTraceRequirementCount: number;
  acceptedRisks: number;
  expiredRiskAcceptances: number;
};

export const FINAL_TRACEABILITY_ROWS: readonly FinalTraceabilityRow[] =
  SECURITY_TRACES.map(toFinalTraceabilityRow);

export function buildFinalTraceabilitySummary(
  inputs: FinalSummaryInputs,
): FinalTraceabilitySummary {
  const endpointTestsMissing = ENDPOINTS.filter(
    (endpoint) => endpoint.tests.length === 0,
  ).length;
  const endpointOwnersMissing = ENDPOINTS.filter(
    (endpoint) => !endpoint.owner.trim() || endpoint.owner === "unassigned",
  ).length;
  const endpointAuditEventsMissing = ENDPOINTS.filter(
    (endpoint) => endpoint.auditEvent.length === 0,
  ).length;
  const explicitlyUnbounded = DATABASE_OPERATIONS.filter((operation) =>
    /\b(?:unbounded|not bounded)\b/i.test(operation.expectedRowCount),
  ).length;
  const internalSourceOperations = ENDPOINTS.filter(
    (endpoint) =>
      endpoint.protocol === "http" &&
      endpoint.routeOrProcedure.startsWith("/api/internal/"),
  ).length;

  return {
    totalFrontendActions: unknownMetric(
      "All product frontend actions",
      "No complete frontend-action registry exists; discovered server actions are not a frontend-action total.",
      ["docs/product/action-inventory.md", "security/endpoints.ts"],
      {
        discoveredServerActions: ENDPOINTS.filter(
          (endpoint) => endpoint.protocol === "server-action",
        ).length,
        seededTraceRows: SECURITY_TRACES.length,
      },
    ),
    totalApis: partialMetric(
      ENDPOINTS.length,
      "Source-discovered EndpointContract records, including HTTP methods and server actions",
      "Deployed API parity and non-Next entry points have not been verified.",
      ["security/endpoints.ts", "security/registry.test.ts"],
      {
        httpMethods: ENDPOINTS.filter(
          (endpoint) => endpoint.protocol === "http",
        ).length,
        serverActions: ENDPOINTS.filter(
          (endpoint) => endpoint.protocol === "server-action",
        ).length,
      },
    ),
    totalDatabaseOperations: partialMetric(
      DATABASE_OPERATIONS.length,
      "Registered DatabaseOperationContract records",
      "The registry is a reviewed seed, not a complete runtime query inventory.",
      ["security/database-operations.ts", "security/registry.test.ts"],
    ),
    totalExternalIntegrations: partialMetric(
      THIRD_PARTIES.length,
      "Registered ThirdPartyContract records",
      "Provider coverage is incomplete and deployed credentials/configuration were not inspected.",
      ["security/third-parties.ts", "security/registry.test.ts"],
    ),
    totalPrivilegedOperations: unknownMetric(
      "All administrator, moderator, internal-worker and provider-privileged operations",
      "No complete privilege classification links every endpoint, action and job.",
      ["security/endpoints.ts", "docs/security/authorization-matrix.md"],
    ),
    totalTracesVerified: knownMetric(
      SECURITY_TRACES.filter((trace) => trace.verificationStatus === "Verified")
        .length,
      "Current SecurityTraceContract registry",
      "This is a registry-status count, not proof that the trace inventory is complete.",
      ["security/traces.ts", "security/registry.test.ts"],
    ),
    totalTracesPartiallyVerified: knownMetric(
      SECURITY_TRACES.filter(
        (trace) => trace.verificationStatus === "Partially verified",
      ).length,
      "Current SecurityTraceContract registry",
      "This is a registry-status count, not proof that the trace inventory is complete.",
      ["security/traces.ts", "security/registry.test.ts"],
    ),
    totalMissingTraces: unknownMetric(
      "All required product and system traces",
      "Mandatory trace requirements are not linked one-to-one to SecurityTraceContract IDs, and the complete frontend-action total is unknown.",
      ["security/traces.ts", "src/components/security-master-requirements.ts"],
      {
        mandatoryTraceRequirements: inputs.mandatoryTraceRequirementCount,
        seededTraceRows: SECURITY_TRACES.length,
      },
    ),
    criticalFindings: unknownMetric(
      "All open Critical findings",
      "No authoritative machine finding registry exists; zero identified in reviewed prose is not proof of absence.",
      ["docs/security/risk-register.md"],
    ),
    highFindings: unknownMetric(
      "All open High findings",
      "The prose risk register documents reviewed findings, but no complete machine finding registry proves the total.",
      ["docs/security/risk-register.md"],
      { documentedOpenHighFindings: 12 },
    ),
    mediumFindings: unknownMetric(
      "All open Medium findings",
      "Medium findings have not been comprehensively triaged into a machine registry.",
      ["docs/security/risk-register.md"],
    ),
    lowFindings: unknownMetric(
      "All open Low findings",
      "Low findings have not been comprehensively triaged into a machine registry.",
      ["docs/security/risk-register.md"],
    ),
    acceptedRisks: knownMetric(
      inputs.acceptedRisks,
      "Current merged security-master evidence records with risk-accepted-temporarily status",
      "This count says nothing about risks that have not yet been discovered or registered.",
      ["src/components/master-audit-evidence.ts"],
    ),
    expiredRiskAcceptances: knownMetric(
      inputs.expiredRiskAcceptances,
      "Current merged security-master evidence records whose acceptance expiry is not in the future",
      "This count covers registered acceptances only.",
      ["src/components/master-audit-requirements.ts"],
    ),
    missingTests: partialMetric(
      endpointTestsMissing,
      "Source endpoint records whose tests array is empty",
      "Trace and database test gaps are separate facets; this is not a product-wide missing-test total.",
      [
        "security/endpoints.ts",
        "security/traces.ts",
        "security/database-operations.ts",
      ],
      {
        endpointRecordsWithoutLinkedTests: endpointTestsMissing,
        traceRowsWithoutLinkedTests: SECURITY_TRACES.filter(
          (trace) => trace.tests.length === 0,
        ).length,
        databaseOperationsMarkedTestCoverageMissing: DATABASE_OPERATIONS.filter(
          (operation) =>
            operation.verificationStatus === "Test coverage missing",
        ).length,
      },
    ),
    missingOwners: partialMetric(
      endpointOwnersMissing,
      "Source endpoint records with an empty or unassigned owner",
      "DatabaseOperationContract has no owner field, so this is not a cross-registry owner total.",
      ["security/endpoints.ts", "security/traces.ts"],
      {
        endpointRecordsWithoutAssignedOwner: endpointOwnersMissing,
        traceRowsWithoutOwner: SECURITY_TRACES.filter(
          (trace) => !trace.owner.trim(),
        ).length,
      },
    ),
    missingAuditEvents: partialMetric(
      endpointAuditEventsMissing,
      "Source endpoint records whose auditEvent array is empty",
      "Not every operation requires an audit event and the required-event classification is incomplete.",
      [
        "security/endpoints.ts",
        "security/traces.ts",
        "security/audit-events.ts",
      ],
      {
        endpointRecordsWithoutLinkedAuditEvent: endpointAuditEventsMissing,
        traceRowsWithoutLinkedAuditEvent: SECURITY_TRACES.filter(
          (trace) => trace.auditEvents.length === 0,
        ).length,
      },
    ),
    unboundedQueries: unknownMetric(
      "All unbounded database operations",
      "DatabaseOperationContract does not carry an authoritative boundedness classification; null maximumRowCount is not equivalent to unbounded.",
      ["security/database-operations.ts"],
      { explicitlyDescribedUnboundedOperations: explicitlyUnbounded },
    ),
    unauthorizedDataPaths: unknownMetric(
      "All source and deployed data paths lacking required authorization",
      "No machine registry classifies authorization completeness across every data path.",
      [
        "security/endpoints.ts",
        "security/database-operations.ts",
        "docs/security/authorization-matrix.md",
      ],
    ),
    deprecatedEndpoints: partialMetric(
      ENDPOINTS.filter(
        (endpoint) => endpoint.deprecationStatus === "deprecated",
      ).length,
      "Source endpoint records explicitly marked deprecated",
      "Most endpoint deprecation statuses remain unknown, so zero marked deprecated is not proof that no deprecated endpoint exists.",
      ["security/endpoints.ts"],
      {
        active: ENDPOINTS.filter(
          (endpoint) => endpoint.deprecationStatus === "active",
        ).length,
        deprecated: ENDPOINTS.filter(
          (endpoint) => endpoint.deprecationStatus === "deprecated",
        ).length,
        unknown: ENDPOINTS.filter(
          (endpoint) => endpoint.deprecationStatus === "unknown",
        ).length,
      },
    ),
    publiclyExposedInternalServices: unknownMetric(
      "Deployed internal services reachable through a public path",
      "Source discovery finds internal route methods, but deployed ingress and origin exposure were not inspected.",
      ["security/endpoints.ts", "docs/security/security-architecture.md"],
      { internalSourceRouteMethods: internalSourceOperations },
    ),
  };
}

export function validateFinalTraceabilityRows(
  rows: readonly object[],
  traces: readonly SecurityTraceContract[] = SECURITY_TRACES,
) {
  const issues: string[] = [];
  const requiredFields = Object.values(FINAL_TRACEABILITY_FIELD_REQUIREMENTS);
  const expectedById = new Map(traces.map((trace) => [trace.traceId, trace]));
  const seen = new Set<string>();

  for (const row of rows) {
    for (const field of requiredFields) {
      if (
        !Object.prototype.hasOwnProperty.call(row, field) ||
        Reflect.get(row, field) === undefined
      ) {
        issues.push(`MISSING_FIELD:${field}`);
      }
    }
    const traceId = Reflect.get(row, "traceId");
    if (typeof traceId !== "string" || !expectedById.has(traceId)) {
      issues.push(`UNKNOWN_TRACE_ID:${String(traceId)}`);
      continue;
    }
    if (seen.has(traceId)) issues.push(`DUPLICATE_TRACE_ID:${traceId}`);
    seen.add(traceId);

    const source = expectedById.get(traceId)!;
    const verificationStatus = Reflect.get(row, "verificationStatus");
    if (verificationStatus !== source.verificationStatus) {
      issues.push(
        verificationStatus === "Verified"
          ? `STATUS_OVERCLAIM:${traceId}`
          : `STATUS_SOURCE_MISMATCH:${traceId}`,
      );
    }
    const openFindings = Reflect.get(row, "openFindings");
    if (
      !openFindings ||
      typeof openFindings !== "object" ||
      Reflect.get(openFindings, "status") !== "unknown" ||
      Reflect.get(openFindings, "value") !== null ||
      !String(Reflect.get(openFindings, "reason") ?? "").trim()
    ) {
      issues.push(`OPEN_FINDINGS_FALSE_COMPLETENESS:${traceId}`);
    }
  }

  for (const traceId of expectedById.keys()) {
    if (!seen.has(traceId)) issues.push(`MISSING_TRACE_ID:${traceId}`);
  }
  return [...new Set(issues)];
}

export function validateFinalTraceabilitySummary(
  summary: Readonly<Record<string, unknown>>,
  expected: FinalTraceabilitySummary,
) {
  const issues: string[] = [];
  const requiredMetrics = Object.values(FINAL_SUMMARY_METRIC_REQUIREMENTS);
  for (const metric of requiredMetrics) {
    if (!Object.prototype.hasOwnProperty.call(summary, metric)) {
      issues.push(`MISSING_METRIC:${metric}`);
      continue;
    }
    const actual = summary[metric];
    const expectedMetric = expected[metric];
    if (
      expectedMetric.status === "unknown" &&
      actual &&
      typeof actual === "object" &&
      Reflect.get(actual, "status") !== "unknown"
    ) {
      issues.push(`UNSUPPORTED_COMPLETE_METRIC:${metric}`);
    }
    if (JSON.stringify(actual) !== JSON.stringify(expectedMetric)) {
      issues.push(`METRIC_DRIFT:${metric}`);
    }
  }
  for (const metric of Object.keys(summary)) {
    if (!requiredMetrics.includes(metric as FinalSummaryMetricKey)) {
      issues.push(`UNKNOWN_METRIC:${metric}`);
    }
  }
  return [...new Set(issues)];
}

export function renderFinalTraceabilityMarkdown(
  rows: readonly FinalTraceabilityRow[],
  summary: FinalTraceabilitySummary,
) {
  const lines = [
    "# Security trace registry and final traceability report",
    "",
    "Status: **Partially verified — report structure verified; production release blocked**  ",
    "Authoritative records: `security/traces.ts`, `security/endpoints.ts`, `security/database-operations.ts`, `security/third-parties.ts`  ",
    "Generation contract: `security/final-traceability.ts`",
    "",
    "This report verifies that every current trace row records all 23 required fields and that all 21 required summary metrics are present. It does not claim complete action, API, query, finding, deployment or runtime coverage. `Unknown` is a deliberate fail-closed result with a concrete reason, not a zero.",
    "",
    "## Summary metrics",
    "",
    "| Metric | Status | Value | Scope and limitation | Evidence |",
    "|---|---|---:|---|---|",
  ];

  for (const [requirementId, metric] of Object.entries(
    FINAL_SUMMARY_METRIC_REQUIREMENTS,
  )) {
    const result = summary[metric];
    const value = result.value === null ? "Unknown" : String(result.value);
    const observed = result.observed
      ? ` Observed facets: ${JSON.stringify(result.observed)}.`
      : "";
    lines.push(
      `| \`${requirementId}\` | ${result.status} | ${value} | ${escapeMarkdownTable(`${result.scope}. ${result.reason}${observed}`)} | ${result.evidence.map((entry) => `\`${entry}\``).join("<br>")} |`,
    );
  }

  lines.push(
    "",
    "## Trace rows",
    "",
    `The matrix contains exactly ${rows.length} current seed rows. Every row remains bound to its source verification status. Missing trace coverage remains release-blocking.`,
    "",
  );

  for (const row of rows) {
    lines.push(
      `### \`${row.traceId}\``,
      "",
      "| Required field | Recorded value |",
      "|---|---|",
    );
    for (const [requirementId, field] of Object.entries(
      FINAL_TRACEABILITY_FIELD_REQUIREMENTS,
    )) {
      lines.push(
        `| \`${requirementId}\` | ${escapeMarkdownTable(renderValue(row[field]))} |`,
      );
    }
    lines.push("");
  }

  lines.push(
    "## Release boundary",
    "",
    "No row is `Verified`. The complete frontend-action inventory, deployed API parity, privileged-operation classification, finding-to-trace links, generated SQL/runtime roles, provider effects and production evidence remain incomplete. These are separate release blockers and are not closed by this report structure.",
    "",
  );
  return lines.join("\n");
}

function toFinalTraceabilityRow(
  trace: SecurityTraceContract,
): FinalTraceabilityRow {
  return {
    traceId: trace.traceId,
    productArea: trace.productArea,
    route: [...trace.routePatterns],
    userAction: trace.actionName,
    frontendSource: [...trace.frontend.sourceFiles],
    request: {
      ...trace.transport,
      requiredHeaders: [...trace.transport.requiredHeaders],
    },
    serverHandler: {
      sourceFiles: [...trace.server.entryFiles],
      handlers: [...trace.server.handlers],
    },
    authentication: {
      mode: trace.authentication,
      authenticationFunction: trace.server.authenticationFunction,
      sessionValidationFunction:
        trace.server.sessionValidationFunction ?? "not verified",
    },
    authorizationPolicy: {
      function: trace.server.authorizationPolicy,
      object: trace.server.objectAuthorizationPolicy ?? "not verified",
      property: trace.server.propertyAuthorizationPolicy ?? "not verified",
      requiredPermissions: [...trace.requiredPermissions],
      requiredRelationships: [...trace.requiredRelationships],
    },
    validationSchema: {
      client: [...trace.frontend.clientValidationSchemas],
      server: trace.server.requestValidationSchema,
    },
    service: trace.server.businessService,
    databaseQueryIds: trace.databaseOperations.map(
      (operation) => operation.queryId,
    ),
    databaseRole: unique(
      trace.databaseOperations.map((operation) => operation.databaseRole),
    ),
    tables: unique(
      trace.databaseOperations.flatMap((operation) => operation.tables),
    ),
    sensitiveData: [...trace.dataClassification],
    cacheEffects: trace.cacheOperations.map((operation) => ({
      ...operation,
      invalidationTriggers: [...operation.invalidationTriggers],
    })),
    backgroundEffects: trace.backgroundOperations.map((operation) => ({
      ...operation,
    })),
    externalEffects: trace.externalOperations.map((operation) => ({
      ...operation,
    })),
    auditEvent: [...trace.auditEvents],
    securityTests: [...trace.tests],
    openFindings: {
      status: "unknown",
      value: null,
      scope: `Open findings linked to ${trace.traceId}`,
      reason:
        "No authoritative machine finding-to-trace registry exists; an empty list would falsely imply no open finding.",
      evidence: ["docs/security/risk-register.md"],
    },
    verificationStatus: trace.verificationStatus,
    owner: trace.owner,
  };
}

function knownMetric(
  value: number,
  scope: string,
  reason: string,
  evidence: readonly string[],
): FinalSummaryMetric {
  return { status: "known", value, scope, reason, evidence };
}

function partialMetric(
  value: number,
  scope: string,
  reason: string,
  evidence: readonly string[],
  observed?: Readonly<Record<string, number>>,
): FinalSummaryMetric {
  return {
    status: "partial",
    value,
    scope,
    reason,
    evidence,
    ...(observed ? { observed } : {}),
  };
}

function unknownMetric(
  scope: string,
  reason: string,
  evidence: readonly string[],
  observed?: Readonly<Record<string, number>>,
): FinalSummaryMetric {
  return {
    status: "unknown",
    value: null,
    scope,
    reason,
    evidence,
    ...(observed ? { observed } : {}),
  };
}

function unique(values: readonly string[]) {
  return [...new Set(values)];
}

function renderValue(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function escapeMarkdownTable(value: string) {
  return value.replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
}
