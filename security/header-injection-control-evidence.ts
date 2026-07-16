import ts from "typescript";

export const HEADER_INJECTION_CONTROL_REQUIREMENT_ID =
  "security.injection-prevention.prevent-header";

export type HeaderInjectionSource = {
  readonly path: string;
  readonly source: string;
};

const RAW_HTTP_MODULES = new Set([
  "http",
  "http2",
  "https",
  "node:http",
  "node:http2",
  "node:https",
  "node:tls",
  "tls",
]);
const REVIEWED_NET_IMPORTS = new Map<string, readonly string[]>([
  ["src/lib/link-preview.ts", ["BlockList", "LookupFunction", "isIP"]],
  ["src/lib/live/replay-network.ts", ["LookupFunction", "isIP"]],
]);

const REQUIRED_HEADER_BOUNDARIES = [
  {
    path: "src/app/api/replay/stream/handler.ts",
    markers: [
      'copyHeader(upstream, headers, "content-type")',
      'copyHeader(upstream, headers, "content-length")',
      'copyHeader(upstream, headers, "content-range")',
      'copyHeader(upstream, headers, "accept-ranges")',
      "if (value) setSafeHttpHeader(to, name, value)",
      "normalizeReplayRange(rangeHeader)",
    ],
  },
  {
    path: "src/app/api/media/[id]/blob/route.ts",
    markers: [
      '"Content-Type": delivery.mimeType',
      '"Content-Disposition": "inline"',
      'headers.set("Content-Range", delivery.contentRange)',
    ],
  },
  {
    path: "src/lib/media-validation.ts",
    markers: [
      "value in MEDIA_MIME_LIMITS",
      "message: \"Unsupported media type\"",
    ],
  },
  {
    path: "src/proxy.ts",
    markers: [
      "const requestHeaders = new Headers(request.headers)",
      "response.headers.forEach((value, key) => rw.headers.set(key, value))",
    ],
  },
] as const;

export function auditHeaderInjectionSources(
  sources: readonly HeaderInjectionSource[],
) {
  const issues: string[] = [];

  for (const item of sources) {
    const sourceFile = ts.createSourceFile(
      item.path,
      item.source,
      ts.ScriptTarget.Latest,
      true,
      item.path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );

    for (const statement of sourceFile.statements) {
      if (
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        RAW_HTTP_MODULES.has(statement.moduleSpecifier.text)
      ) {
        issues.push(`RAW_HTTP_IMPORT:${item.path}:${statement.moduleSpecifier.text}`);
      }
      if (
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        (statement.moduleSpecifier.text === "node:net" ||
          statement.moduleSpecifier.text === "net")
      ) {
        const bindings = statement.importClause?.namedBindings;
        const imported =
          bindings && ts.isNamedImports(bindings)
            ? bindings.elements
                .map((element) => (element.propertyName ?? element.name).text)
                .toSorted()
            : [];
        const expected = REVIEWED_NET_IMPORTS.get(item.path);
        if (!expected || imported.join("|") !== [...expected].toSorted().join("|")) {
          issues.push(`RAW_NET_IMPORT:${item.path}`);
        }
      }
    }

    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const expression = node.expression;
        const firstArgument = node.arguments[0];
        if (
          (expression.kind === ts.SyntaxKind.ImportKeyword ||
            (ts.isIdentifier(expression) && expression.text === "require")) &&
          firstArgument &&
          ts.isStringLiteral(firstArgument) &&
          (RAW_HTTP_MODULES.has(firstArgument.text) ||
            firstArgument.text === "node:net" ||
            firstArgument.text === "net")
        ) {
          issues.push(`RAW_HTTP_DYNAMIC_IMPORT:${item.path}:${firstArgument.text}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  for (const boundary of REQUIRED_HEADER_BOUNDARIES) {
    const item = sources.find((candidate) => candidate.path === boundary.path);
    if (!item) {
      issues.push(`HEADER_BOUNDARY_MISSING:${boundary.path}`);
      continue;
    }
    for (const marker of boundary.markers) {
      if (!item.source.includes(marker)) {
        issues.push(`HEADER_MARKER_MISSING:${boundary.path}:${marker}`);
      }
    }
  }

  return [...new Set(issues)].toSorted();
}

const HEADER_INJECTION_CONTROL_EVIDENCE = [
  "security/header-injection-control-evidence.ts",
  "security/header-injection-control-evidence.test.ts",
  "src/lib/http-header-security.ts",
  "src/lib/http-header-security.test.ts",
  "src/app/api/replay/stream/handler.ts",
  "src/app/api/replay/stream/route.ts",
  "src/app/api/replay/stream/route.test.ts",
  "src/app/api/media/[id]/blob/route.ts",
  "src/lib/media-validation.ts",
  "src/proxy.ts",
] as const;

export const HEADER_INJECTION_CONTROL_MASTER_EVIDENCE = {
  [HEADER_INJECTION_CONTROL_REQUIREMENT_ID]: {
    status: "verified" as const,
    evidence: HEADER_INJECTION_CONTROL_EVIDENCE,
  },
};
