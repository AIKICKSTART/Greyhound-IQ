import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { buildRacingDataDisclosure } from "../lib/racing-data-disclosure";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "./master-audit-requirements";
import { PRODUCT_MASTER_EVIDENCE } from "./master-audit-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import { PRODUCT_RACING_STRUCTURE_OPEN_REQUIREMENT_IDS } from "./product-racing-structure-evidence";
import {
  PRODUCT_RACING_PROVENANCE_EVIDENCE_FILE,
  PRODUCT_RACING_PROVENANCE_EXPECTED_GAIN,
  PRODUCT_RACING_PROVENANCE_MASTER_EVIDENCE,
  PRODUCT_RACING_PROVENANCE_REQUIREMENT_IDS,
  PRODUCT_RACING_PROVENANCE_SCOPE,
  PRODUCT_RACING_PROVENANCE_TEST_FILE,
} from "./product-racing-provenance-evidence";

const completedIds = [...PRODUCT_RACING_PROVENANCE_REQUIREMENT_IDS];
assert.deepEqual(completedIds, [
  "RACING.STRUCT.source-disclosure",
  "RACING.STRUCT.update-disclosure",
]);
assert.equal(PRODUCT_RACING_PROVENANCE_EXPECTED_GAIN, 2);
assert.equal(new Set(completedIds).size, completedIds.length);
assert.deepEqual(
  Object.keys(PRODUCT_RACING_PROVENANCE_MASTER_EVIDENCE),
  completedIds,
);

const productRequirementIds = new Set(
  PRODUCT_MASTER_REQUIREMENTS.map(({ id }) => id),
);
for (const requirementId of completedIds) {
  assert.equal(productRequirementIds.has(requirementId), true, requirementId);
  assert.equal(
    (PRODUCT_RACING_STRUCTURE_OPEN_REQUIREMENT_IDS as readonly string[]).includes(
      requirementId,
    ),
    false,
  );
  const record = PRODUCT_RACING_PROVENANCE_MASTER_EVIDENCE[requirementId];
  assert.equal(record.status, "tested");
  assert.deepEqual(record.evidence.slice(0, 2), [
    PRODUCT_RACING_PROVENANCE_EVIDENCE_FILE,
    PRODUCT_RACING_PROVENANCE_TEST_FILE,
  ]);
  assert.equal(new Set(record.evidence).size, record.evidence.length);
  assert.equal(record.evidence.some((path) => path.startsWith("output/")), false);
  for (const evidencePath of record.evidence) {
    assert.equal(existsSync(evidencePath), true, evidencePath);
  }
  assert.deepEqual(PRODUCT_MASTER_EVIDENCE[requirementId], record);
}

const evidenceSource = readFileSync(
  PRODUCT_RACING_PROVENANCE_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(PRODUCT_RACING_PROVENANCE_SCOPE, /all ten registered public racing surfaces/i);
assert.match(PRODUCT_RACING_PROVENANCE_SCOPE, /exact latest accepted result time/i);
assert.match(PRODUCT_RACING_PROVENANCE_SCOPE, /current, delayed or unavailable/i);
assert.match(PRODUCT_RACING_PROVENANCE_SCOPE, /does not prove provider authority/i);
assert.match(PRODUCT_RACING_PROVENANCE_SCOPE, /broader no-invention requirement/i);
assert.match(PRODUCT_RACING_PROVENANCE_SCOPE, /production readiness/i);

const timestamp = "2026-07-15T03:00:00.000Z";
const current = buildRacingDataDisclosure(
  {
    timestamp,
    data: {
      database: "ok",
      liveProviders: [
        { name: "watchdog" },
        { name: "thedogs" },
        { name: "watchdog" },
      ],
      latestResultAt: "2026-07-15T02:00:00.000Z",
    },
  },
  new Date(timestamp),
);
assert.equal(current.state, "current");
assert.deepEqual(current.providers, ["The Dogs", "Watchdog"]);
assert.equal(current.providerLabel, "The Dogs, Watchdog");
assert.equal(current.latestResultAt, "2026-07-15T02:00:00.000Z");
assert.equal(current.checkedAt, timestamp);

const stale = buildRacingDataDisclosure(
  {
    timestamp,
    data: {
      database: "ok",
      liveProviders: [{ name: "topaz" }],
      latestResultAt: "2026-07-13T02:00:00.000Z",
    },
  },
  new Date(timestamp),
);
assert.equal(stale.state, "stale");
assert.match(stale.stateLabel, /over 24 hours old/i);

const unavailable = buildRacingDataDisclosure(
  {
    timestamp,
    data: {
      database: "error",
      liveProviders: [],
      latestResultAt: null,
    },
  },
  new Date(timestamp),
);
assert.equal(unavailable.state, "unavailable");
assert.equal(unavailable.providerLabel, "No loaded provider attribution");
assert.equal(unavailable.latestResultLabel, "Not available");

const componentSource = readFileSync(
  "src/components/racing-data-disclosure.tsx",
  "utf8",
);
for (const sourceAssertion of [
  "getLiveFeedStatus",
  "cached(",
  "buildRacingDataDisclosure",
  'aria-label="Racing data source and freshness"',
  "data-racing-data-state={disclosure.state}",
  "Loaded sources",
  "Latest accepted result",
  "Status checked",
  "disclosure.stateLabel",
]) {
  assert.ok(
    componentSource.includes(sourceAssertion),
    `shared racing disclosure must include ${sourceAssertion}`,
  );
}
for (const prohibitedField of ["blockers", "missingEnv", "requiredEnv"]) {
  assert.equal(
    componentSource.includes(prohibitedField),
    false,
    `public racing disclosure must not expose ${prohibitedField}`,
  );
}

const racingPagePaths = [
  "src/app/races/page.tsx",
  "src/app/meetings/[id]/page.tsx",
  "src/app/races/[id]/page.tsx",
  "src/app/dogs/page.tsx",
  "src/app/dogs/[id]/page.tsx",
  "src/app/results/page.tsx",
  "src/app/statistics/page.tsx",
  "src/app/tracks/page.tsx",
  "src/app/tracks/[id]/page.tsx",
  "src/app/breeding/page.tsx",
] as const;
for (const pagePath of racingPagePaths) {
  const pageSource = readFileSync(pagePath, "utf8");
  assert.match(pageSource, /import \{ RacingDataDisclosure \}/);
  assert.match(pageSource, /<RacingDataDisclosure/);
}

const cssSource = readFileSync("src/app/globals.css", "utf8");
for (const selector of [
  ".giq-racing-data-disclosure",
  '[data-racing-data-state="stale"]',
  '[data-racing-data-state="unavailable"]',
  "@media (max-width: 640px)",
]) {
  assert.ok(cssSource.includes(selector), `responsive disclosure CSS needs ${selector}`);
}

const liveStatusSource = readFileSync("src/lib/live/status.ts", "utf8");
for (const sourceAssertion of [
  'by: ["sourceProvider"]',
  "name: provider.sourceProvider",
  "latestResult?.lastSyncedAt?.toISOString() ?? null",
]) {
  assert.ok(
    liveStatusSource.includes(sourceAssertion),
    `live status must derive disclosure from ${sourceAssertion}`,
  );
}

const selectedIdSet = new Set<string>(completedIds);
const currentCompleted = MASTER_AUDIT_REQUIREMENTS.filter(
  isMasterRequirementComplete,
).length;
const withoutThisBatch = MASTER_AUDIT_REQUIREMENTS.map((requirement) =>
  selectedIdSet.has(requirement.id)
    ? { ...requirement, status: "not-started", evidence: [] }
    : requirement,
).filter(isMasterRequirementComplete).length;
assert.equal(
  currentCompleted - withoutThisBatch,
  PRODUCT_RACING_PROVENANCE_EXPECTED_GAIN,
  "This isolated evidence batch must add exactly two completed requirements",
);

console.log(
  "Product racing provenance evidence passed: all 10 public racing surfaces disclose loaded sources and freshness, and 2 gates closed.",
);
