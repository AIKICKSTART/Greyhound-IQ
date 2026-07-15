import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import {
  MAX_COLLECTION_QUERY_ROWS,
  auditCollectionQueryBounds,
  type CollectionQuerySource,
} from "./collection-query-bound-evidence";

const productionSources = collectProductionSources("src");
const audit = auditCollectionQueryBounds(productionSources);
assert.deepEqual(audit.issues, []);
assert.ok(audit.records.length > 0);
assert.ok(audit.records.some((record) => record.method === "findMany"));
assert.ok(audit.records.some((record) => record.method === "groupBy"));
assert.ok(
  audit.records.every(
    (record) =>
      record.maximumRows >= 1 &&
      record.maximumRows <= MAX_COLLECTION_QUERY_ROWS,
  ),
);

for (const fixture of [
  {
    name: "missing bound",
    source: "prisma.user.findMany({ where: { active: true } });",
    issue: "COLLECTION_TAKE_COUNT:0",
  },
  {
    name: "request-controlled bound",
    source: "prisma.user.findMany({ take: requestLimit });",
    issue: "COLLECTION_TAKE_NOT_ENFORCED:requestLimit",
  },
  {
    name: "negative request-controlled bound",
    source: "prisma.user.findMany({ take: Math.min(requestLimit, 50) });",
    issue: "COLLECTION_TAKE_NOT_ENFORCED:Math.min(requestLimit, 50)",
  },
  {
    name: "excessive bound",
    source: `prisma.user.findMany({ take: ${MAX_COLLECTION_QUERY_ROWS + 1} });`,
    issue: `COLLECTION_TAKE_NOT_ENFORCED:${MAX_COLLECTION_QUERY_ROWS + 1}`,
  },
  {
    name: "spread-hidden query shape",
    source: "prisma.user.findMany({ ...query, take: 50 });",
    issue: "COLLECTION_ARGUMENT_SPREAD",
  },
  {
    name: "element-access bypass",
    source: 'prisma.user["findMany"]({ take: 50 });',
    issue: "COLLECTION_ELEMENT_ACCESS",
  },
  {
    name: "method-reference bypass",
    source: "const query = prisma.user.findMany; query({ take: 50 });",
    issue: "COLLECTION_METHOD_REFERENCE",
  },
  {
    name: "destructuring bypass",
    source: "const { findMany } = prisma.user; findMany({ take: 50 });",
    issue: "COLLECTION_METHOD_DESTRUCTURE",
  },
  {
    name: "mutable bound bypass",
    source:
      "let MUTABLE_LIMIT = 50; MUTABLE_LIMIT = requestLimit; prisma.user.findMany({ take: MUTABLE_LIMIT });",
    issue: "COLLECTION_TAKE_NOT_ENFORCED:MUTABLE_LIMIT",
  },
  {
    name: "shadowed constant bypass",
    source:
      "const SAFE_LIMIT = 50; function read(SAFE_LIMIT: number) { return prisma.user.findMany({ take: SAFE_LIMIT }); }",
    issue: "COLLECTION_TAKE_NOT_ENFORCED:SAFE_LIMIT",
  },
]) {
  const result = auditCollectionQueryBounds([
    ...productionSources,
    { path: `src/lib/${fixture.name.replaceAll(" ", "-")}.ts`, source: fixture.source },
  ]);
  assert.ok(
    result.issues.some((issue) => issue.includes(fixture.issue)),
    `${fixture.name}: ${result.issues.join(", ")}`,
  );
}

assert.ok(
  auditCollectionQueryBounds([
    {
      path: "src/lib/remote-constant.ts",
      source: "export const REMOTE_ONLY_LIMIT = 50;",
    },
    {
      path: "src/lib/cross-file-name-bypass.ts",
      source: "prisma.user.findMany({ take: REMOTE_ONLY_LIMIT });",
    },
  ]).issues.some((issue) =>
    issue.includes("COLLECTION_TAKE_NOT_ENFORCED:REMOTE_ONLY_LIMIT"),
  ),
);

assert.deepEqual(
  auditCollectionQueryBounds([
    {
      path: "src/lib/clamped.ts",
      source:
        "prisma.user.findMany({ take: Math.min(Math.max(1, requestLimit), 50) });",
    },
    {
      path: "src/lib/constant.ts",
      source:
        "const LIMIT = 100; prisma.user.findMany({ take: LIMIT }); prisma.user.groupBy({ by: ['role'], orderBy: { role: 'asc' }, take: LIMIT });",
    },
  ]).issues,
  [],
);

console.log(
  `Collection-query bound control passed: ${audit.records.length} exhaustive production findMany/groupBy reads capped at ${MAX_COLLECTION_QUERY_ROWS} rows or fewer.`,
);

function collectProductionSources(directory: string): CollectionQuerySource[] {
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
