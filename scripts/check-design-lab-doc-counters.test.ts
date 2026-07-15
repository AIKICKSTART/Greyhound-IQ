import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";

const tsxBin = join("node_modules", "tsx", "dist", "cli.mjs");
const checker = "scripts/check-design-lab-doc-counters.ts";
const result = runChecker();

assert.equal(
  result.status,
  0,
  [result.stdout, result.stderr].filter(Boolean).join("\n"),
);

const docsGateSource = readFileSync("scripts/check-docs.mjs", "utf8");
assert.match(docsGateSource, /check-design-lab-doc-counters\.ts/);
assert.match(docsGateSource, /counterCheck\.status !== 0/);

for (const requirementId of [
  "REG.ROUTE.drives-docs",
  "DOC.PATH.route",
  "DOC.PATH.stories",
  "DOC.PATH.actions",
  "DOC.PATH.forms",
  "DOC.PATH.permissions",
  "DOC.PATH.states",
  "DOC.PATH.onboarding",
  "DOC.PATH.design-lab",
  "DOC.PATH.final",
]) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (item) => item.id === requirementId,
  );
  assert.ok(requirement, `${requirementId} must remain in the master registry`);
  assert.equal(
    isMasterRequirementComplete(requirement),
    true,
    `${requirementId} must stay bound to the counter contract evidence`,
  );
}

const fixtureRoot = mkdtempSync(join(tmpdir(), "greyhoundiq-doc-counters-"));
try {
  mkdirSync(join(fixtureRoot, "docs", "product"), { recursive: true });
  mkdirSync(join(fixtureRoot, "docs", "security"), { recursive: true });
  for (const relativePath of [
    "docs/product/design-lab-coverage.md",
    "docs/product/final-audit-report.md",
    "docs/product/route-inventory.md",
    "docs/product/user-story-matrix.md",
    "docs/product/action-inventory.md",
    "docs/product/form-field-registry.md",
    "docs/product/permissions-matrix.md",
    "docs/product/state-matrix.md",
    "docs/product/onboarding-map.md",
    "docs/security/release-security-report.md",
  ]) {
    cpSync(relativePath, join(fixtureRoot, relativePath));
  }

  const staleReportPath = join(
    fixtureRoot,
    "docs",
    "product",
    "final-audit-report.md",
  );
  writeFileSync(
    staleReportPath,
    readFileSync(staleReportPath, "utf8").replace(
      /(\| Aggregate production gate \| )(\d+)( \|)/,
      (_, prefix: string, completed: string, suffix: string) =>
        `${prefix}${Number(completed) - 1}${suffix}`,
    ),
  );

  const staleResult = runChecker([`--root=${fixtureRoot}`]);
  assert.notEqual(staleResult.status, 0);
  assert.match(
    `${staleResult.stdout}\n${staleResult.stderr}`,
    /final-audit-report\.md does not match the current machine registries/,
  );

  const writeResult = runChecker([`--root=${fixtureRoot}`, "--write"]);
  assert.equal(
    writeResult.status,
    0,
    [writeResult.stdout, writeResult.stderr].filter(Boolean).join("\n"),
  );
  assert.match(writeResult.stdout, /docs\/product\/final-audit-report\.md/);

  const repairedResult = runChecker([`--root=${fixtureRoot}`]);
  assert.equal(
    repairedResult.status,
    0,
    [repairedResult.stdout, repairedResult.stderr].filter(Boolean).join("\n"),
  );
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log("Design Lab documentation counter contract tests passed");

function runChecker(arguments_: string[] = []) {
  return spawnSync(process.execPath, [tsxBin, checker, ...arguments_], {
    encoding: "utf8",
  });
}
