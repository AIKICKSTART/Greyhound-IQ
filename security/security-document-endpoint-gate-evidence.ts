import type { SecurityRequirementStatus } from "../src/components/security-master-requirements";

export const SECURITY_DOCUMENT_ENDPOINT_GATE_EVIDENCE_FILE =
  "security/security-document-endpoint-gate-evidence.ts" as const;
export const SECURITY_DOCUMENT_ENDPOINT_GATE_TEST_FILE =
  "security/security-document-endpoint-gate-evidence.test.ts" as const;

export const SECURITY_DOCUMENT_ENDPOINT_GATE_REQUIREMENT_IDS = [
  "security.ci.27.security-doc-missing-endpoint",
] as const;

export const SECURITY_DOCUMENT_ENDPOINT_GATE_EXPECTED_GAIN =
  SECURITY_DOCUMENT_ENDPOINT_GATE_REQUIREMENT_IDS.length;

export const SECURITY_DOCUMENT_ENDPOINT_GATE_SCOPE =
  "Repository-local CI governance for API endpoint references in every Markdown file below docs/security and every source file with tour in its filename. The pure validator extracts active /api references, normalizes query strings and brace-style dynamic parameters, checks optional documented HTTP methods, and accepts wildcard references only when at least one concrete registered route exists below the prefix. Explicitly historical or negative mentions, source-file paths, and external URLs are classified outside the active-reference set. The security unit runner discovers this test automatically and the existing CI command runs that suite. Synthetic missing-route and wrong-method fixtures fail closed. This proves current source and documentation consistency only; it does not prove deployed routing, runtime authorization, provider behavior, production traffic, or external branch protection.";

export type SecurityDocumentSource = {
  path: string;
  content: string;
};

export type RegisteredApiEndpoint = {
  method: string;
  route: string;
};

export type SecurityDocumentEndpointReference = {
  sourcePath: string;
  line: number;
  route: string;
  method: string | null;
};

export type SecurityDocumentEndpointIssue =
  SecurityDocumentEndpointReference & {
    reason: "missing-route" | "missing-method";
  };

export type SecurityDocumentEndpointGateResult = {
  references: readonly SecurityDocumentEndpointReference[];
  issues: readonly SecurityDocumentEndpointIssue[];
};

const API_REFERENCE_PATTERN =
  /\/api(?:\/(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*|\[[A-Za-z0-9_]+\]|\{[A-Za-z0-9_]+\}|\*{1,2}))*\/?(?:\?[A-Za-z0-9_.=&|\\-]+)?/g;
const HTTP_METHOD_PATTERN = /\b(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+`?$/i;

export function evaluateSecurityDocumentEndpointGate(
  documents: readonly SecurityDocumentSource[],
  registeredEndpoints: readonly RegisteredApiEndpoint[],
): SecurityDocumentEndpointGateResult {
  const normalizedEndpoints = registeredEndpoints.map((endpoint) => ({
    method: endpoint.method.toUpperCase(),
    route: normalizeRoute(endpoint.route),
  }));
  const references = documents.flatMap(extractActiveApiReferences);
  const issues = references.flatMap(
    (reference): SecurityDocumentEndpointIssue[] => {
      const routeMatches = normalizedEndpoints.filter((endpoint) =>
        routeMatchesReference(endpoint.route, reference.route),
      );
      if (routeMatches.length === 0) {
        return [{ ...reference, reason: "missing-route" }];
      }
      if (
        reference.method &&
        !routeMatches.some((endpoint) => endpoint.method === reference.method)
      ) {
        return [{ ...reference, reason: "missing-method" }];
      }
      return [];
    },
  );

  return { references, issues };
}

function extractActiveApiReferences(
  document: SecurityDocumentSource,
): SecurityDocumentEndpointReference[] {
  const references: SecurityDocumentEndpointReference[] = [];
  for (const match of document.content.matchAll(API_REFERENCE_PATTERN)) {
    const index = match.index;
    if (index === undefined || isEmbeddedReference(document.content, index)) {
      continue;
    }
    const route = normalizeRoute(match[0]);
    if (isExplicitlyNonCurrent(document.content, index, match[0].length)) {
      continue;
    }
    const lineStart = document.content.lastIndexOf("\n", index - 1) + 1;
    const beforeOnLine = document.content.slice(lineStart, index);
    const method = beforeOnLine.match(HTTP_METHOD_PATTERN)?.[1]?.toUpperCase() ?? null;
    const line = countLines(document.content, index);
    references.push({ sourcePath: document.path, line, route, method });
  }
  return references;
}

function isEmbeddedReference(content: string, index: number) {
  const previous = content[index - 1] ?? "";
  return /[A-Za-z0-9_.-]/.test(previous);
}

function isExplicitlyNonCurrent(
  content: string,
  index: number,
  matchLength: number,
) {
  const before = content.slice(Math.max(0, index - 220), index);
  const after = content.slice(index + matchLength, index + matchLength + 100);
  const negativeLead =
    /(?:removed|retired|nonexistent|does not exist|no)\b[\s\S]{0,200}$/i.test(
      before,
    );
  const endpointNoun = /\b(?:route|handler|endpoint|operation)\b/i.test(
    `${before.slice(-80)} ${after}`,
  );
  return negativeLead && endpointNoun;
}

function normalizeRoute(route: string) {
  const withoutQuery = route.split(/[?#]/, 1)[0];
  const normalizedDynamicParameters = withoutQuery.replace(
    /\{([A-Za-z0-9_]+)\}/g,
    "[$1]",
  );
  if (
    normalizedDynamicParameters === "/api" ||
    normalizedDynamicParameters === "/api/"
  ) {
    return "/api/";
  }
  return normalizedDynamicParameters.replace(/\/+$/, "");
}

function routeMatchesReference(registeredRoute: string, referenceRoute: string) {
  if (referenceRoute.endsWith("/**")) {
    return registeredRoute.startsWith(referenceRoute.slice(0, -2));
  }
  if (referenceRoute.endsWith("/*")) {
    return registeredRoute.startsWith(referenceRoute.slice(0, -1));
  }
  if (referenceRoute === "/api/") return registeredRoute.startsWith("/api/");
  return registeredRoute === referenceRoute;
}

function countLines(content: string, index: number) {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (content.charCodeAt(cursor) === 10) line += 1;
  }
  return line;
}

type SecurityDocumentEndpointGateEvidenceRecord = {
  status: SecurityRequirementStatus;
  evidence: readonly string[];
};

const COMMON_EVIDENCE = [
  SECURITY_DOCUMENT_ENDPOINT_GATE_EVIDENCE_FILE,
  SECURITY_DOCUMENT_ENDPOINT_GATE_TEST_FILE,
  "security/endpoints.ts",
  "scripts/run-unit-tests.ts",
  ".github/workflows/ci.yml",
  "package.json",
] as const;

export const SECURITY_DOCUMENT_ENDPOINT_GATE_MASTER_EVIDENCE = {
  "security.ci.27.security-doc-missing-endpoint": {
    status: "verified",
    evidence: COMMON_EVIDENCE,
  },
} as const satisfies Readonly<
  Record<
    (typeof SECURITY_DOCUMENT_ENDPOINT_GATE_REQUIREMENT_IDS)[number],
    SecurityDocumentEndpointGateEvidenceRecord
  >
>;
