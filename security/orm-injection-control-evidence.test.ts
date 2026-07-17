import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { auditProductionSqlSafety } from "../scripts/check-production-sql-safety";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import { auditDeserializationSources } from "./deserialization-control-evidence";
import {
  ORM_INJECTION_CONTROL_MASTER_EVIDENCE,
  ORM_INJECTION_CONTROL_REQUIREMENT_ID,
  auditOrmInjectionSources,
  type OrmInjectionSource,
} from "./orm-injection-control-evidence";

const productionSources = collectProductionSources("src");
assert.deepEqual(auditOrmInjectionSources(productionSources), []);
assert.deepEqual(auditDeserializationSources(productionSources), []);
const sqlAudit = auditProductionSqlSafety();
assert.deepEqual(sqlAudit.violations, []);
assert.ok(sqlAudit.safeRawOperationCount > 0);

const requirement = MASTER_AUDIT_REQUIREMENTS.find(
  (candidate) => candidate.id === ORM_INJECTION_CONTROL_REQUIREMENT_ID,
);
assert.ok(requirement, "ORM-injection requirement must remain immutable");
assert.deepEqual(
  SECURITY_MASTER_EVIDENCE[ORM_INJECTION_CONTROL_REQUIREMENT_ID],
  ORM_INJECTION_CONTROL_MASTER_EVIDENCE[ORM_INJECTION_CONTROL_REQUIREMENT_ID],
);
assert.equal(isMasterRequirementComplete(requirement), true);

for (const fixture of [
  {
    path: "src/lib/open-schema.ts",
    source: "const schema = z.object({ id: z.string() }).passthrough();",
    issue: "OPEN_OBJECT_SCHEMA:src/lib/open-schema.ts",
  },
  {
    path: "src/lib/arbitrary-schema.ts",
    source: "const schema = z.record(z.string(), z.unknown());",
    issue: "ARBITRARY_KEY_SCHEMA:src/lib/arbitrary-schema.ts",
  },
  {
    path: "src/lib/dynamic-query.ts",
    source:
      "async function run(input: { field: string; value: string }) { return prisma.user.findMany({ where: { [input.field]: input.value } }); }",
    issue: "ORM_DYNAMIC_KEY:src/lib/dynamic-query.ts:[input.field]",
  },
  {
    path: "src/lib/spread-query.ts",
    source:
      "async function run(input: object) { return prisma.user.findMany({ where: { ...input } }); }",
    issue: "ORM_UNTRUSTED_SPREAD:src/lib/spread-query.ts",
  },
  {
    path: "src/app/api/direct-query/route.ts",
    source:
      "export async function POST(request: Request) { return prisma.user.findMany(await request.json()); }",
    issue: "ORM_DIRECT_REQUEST_BODY:src/app/api/direct-query/route.ts",
  },
]) {
  assert.ok(
    auditOrmInjectionSources([...productionSources, fixture]).includes(
      fixture.issue,
    ),
  );
}

console.log(
  `ORM-injection control passed: closed object schemas, explicit query shapes, schema-bound JSON and ${sqlAudit.safeRawOperationCount} parameterized raw operations.`,
);

function collectProductionSources(directory: string): OrmInjectionSource[] {
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
