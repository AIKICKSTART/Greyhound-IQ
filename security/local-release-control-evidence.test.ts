import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  findClientBundleSecretLeaks,
  findExampleSecretIssues,
  findSecretBoundarySourceIssues,
} from "../scripts/check-secret-boundaries";
import {
  auditProductionSqlSafety,
  inspectProductionSqlSource,
} from "../scripts/check-production-sql-safety";
import { MASTER_AUDIT_REQUIREMENTS } from "../src/components/master-audit-requirements";
import {
  LOCAL_RELEASE_CONTROL_MASTER_EVIDENCE,
  LOCAL_RELEASE_CONTROL_REQUIREMENT_IDS,
} from "./local-release-control-evidence";

for (const requirementId of LOCAL_RELEASE_CONTROL_REQUIREMENT_IDS) {
  assert.ok(
    MASTER_AUDIT_REQUIREMENTS.some(
      ({ id, prompt }) => id === requirementId && prompt === "security",
    ),
    `${requirementId}: missing immutable security requirement`,
  );
  assert.equal(
    LOCAL_RELEASE_CONTROL_MASTER_EVIDENCE[requirementId].status,
    "verified",
  );
}

const sqlAudit = auditProductionSqlSafety();
assert.ok(sqlAudit.scannedFiles > 0);
assert.ok(sqlAudit.safeRawOperationCount > 0);
assert.deepEqual(sqlAudit.violations, []);
assert.ok(
  inspectProductionSqlSource(
    "src/lib/unsafe.ts",
    'db.$queryRawUnsafe("SELECT * FROM User WHERE id = " + userId)',
  ).violations.some(({ code }) => code === "UNSAFE_RAW_METHOD"),
);

assert.deepEqual(
  findSecretBoundarySourceIssues({
    ciWorkflow: readFileSync(".github/workflows/ci.yml", "utf8"),
    deployWorkflow: readFileSync(
      ".github/workflows/cloud-run-deploy.yml",
      "utf8",
    ),
    packageJson: readFileSync("package.json", "utf8"),
    exampleEnvironment: readFileSync(".env.example", "utf8"),
  }),
  [],
);
assert.ok(
  findExampleSecretIssues("STRIPE_SECRET_KEY=sk_live_synthetic_not_a_secret").some(
    (issue) => issue.startsWith("EXAMPLE_SECRET_VALUE_NOT_PLACEHOLDER:"),
  ),
);

const clientFixture = mkdtempSync(join(tmpdir(), "greyhoundiq-secret-boundary-"));
try {
  writeFileSync(
    join(clientFixture, "client.js"),
    "window.fixture='synthetic-server-secret';",
  );
  assert.deepEqual(
    findClientBundleSecretLeaks(clientFixture, [
      {
        identifier: "SYNTHETIC_SERVER_SECRET",
        value: "synthetic-server-secret",
      },
    ]).map(({ identifier }) => identifier),
    ["SYNTHETIC_SERVER_SECRET"],
  );
} finally {
  rmSync(clientFixture, { force: true, recursive: true });
}

console.log(
  `Local release controls passed: ${sqlAudit.safeRawOperationCount} parameterized raw operations and source/client secret boundaries.`,
);
