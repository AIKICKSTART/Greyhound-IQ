export type ExpectedDemoRouteAuditRow = {
  family: string;
  route: string;
  samplePath: string;
};

export type DemoRouteAuditEvaluation = {
  valid: boolean;
  generatedAt: string | null;
  testedCommitSha: string | null;
  sourceSha256: string | null;
  sourceFileCount: number | null;
  summary: {
    expected: number;
    passed: number;
    failed: number;
  } | null;
  passedRoutes: readonly string[];
  failedRoutes: readonly string[];
  structuralIssues: readonly string[];
};

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/;
const CANONICAL_BASE_URL = "http://localhost:3000";

export function evaluateDemoRouteAuditEvidence(
  value: unknown,
  expectedRows: readonly ExpectedDemoRouteAuditRow[]
): DemoRouteAuditEvaluation {
  const issues: string[] = [];
  const expectedByRoute = new Map(
    expectedRows.map((row) => [row.route, row] as const)
  );
  if (expectedByRoute.size !== expectedRows.length) {
    issues.push("Expected route inventory contains duplicate routes.");
  }

  const audit = asRecord(value);
  if (!audit) {
    return invalid(expectedRows, ["Route audit must be an object."]);
  }
  const generatedAt =
    typeof audit.generatedAt === "string" ? audit.generatedAt : null;
  const testedCommitSha =
    typeof audit.testedCommitSha === "string"
      ? audit.testedCommitSha.toLowerCase()
      : null;
  const sourceSha256 =
    typeof audit.sourceSha256 === "string"
      ? audit.sourceSha256.toLowerCase()
      : null;
  const sourceFileCount = isNonNegativeInteger(audit.sourceFileCount)
    ? audit.sourceFileCount
    : null;
  if (
    audit.schemaVersion !== 2 ||
    audit.baseUrl !== CANONICAL_BASE_URL ||
    !generatedAt ||
    !ISO_TIMESTAMP.test(generatedAt) ||
    !Number.isFinite(Date.parse(generatedAt)) ||
    !testedCommitSha ||
    !/^[a-f0-9]{40}$/.test(testedCommitSha) ||
    !sourceSha256 ||
    !/^[a-f0-9]{64}$/.test(sourceSha256) ||
    sourceFileCount === null ||
    sourceFileCount < 1
  ) {
    issues.push("Route audit metadata is not canonical.");
  }
  if (
    !isNonNegativeInteger(audit.expected) ||
    !isNonNegativeInteger(audit.passed) ||
    !isNonNegativeInteger(audit.failed) ||
    !Array.isArray(audit.results)
  ) {
    issues.push("Route audit totals or results have an invalid shape.");
    return invalid(expectedRows, issues, {
      generatedAt,
      testedCommitSha,
      sourceSha256,
      sourceFileCount,
    });
  }
  const summary = {
    expected: audit.expected,
    passed: audit.passed,
    failed: audit.failed,
  };
  if (audit.expected !== expectedRows.length) {
    issues.push(
      `Route audit expected ${audit.expected}; inventory contains ${expectedRows.length}.`
    );
  }
  if (audit.results.length !== expectedRows.length) {
    issues.push(
      `Route audit contains ${audit.results.length} rows; inventory contains ${expectedRows.length}.`
    );
  }

  const rowCounts = new Map<string, number>();
  const passedRoutes: string[] = [];
  let rowPassCount = 0;
  for (const rawRow of audit.results) {
    const row = asRecord(rawRow);
    if (!isRouteRow(row)) {
      issues.push("Route audit contains a row with an invalid shape.");
      continue;
    }
    rowCounts.set(row.route, (rowCounts.get(row.route) ?? 0) + 1);
    const expected = expectedByRoute.get(row.route);
    if (!expected) {
      issues.push(`Route audit contains unregistered route ${row.route}.`);
      continue;
    }
    if (row.family !== expected.family || row.samplePath !== expected.samplePath) {
      issues.push(`${row.route} family or sample path disagrees with the registry.`);
    }

    const computedPass =
      row.status === 200 &&
      row.demoHeader === "full-access-read-only" &&
      row.hasMain === true &&
      row.hasH1 === true &&
      row.hasReactStreamError === false &&
      row.errorMarkers.length === 0 &&
      row.error === null &&
      isCanonicalFinalUrl(row.finalUrl);
    if (row.passed !== computedPass) {
      issues.push(`${row.route} passed flag contradicts its raw audit fields.`);
    }
    if (row.passed) rowPassCount += 1;
    if (computedPass && row.passed) passedRoutes.push(row.route);
  }

  for (const expected of expectedRows) {
    const count = rowCounts.get(expected.route) ?? 0;
    if (count !== 1) {
      issues.push(`${expected.route} has ${count} audit rows; exactly one is required.`);
    }
  }
  if (
    audit.passed !== rowPassCount ||
    audit.failed !== audit.results.length - rowPassCount ||
    audit.passed + audit.failed !== audit.results.length
  ) {
    issues.push("Route audit totals contradict its rows.");
  }

  if (issues.length > 0) {
    return invalid(
      expectedRows,
      issues,
      { generatedAt, testedCommitSha, sourceSha256, sourceFileCount },
      summary
    );
  }
  const passed = new Set(passedRoutes);
  return {
    valid: true,
    generatedAt,
    testedCommitSha,
    sourceSha256,
    sourceFileCount,
    summary,
    passedRoutes: expectedRows
      .filter((row) => passed.has(row.route))
      .map((row) => row.route),
    failedRoutes: expectedRows
      .filter((row) => !passed.has(row.route))
      .map((row) => row.route),
    structuralIssues: [],
  };
}

function invalid(
  expectedRows: readonly ExpectedDemoRouteAuditRow[],
  structuralIssues: readonly string[],
  metadata: {
    generatedAt: string | null;
    testedCommitSha: string | null;
    sourceSha256: string | null;
    sourceFileCount: number | null;
  } = {
    generatedAt: null,
    testedCommitSha: null,
    sourceSha256: null,
    sourceFileCount: null,
  },
  summary: DemoRouteAuditEvaluation["summary"] = null
): DemoRouteAuditEvaluation {
  return {
    valid: false,
    ...metadata,
    summary,
    passedRoutes: [],
    failedRoutes: expectedRows.map((row) => row.route),
    structuralIssues,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isRouteRow(row: Record<string, unknown> | null): row is {
  family: string;
  route: string;
  samplePath: string;
  finalUrl: string;
  status: number | null;
  durationMs: number;
  demoHeader: string | null;
  hasMain: boolean;
  hasH1: boolean;
  hasReactStreamError: boolean;
  errorMarkers: string[];
  passed: boolean;
  error: string | null;
} {
  return Boolean(
    row &&
      typeof row.family === "string" &&
      typeof row.route === "string" &&
      typeof row.samplePath === "string" &&
      typeof row.finalUrl === "string" &&
      (row.status === null || typeof row.status === "number") &&
      typeof row.durationMs === "number" &&
      row.durationMs >= 0 &&
      (row.demoHeader === null || typeof row.demoHeader === "string") &&
      typeof row.hasMain === "boolean" &&
      typeof row.hasH1 === "boolean" &&
      typeof row.hasReactStreamError === "boolean" &&
      Array.isArray(row.errorMarkers) &&
      row.errorMarkers.every((marker) => typeof marker === "string") &&
      typeof row.passed === "boolean" &&
      (row.error === null || typeof row.error === "string")
  );
}

function isCanonicalFinalUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.origin === CANONICAL_BASE_URL &&
      !url.pathname.startsWith("/sign-in")
    );
  } catch {
    return false;
  }
}
