import assert from "node:assert/strict";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  collectDesignLabDocumentationCounterIssues,
  writeDesignLabDocumentationCounters,
} from "./check-design-lab-doc-counters";

const MANAGED_REPORTS = [
  "docs/product/action-inventory.md",
  "docs/product/design-lab-coverage.md",
  "docs/product/final-audit-report.md",
  "docs/product/form-field-registry.md",
  "docs/product/onboarding-map.md",
  "docs/product/permissions-matrix.md",
  "docs/product/route-inventory.md",
  "docs/product/state-matrix.md",
  "docs/product/user-story-matrix.md",
  "docs/security/release-security-report.md",
] as const;

assert.deepEqual(collectDesignLabDocumentationCounterIssues(), []);

const fixtureRoot = mkdtempSync(join(tmpdir(), "greyhoundiq-doc-counters-"));
try {
  for (const report of MANAGED_REPORTS) {
    cpSync(report, join(fixtureRoot, report), { recursive: true });
  }

  const report = "docs/product/final-audit-report.md";
  const fixturePath = join(fixtureRoot, report);
  const canonical = readFileSync(fixturePath, "utf8");
  const drifted = canonical.replace(
    /(\| Aggregate production gate \| )(\d+)( \| \d+ \| \d+ \|)/,
    (_, prefix: string, count: string, suffix: string) =>
      `${prefix}${Number(count) + 1}${suffix}`,
  );
  assert.notEqual(drifted, canonical, "fixture must change one aggregate count");
  writeFileSync(fixturePath, drifted);

  assert.deepEqual(collectDesignLabDocumentationCounterIssues(fixtureRoot), [
    `${report} does not match the current machine registries`,
  ]);
  assert.deepEqual(writeDesignLabDocumentationCounters(fixtureRoot), [report]);
  assert.deepEqual(collectDesignLabDocumentationCounterIssues(fixtureRoot), []);
  assert.equal(readFileSync(fixturePath, "utf8"), canonical);

  writeFileSync(
    fixturePath,
    canonical.replace("<!-- design-lab-live-counters:start -->", ""),
  );
  assert.match(
    collectDesignLabDocumentationCounterIssues(fixtureRoot).join("\n"),
    /is missing the managed counter block/,
  );
  assert.throws(
    () => writeDesignLabDocumentationCounters(fixtureRoot),
    /is missing the managed counter block/,
  );
} finally {
  rmSync(fixtureRoot, { force: true, recursive: true });
}

console.log(
  "Design Lab documentation counter checks passed: current reports match, one-count drift fails closed, and managed writes restore the canonical block.",
);
