import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  DESIGN_LAB_DELIVERY_PROGRESS,
  DESIGN_LAB_DELIVERY_PROGRESS_SUMMARY,
} from "./design-lab-delivery-progress";
import { DesignLabDeliveryProgressPanel } from "./design-lab-delivery-progress-panel";
import {
  DESIGN_LAB_SYNC_SECTIONS,
  DESIGN_LAB_SYNC_SNAPSHOT,
} from "./design-lab-sync";

const repositoryRoot = resolve(__dirname, "../..");

assert.equal(
  new Set(DESIGN_LAB_DELIVERY_PROGRESS.map((item) => item.id)).size,
  DESIGN_LAB_DELIVERY_PROGRESS.length,
  "Delivery progress IDs must be unique."
);
assert.equal(
  DESIGN_LAB_DELIVERY_PROGRESS_SUMMARY.total,
  DESIGN_LAB_DELIVERY_PROGRESS.length
);
for (const item of DESIGN_LAB_DELIVERY_PROGRESS) {
  assert.match(
    item.updatedAt,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/,
    `${item.id} must use a canonical ISO timestamp.`
  );
  assert.ok(item.evidence.length > 0, `${item.id} must name evidence.`);
  for (const evidencePath of item.evidence) {
    assert.ok(
      existsSync(resolve(repositoryRoot, evidencePath)),
      `${item.id} evidence does not exist: ${evidencePath}`
    );
  }
  if (item.status === "verified") {
    assert.ok(item.verification.length > 0, `${item.id} must name a verification.`);
  } else {
    assert.ok(item.nextStep?.trim(), `${item.id} must name its next step.`);
  }
}

const adminAuthorizationProgress = DESIGN_LAB_DELIVERY_PROGRESS.find(
  ({ id }) => id === "WORK.SECURITY.ADMIN-AUTHORIZATION"
);
assert.ok(adminAuthorizationProgress);
assert.equal(adminAuthorizationProgress.status, "in-progress");
assert.equal(adminAuthorizationProgress.verificationOutcome, "pending");
assert.ok(
  adminAuthorizationProgress.evidence.includes(
    "src/lib/admin-access-contract.ts"
  )
);
assert.ok(
  adminAuthorizationProgress.evidence.includes(
    "src/lib/report-ban-policy.test.ts"
  )
);
assert.ok(
  adminAuthorizationProgress.verification.some((item) =>
    item.includes("missing-role and unknown-role bans")
  )
);
assert.match(adminAuthorizationProgress.nextStep ?? "", /PostgreSQL concurrency/);

const syntheticFixtureProgress = DESIGN_LAB_DELIVERY_PROGRESS.find(
  ({ id }) => id === "WORK.PREPROD.SYNTHETIC-PRIVATE-FIXTURES",
);
assert.ok(syntheticFixtureProgress);
assert.equal(syntheticFixtureProgress.status, "verified");
assert.equal(syntheticFixtureProgress.verificationOutcome, "pass");
assert.ok(
  syntheticFixtureProgress.evidence.includes(
    "output/database-audit/demo-fixture-idempotency.json",
  ),
);
assert.ok(
  syntheticFixtureProgress.verification.some((item) =>
    item.includes("Independent review accepted artifact"),
  ),
);
assert.equal(syntheticFixtureProgress.nextStep, undefined);
assert.ok(
  syntheticFixtureProgress.verification.some((item) =>
    item.includes("recapture this isolated proof"),
  ),
);

const markup = renderToStaticMarkup(
  createElement(DesignLabDeliveryProgressPanel)
);
assert.match(markup, /Agent delivery progress/);
assert.match(
  markup,
  /Verified evidence coverage — not a launch-readiness percentage/,
);
assert.equal(
  (markup.match(/data-design-lab-gate-category=/g) ?? []).length,
  4,
);
for (const [label, prefix] of [
  ["Screen contracts", "screen:"],
  ["Master requirements", "master:"],
  ["Pre-production", "preproduction:"],
  ["Database operations", "database:"],
]) {
  const sections = DESIGN_LAB_SYNC_SECTIONS.filter((item) =>
    item.id.startsWith(prefix),
  );
  const completed = sections.reduce((total, item) => total + item.completed, 0);
  const checks = sections.reduce((total, item) => total + item.total, 0);
  assert.match(
    markup,
    new RegExp(`${label}[\\s\\S]*?${completed}[\\s\\S]*?/[\\s\\S]*?${checks}`),
  );
}
assert.match(
  markup,
  new RegExp(
    `${DESIGN_LAB_SYNC_SNAPSHOT.release.completedChecks}\\/${DESIGN_LAB_SYNC_SNAPSHOT.release.totalChecks}`
  )
);
assert.equal(
  (markup.match(/data-delivery-progress-id=/g) ?? []).length,
  DESIGN_LAB_DELIVERY_PROGRESS.length
);
assert.match(markup, /WORK\.SECURITY\.REPORT-BAN/);
assert.match(markup, /WORK\.API\.STATIC-AUDIT/);
assert.match(markup, /WORK\.ARCHITECTURE\.PLAN/);
assert.match(markup, /WORK\.DESIGN-LAB\.SYNC/);

console.log("Design Lab delivery progress tests passed");
