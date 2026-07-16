import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { MASTER_AUDIT_REQUIREMENTS, isMasterRequirementComplete } from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import { AUDIT_EVENTS } from "./audit-events";
import {
  DESTRUCTIVE_ACTION_AUDIT_REQUIREMENT_ID,
  PRODUCTION_DESTRUCTIVE_ACTION_CLASSIFICATIONS,
  auditDestructiveActionCoverage,
  discoverDestructiveActions,
  type DestructiveActionSource,
} from "./destructive-action-audit-coverage";

const audit = auditDestructiveActionCoverage(
  collectProductionSources("src"),
  AUDIT_EVENTS,
);
assert.deepEqual(audit.issues, []);
assert.equal(
  audit.actions.length,
  PRODUCTION_DESTRUCTIVE_ACTION_CLASSIFICATIONS.length,
);
assert.ok(
  audit.actions.some(
    (action) => action.actionId === "src/lib/custom-page-service.ts:385:customPage.delete",
  ),
);
assert.ok(
  audit.actions.every((action) => !action.path.includes("-probe.")),
  "probe and cleanup fixture sources are not production actions",
);

const ciRequirement = MASTER_AUDIT_REQUIREMENTS.find(
  (candidate) => candidate.id === DESTRUCTIVE_ACTION_AUDIT_REQUIREMENT_ID,
);
assert.ok(ciRequirement, `${DESTRUCTIVE_ACTION_AUDIT_REQUIREMENT_ID}: immutable requirement missing`);
assert.equal(isMasterRequirementComplete(ciRequirement), true);
assert.equal(
  SECURITY_MASTER_EVIDENCE[DESTRUCTIVE_ACTION_AUDIT_REQUIREMENT_ID]?.status,
  "verified",
);

const fixtureActions = discoverDestructiveActions({
  path: "src/lib/new-delete.ts",
  source:
    "export async function erase() { await tx.account.delete({ where: { id: 'x' } }); }",
});
assert.equal(fixtureActions.length, 1);
assert.equal(fixtureActions[0].hasAuditWrite, false);
assert.ok(
  auditDestructiveActionCoverage(
    [
      ...collectProductionSources("src"),
      {
        path: "src/lib/new-delete.ts",
        source:
          "export async function erase() { await tx.account.delete({ where: { id: 'x' } }); }",
      },
    ],
    AUDIT_EVENTS,
  ).issues.includes(
    "src/lib/new-delete.ts:1:account.delete:UNCLASSIFIED_DESTRUCTIVE_ACTION",
  ),
  "a newly discovered hard delete must be classified before CI can pass",
);
assert.deepEqual(
  discoverDestructiveActions({
    path: "src/lib/example-probe.ts",
    source:
      "export async function cleanup() { await tx.account.delete({ where: { id: 'x' } }); }",
  }),
  [
    {
      actionId: "src/lib/example-probe.ts:1:account.delete",
      path: "src/lib/example-probe.ts",
      line: 1,
      symbol: "cleanup",
      model: "account",
      method: "delete",
      hasAuditWrite: false,
    },
  ],
  "discovery remains explicit; the coverage scope excludes probe sources",
);
assert.deepEqual(
  auditDestructiveActionCoverage(
    [
      {
        path: "src/lib/example-probe.ts",
        source:
          "export async function cleanup() { await tx.account.delete({ where: { id: 'x' } }); }",
      },
    ],
    AUDIT_EVENTS,
  ).actions,
  [],
);

console.log(
  `destructive-action audit control passed: ${audit.actions.length} direct production database deletes are exactly classified`,
);

function collectProductionSources(directory: string): DestructiveActionSource[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Unsupported symbolic link under production source: ${fullPath}`);
      }
      if (entry.isDirectory()) return collectProductionSources(fullPath);
      if (
        !/\.(?:c|m)?(?:j|t)sx?$/.test(entry.name) ||
        /(?:\.test|\.spec|-probe|-fixture)\.(?:c|m)?(?:j|t)sx?$/.test(
          entry.name,
        )
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
