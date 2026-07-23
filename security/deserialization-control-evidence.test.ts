import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  DESERIALIZATION_CONTROL_MASTER_EVIDENCE,
  DESERIALIZATION_CONTROL_REQUIREMENT_ID,
  auditDeserializationSources,
  type DeserializationSource,
} from "./deserialization-control-evidence";

const productionSources = collectProductionSources("src");
assert.deepEqual(auditDeserializationSources(productionSources), []);

const requirement = MASTER_AUDIT_REQUIREMENTS.find(
  (candidate) => candidate.id === DESERIALIZATION_CONTROL_REQUIREMENT_ID,
);
assert.ok(requirement, "unsafe-deserialization requirement must remain immutable");
assert.deepEqual(
  SECURITY_MASTER_EVIDENCE[DESERIALIZATION_CONTROL_REQUIREMENT_ID],
  DESERIALIZATION_CONTROL_MASTER_EVIDENCE[
    DESERIALIZATION_CONTROL_REQUIREMENT_ID
  ],
);
assert.equal(isMasterRequirementComplete(requirement), true);

const unvalidatedIssues = auditDeserializationSources([
  ...productionSources,
  {
    path: "src/app/api/unsafe/route.ts",
    source:
      "export async function POST(request: Request) { const body = await request.json(); return body; }",
  },
]);
assert.ok(
  unvalidatedIssues.includes(
    "JSON_BODY_WITHOUT_SCHEMA:src/app/api/unsafe/route.ts",
  ),
);

const unvalidatedBoundedIssues = auditDeserializationSources([
  ...productionSources,
  {
    path: "src/app/api/unsafe-bounded/route.ts",
    source: [
      'import { readBoundedJsonRequest } from "@/lib/json-request";',
      "export async function POST(request: Request) {",
      "  return readBoundedJsonRequest(request);",
      "}",
    ].join("\n"),
  },
]);
assert.ok(
  unvalidatedBoundedIssues.includes(
    "JSON_BODY_WITHOUT_SCHEMA:src/app/api/unsafe-bounded/route.ts",
  ),
);

const staleBindingIssues = auditDeserializationSources(
  productionSources.map((item) =>
    item.path === "src/app/api/billing/checkout/route.ts"
      ? {
          ...item,
          source: item.source.replace(
            "checkoutRequestSchema.parse(",
            "otherSchema.parse(",
          ),
        }
      : item,
  ),
);
assert.ok(
  staleBindingIssues.includes(
    "BOUNDED_JSON_BINDING_STALE:src/app/api/billing/checkout/route.ts:readBoundedJsonOrFormRequest:checkoutRequestSchema",
  ),
);

for (const fixture of [
  {
    path: "src/lib/unsafe-serializer.ts",
    source: 'import serializer from "node-serialize";\nserializer.unserialize(input);',
    issue: "PROHIBITED_DESERIALIZER_IMPORT:src/lib/unsafe-serializer.ts",
  },
  {
    path: "src/lib/unsafe-eval.ts",
    source: "export const run = (input: string) => eval(input);",
    issue: "DYNAMIC_EVAL:src/lib/unsafe-eval.ts",
  },
  {
    path: "src/lib/unsafe-function.ts",
    source: 'export const run = (input: string) => new Function("return " + input)();',
    issue: "DYNAMIC_FUNCTION:src/lib/unsafe-function.ts",
  },
]) {
  assert.ok(
    auditDeserializationSources([...productionSources, fixture]).includes(
      fixture.issue,
    ),
  );
}

const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
  dependencies?: Record<string, string>;
};
for (const packageName of [
  "node-serialize",
  "serialize-javascript",
  "php-serialize",
]) {
  assert.equal(
    Object.prototype.hasOwnProperty.call(manifest.dependencies ?? {}, packageName),
    false,
    `${packageName}: executable deserializer requires a security review`,
  );
}

console.log(
  "Deserialization control passed: every bounded request body is schema-bound, both critical reader bindings are registered, and executable deserializers are prohibited.",
);

function collectProductionSources(directory: string): DeserializationSource[] {
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
