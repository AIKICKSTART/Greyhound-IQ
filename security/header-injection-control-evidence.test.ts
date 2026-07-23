import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  HEADER_INJECTION_CONTROL_MASTER_EVIDENCE,
  HEADER_INJECTION_CONTROL_REQUIREMENT_ID,
  auditHeaderInjectionSources,
  type HeaderInjectionSource,
} from "./header-injection-control-evidence";

const productionSources = collectProductionSources("src");
assert.deepEqual(auditHeaderInjectionSources(productionSources), []);

const requirement = MASTER_AUDIT_REQUIREMENTS.find(
  (candidate) => candidate.id === HEADER_INJECTION_CONTROL_REQUIREMENT_ID,
);
assert.ok(requirement, "header-injection requirement must remain immutable");
assert.deepEqual(
  SECURITY_MASTER_EVIDENCE[HEADER_INJECTION_CONTROL_REQUIREMENT_ID],
  HEADER_INJECTION_CONTROL_MASTER_EVIDENCE[
    HEADER_INJECTION_CONTROL_REQUIREMENT_ID
  ],
);
assert.equal(isMasterRequirementComplete(requirement), true);

for (const fixture of [
  {
    path: "src/lib/raw-http.ts",
    source: 'import { createServer } from "node:http";\ncreateServer();',
    issue: "RAW_HTTP_IMPORT:src/lib/raw-http.ts:node:http",
  },
  {
    path: "src/lib/raw-http-dynamic.ts",
    source: 'const http = await import("node:http2");\n',
    issue: "RAW_HTTP_DYNAMIC_IMPORT:src/lib/raw-http-dynamic.ts:node:http2",
  },
]) {
  assert.ok(
    auditHeaderInjectionSources([...productionSources, fixture]).includes(
      fixture.issue,
    ),
  );
}

const replayWithoutGuard = productionSources.map((item) =>
  item.path === "src/app/api/replay/stream/handler.ts"
    ? {
        ...item,
        source: item.source.replace(
          "if (value) setSafeHttpHeader(to, name, value)",
          "if (value) to.set(name, value)",
        ),
      }
    : item,
);
assert.ok(
  auditHeaderInjectionSources(replayWithoutGuard).some((issue) =>
    issue.startsWith(
      "HEADER_MARKER_MISSING:src/app/api/replay/stream/handler.ts:",
    ),
  ),
);

console.log(
  "Header-injection control passed: Web Headers only, explicit upstream allowlist, CRLF guard, normalized Range and no raw HTTP bypass.",
);

function collectProductionSources(directory: string): HeaderInjectionSource[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Unsupported symbolic link under production source: ${fullPath}`);
      }
      if (entry.isDirectory()) return collectProductionSources(fullPath);
      if (
        !/\.(?:c|m)?(?:j|t)sx?$/.test(entry.name) ||
        /\.(?:test|spec)\.(?:c|m)?(?:j|t)sx?$/.test(entry.name)
      ) {
        return [];
      }
      return [
        {
          path: relative(process.cwd(), fullPath).replaceAll("\\", "/"),
          source: readFileSync(fullPath, "utf8"),
        },
      ];
    })
    .toSorted((left, right) => left.path.localeCompare(right.path));
}
