import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { buildProductAutomatedSourceGateRegistry } from "./product-automated-source-gate-registry";
import {
  findCrawlAccessMetadataIssues,
  type ProductCrawlAccessMetadataRecord,
  PRODUCT_CRAWL_ACCESS_METADATA_EVIDENCE_FILE,
  PRODUCT_CRAWL_ACCESS_METADATA_EXPECTED_GAIN,
  PRODUCT_CRAWL_ACCESS_METADATA_MASTER_EVIDENCE,
  PRODUCT_CRAWL_ACCESS_METADATA_REQUIREMENT_IDS,
  PRODUCT_CRAWL_ACCESS_METADATA_SCOPE,
  PRODUCT_CRAWL_ACCESS_METADATA_TEST_FILE,
} from "./product-crawl-access-metadata-evidence";
import { SCREEN_CONTRACTS } from "./demo-experience-registry";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-CRAWL-ACCESS-METADATA-EVIDENCE

const EXPECTED_IDS = ["DISC.CRAWL.role", "DISC.CRAWL.subscription"] as const;

assert.deepEqual(PRODUCT_CRAWL_ACCESS_METADATA_REQUIREMENT_IDS, EXPECTED_IDS);
assert.equal(PRODUCT_CRAWL_ACCESS_METADATA_EXPECTED_GAIN, 2);
assert.deepEqual(
  Object.keys(PRODUCT_CRAWL_ACCESS_METADATA_MASTER_EVIDENCE),
  EXPECTED_IDS,
);

const expectedRequirementText = new Map([
  [
    EXPECTED_IDS[0],
    "Record the role requirement for every discovered production link or action.",
  ],
  [
    EXPECTED_IDS[1],
    "Record the subscription requirement for every discovered production link or action.",
  ],
]);
for (const requirementId of EXPECTED_IDS) {
  const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
    ({ id }) => id === requirementId,
  );
  assert.equal(
    requirement?.requirement,
    expectedRequirementText.get(requirementId),
    requirementId,
  );

  const evidence = PRODUCT_CRAWL_ACCESS_METADATA_MASTER_EVIDENCE[requirementId];
  assert.equal(evidence.status, "tested");
  assert.deepEqual(evidence.evidence.slice(0, 2), [
    PRODUCT_CRAWL_ACCESS_METADATA_EVIDENCE_FILE,
    PRODUCT_CRAWL_ACCESS_METADATA_TEST_FILE,
  ]);
  assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
  for (const evidencePath of evidence.evidence) {
    assert.equal(existsSync(evidencePath), true, evidencePath);
  }
}

const productionScreens = SCREEN_CONTRACTS.filter(
  ({ productionEnabled }) => productionEnabled,
);
assert.equal(productionScreens.length, 90);
const screenByRoute = new Map(
  productionScreens.map((screen) => [screen.route, screen] as const),
);
for (const screen of productionScreens) {
  assert.ok(screen.roles.length > 0, `${screen.route}: roles`);
  assert.equal(new Set(screen.roles).size, screen.roles.length, screen.route);
  assert.ok(screen.tiers.length > 0, `${screen.route}: tiers`);
  assert.equal(new Set(screen.tiers).size, screen.tiers.length, screen.route);
  assert.equal(
    screen.tiers.every((tier) => ["free", "pro", "pro_plus"].includes(tier)),
    true,
    screen.route,
  );
}

function accessRecord(
  kind: ProductCrawlAccessMetadataRecord["kind"],
  sourceRoute: string,
  sourceRecord: {
    id: string;
    sourceFile: string;
    sourceLine: number;
    sourceColumn: number;
  },
): ProductCrawlAccessMetadataRecord {
  const screen = screenByRoute.get(sourceRoute);
  assert.ok(screen, `${sourceRoute}: canonical screen access contract`);
  return {
    id: `${kind}:${sourceRoute}:${sourceRecord.id}`,
    kind,
    sourceRoute,
    sourceFile: sourceRecord.sourceFile,
    sourceLine: sourceRecord.sourceLine,
    sourceColumn: sourceRecord.sourceColumn,
    roleRequirements: [...screen.roles],
    canonicalRoles: [...screen.roles],
    subscriptionRequirements: [...screen.tiers],
    canonicalSubscriptions: [...screen.tiers],
  };
}

const registry = buildProductAutomatedSourceGateRegistry();
const linkRows = registry.internalLinks.flatMap((record) =>
  record.ownerRoutes
    .filter((route) => screenByRoute.has(route))
    .map((route) => accessRecord("link", route, record)),
);
const actionRows = registry.interactiveControls.flatMap((record) =>
  record.ownerRoutes
    .filter((route) => screenByRoute.has(route))
    .map((route) => accessRecord("action", route, record)),
);
const accessRows = [...linkRows, ...actionRows];

assert.equal(linkRows.length, 2_345);
assert.equal(actionRows.length, 3_122);
assert.equal(accessRows.length, 5_467);
assert.equal(new Set(accessRows.map(({ id }) => id)).size, 5_467);
assert.deepEqual(findCrawlAccessMetadataIssues(accessRows), []);

const discoveredRoutes = new Set(accessRows.map(({ sourceRoute }) => sourceRoute));
assert.equal(discoveredRoutes.size, 89);
assert.deepEqual(
  productionScreens
    .map(({ route }) => route)
    .filter((route) => !discoveredRoutes.has(route)),
  ["/statistics"],
);

function accessSetCounts(
  rows: readonly ProductCrawlAccessMetadataRecord[],
  select: (row: ProductCrawlAccessMetadataRecord) => readonly string[],
) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = select(row).join("|");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...counts].toSorted(([left], [right]) => left.localeCompare(right)));
}

assert.deepEqual(accessSetCounts(accessRows, ({ roleRequirements }) => roleRequirements), {
  "ai-tools-user|administrator": 78,
  "marketplace-seller": 56,
  "member|admin|owner": 36,
  "member|page-manager|team-member": 689,
  "support-operator|moderator|administrator": 2_454,
  "visitor|marketplace-buyer|marketplace-seller": 484,
  "visitor|member": 132,
  "visitor|member|community-participant|page-manager": 1_379,
  "visitor|racing-member": 159,
});
assert.deepEqual(
  accessSetCounts(
    accessRows,
    ({ subscriptionRequirements }) => subscriptionRequirements,
  ),
  {
    "free|pro|pro_plus": 5_333,
    "pro|pro_plus": 134,
  },
);

const validRecord = {
  id: "action:/fixture:src/app/fixture/page.tsx:10:3:button",
  kind: "action",
  sourceRoute: "/fixture",
  sourceFile: "src/app/fixture/page.tsx",
  sourceLine: 10,
  sourceColumn: 3,
  roleRequirements: ["member"],
  canonicalRoles: ["member"],
  subscriptionRequirements: ["pro", "pro_plus"],
  canonicalSubscriptions: ["pro", "pro_plus"],
} as const satisfies ProductCrawlAccessMetadataRecord;
assert.deepEqual(findCrawlAccessMetadataIssues([validRecord]), []);

const negativeFixtures = [
  {
    name: "duplicate observation",
    records: [validRecord, validRecord],
    expectedCode: "DUPLICATE_OBSERVATION",
  },
  {
    name: "invalid discovery kind",
    records: [
      { ...validRecord, kind: "field" } as unknown as ProductCrawlAccessMetadataRecord,
    ],
    expectedCode: "INVALID_KIND",
  },
  {
    name: "missing source route",
    records: [{ ...validRecord, sourceRoute: "" }],
    expectedCode: "SOURCE_ROUTE_INVALID",
  },
  {
    name: "source outside application",
    records: [{ ...validRecord, sourceFile: "scripts/fixture.ts" }],
    expectedCode: "SOURCE_FILE_INVALID",
  },
  {
    name: "invalid source position",
    records: [{ ...validRecord, sourceColumn: 0 }],
    expectedCode: "SOURCE_POSITION_INVALID",
  },
  {
    name: "missing role metadata",
    records: [{ ...validRecord, roleRequirements: [] }],
    expectedCode: "ROLE_METADATA_INVALID",
  },
  {
    name: "role metadata differs from canonical contract",
    records: [{ ...validRecord, roleRequirements: ["administrator"] }],
    expectedCode: "ROLE_METADATA_MISMATCH",
  },
  {
    name: "missing subscription metadata",
    records: [{ ...validRecord, subscriptionRequirements: [] }],
    expectedCode: "SUBSCRIPTION_METADATA_INVALID",
  },
  {
    name: "subscription metadata differs from canonical contract",
    records: [{ ...validRecord, subscriptionRequirements: ["free"] }],
    expectedCode: "SUBSCRIPTION_METADATA_MISMATCH",
  },
] as const;

for (const fixture of negativeFixtures) {
  assert.equal(
    findCrawlAccessMetadataIssues(fixture.records).some(
      ({ code }) => code === fixture.expectedCode,
    ),
    true,
    fixture.name,
  );
}

assert.match(PRODUCT_CRAWL_ACCESS_METADATA_SCOPE, /all 5,467 production-owned discovery rows/i);
assert.match(PRODUCT_CRAWL_ACCESS_METADATA_SCOPE, /nine distinct role sets/i);
assert.match(PRODUCT_CRAWL_ACCESS_METADATA_SCOPE, /134 paid-only pro\/pro_plus rows/i);
assert.match(PRODUCT_CRAWL_ACCESS_METADATA_SCOPE, /\/statistics route contains no discovered/i);
assert.match(PRODUCT_CRAWL_ACCESS_METADATA_SCOPE, /does not claim action-specific server authorization/i);
assert.match(PRODUCT_CRAWL_ACCESS_METADATA_SCOPE, /billing-provider state/i);
const evidenceSource = readFileSync(
  PRODUCT_CRAWL_ACCESS_METADATA_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Product crawl access-metadata evidence passed: 5,467 rows record nine canonical role sets and two subscription-tier sets; exact +2 gates.",
);
