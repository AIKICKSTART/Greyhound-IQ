import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getDesignLabSourceFingerprint } from "../../scripts/design-lab-source-fingerprint";
import {
  DEMO_ROUTE_AUDIT_EVALUATION,
  DEMO_SCREEN_FAMILIES,
  SCREEN_CONTRACT_BY_ROUTE,
} from "./demo-experience-registry";
import { PRODUCT_MASTER_EVIDENCE } from "./master-audit-evidence";
import {
  PRODUCT_ROUTE_MASTER_EVIDENCE,
  PRODUCT_ROUTE_MASTER_EVIDENCE_RECORDS,
  PRODUCT_ROUTE_STORY_TEST_BY_FAMILY,
  type ProductRouteMasterEvidenceRecord,
} from "./product-route-master-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

const repositoryRoot = resolve(__dirname, "../..");
const audit = JSON.parse(
  readFileSync(
    resolve(repositoryRoot, "output/demo-route-audit/latest.json"),
    "utf8",
  ),
) as { sourceSha256: string; sourceFileCount: number };
const fingerprint = getDesignLabSourceFingerprint(repositoryRoot);
const auditCurrent =
  audit.sourceSha256 === fingerprint.sha256 &&
  audit.sourceFileCount === fingerprint.fileCount;
const familyByRoute = new Map(
  DEMO_SCREEN_FAMILIES.flatMap((family) =>
    family.screens.map((screen) => [screen.route, family.key] as const),
  ),
);
const requirementById = new Map(
  PRODUCT_MASTER_REQUIREMENTS.map((requirement) => [
    requirement.id,
    requirement,
  ]),
);
const eligibleIds = PRODUCT_MASTER_REQUIREMENTS.flatMap((requirement) => {
  if (!requirement.section.startsWith("routes.")) return [];
  const match = /^Register and cover (\/.*)\.$/.exec(requirement.requirement);
  if (!match) return [];
  const screen = SCREEN_CONTRACT_BY_ROUTE.get(match[1]);
  return screen?.productionEnabled &&
    screen.coverage.route.status === "tested" &&
    screen.coverage.userStories.status === "tested" &&
    screen.coverage.tests.status === "tested"
    ? [requirement.id]
    : [];
});

assert.equal(PRODUCT_ROUTE_MASTER_EVIDENCE_RECORDS.length, 82);
assert.deepEqual(
  PRODUCT_ROUTE_MASTER_EVIDENCE_RECORDS.map(({ requirementId }) =>
    requirementId,
  ).toSorted(),
  eligibleIds.toSorted(),
  "The evidence map must cover exactly the production-enabled atomic route registrations.",
);

const familyCounts = Object.fromEntries(
  Object.keys(PRODUCT_ROUTE_STORY_TEST_BY_FAMILY).map((family) => [
    family,
    PRODUCT_ROUTE_MASTER_EVIDENCE_RECORDS.filter(
      (record) => record.family === family,
    ).length,
  ]),
);
assert.deepEqual(familyCounts, {
  public: 7,
  racing: 9,
  community: 15,
  marketplace: 6,
  account: 12,
  admin: 32,
  ai: 1,
});
assert.equal(
  PRODUCT_ROUTE_MASTER_EVIDENCE_RECORDS.some(
    ({ route }) => route === "/auth/error",
  ),
  false,
  "/auth/error has no atomic route-registration requirement and must not be manufactured.",
);
assert.equal(
  PRODUCT_ROUTE_MASTER_EVIDENCE_RECORDS.some(
    ({ requirementId }) => requirementId === "ROUTE.ACCOUNT.appearance",
  ),
  false,
  "The production-disabled Appearance preview must not be promoted.",
);

assert.deepEqual(
  validate(PRODUCT_ROUTE_MASTER_EVIDENCE_RECORDS, { auditCurrent: true }),
  [],
  "Static mapping, source and evidence checks must pass independently of audit recapture timing.",
);

const first = PRODUCT_ROUTE_MASTER_EVIDENCE_RECORDS[0];
expectInvalid(
  [{ ...first, requirementId: "ROUTE.PUBLIC.unknown" }, ...PRODUCT_ROUTE_MASTER_EVIDENCE_RECORDS.slice(1)],
  /unknown requirement/,
);
expectInvalid(
  [...PRODUCT_ROUTE_MASTER_EVIDENCE_RECORDS, first],
  /duplicate requirement/,
);
expectInvalid(
  PRODUCT_ROUTE_MASTER_EVIDENCE_RECORDS.slice(1),
  /missing eligible requirement/,
);
expectInvalid(
  [{ ...first, route: "/auth/error" }, ...PRODUCT_ROUTE_MASTER_EVIDENCE_RECORDS.slice(1)],
  /route drift/,
);
expectInvalid(
  [{ ...first, sourcePath: "src/app/about/page.tsx" }, ...PRODUCT_ROUTE_MASTER_EVIDENCE_RECORDS.slice(1)],
  /source drift/,
);
expectInvalid(
  [{ ...first, assertionsSha256: "0".repeat(64) }, ...PRODUCT_ROUTE_MASTER_EVIDENCE_RECORDS.slice(1)],
  /assertion identity drift/,
);
expectInvalid(PRODUCT_ROUTE_MASTER_EVIDENCE_RECORDS, /audit is not current/, {
  auditCurrent: false,
});

const appearance = DEMO_SCREEN_FAMILIES.find(
  ({ key }) => key === "account",
)?.screens.find(({ route }) => route === "/account/appearance");
assert.ok(appearance?.userStory);
expectInvalid(
  [
    {
      requirementId: "ROUTE.ACCOUNT.appearance",
      family: "account",
      route: appearance.route,
      sourcePath: appearance.userStory.evidence.source.path,
      storyId: appearance.userStory.id,
      assertionCount:
        appearance.userStory.evidence.source.renderAssertions.length,
      assertionsSha256: assertionHash(
        appearance.userStory.evidence.source.renderAssertions,
      ),
    },
    ...PRODUCT_ROUTE_MASTER_EVIDENCE_RECORDS.slice(1),
  ],
  /production-disabled/,
);

const broadEvidence = {
  ...PRODUCT_MASTER_EVIDENCE,
  [first.requirementId]: {
    status: "tested" as const,
    evidence: ["src/app", ...PRODUCT_ROUTE_MASTER_EVIDENCE[first.requirementId].evidence],
  },
};
expectInvalid(PRODUCT_ROUTE_MASTER_EVIDENCE_RECORDS, /evidence drift/, {
  evidenceById: broadEvidence,
});

assert.equal(
  auditCurrent,
  true,
  "The canonical route audit must match the exact current source fingerprint.",
);

console.log(
  "Product route master evidence passed: 82 exact production-enabled render registrations; runtime behaviour remains unverified.",
);

function validate(
  records: readonly ProductRouteMasterEvidenceRecord[],
  options: {
    auditCurrent?: boolean;
    evidenceById?: Readonly<
      Record<string, { status: string; evidence: readonly string[] }>
    >;
  } = {},
) {
  const issues: string[] = [];
  const evidenceById = options.evidenceById ?? PRODUCT_MASTER_EVIDENCE;
  const ids = records.map(({ requirementId }) => requirementId);
  for (const id of new Set(ids)) {
    if (ids.filter((candidate) => candidate === id).length !== 1) {
      issues.push(`duplicate requirement ${id}`);
    }
  }
  for (const id of eligibleIds) {
    if (!ids.includes(id)) issues.push(`missing eligible requirement ${id}`);
  }
  if (!(options.auditCurrent ?? auditCurrent)) issues.push("audit is not current");
  if (!DEMO_ROUTE_AUDIT_EVALUATION.valid) issues.push("audit shape is invalid");

  for (const record of records) {
    const requirement = requirementById.get(record.requirementId);
    if (!requirement) {
      issues.push(`unknown requirement ${record.requirementId}`);
      continue;
    }
    if (requirement.requirement !== `Register and cover ${record.route}.`) {
      issues.push(`route drift ${record.requirementId}`);
    }
    const screen = SCREEN_CONTRACT_BY_ROUTE.get(record.route);
    const family = familyByRoute.get(record.route);
    if (!screen || family !== record.family) {
      issues.push(`route drift ${record.requirementId}`);
      continue;
    }
    if (!screen.productionEnabled) {
      issues.push(`production-disabled ${record.requirementId}`);
    }
    const story = DEMO_SCREEN_FAMILIES.find(({ key }) => key === record.family)
      ?.screens.find(({ route }) => route === record.route)?.userStory;
    if (!story) {
      issues.push(`missing story ${record.requirementId}`);
      continue;
    }
    if (story.id !== record.storyId) issues.push(`story drift ${record.requirementId}`);
    if (story.evidence.source.path !== record.sourcePath) {
      issues.push(`source drift ${record.requirementId}`);
    }
    const assertions = story.evidence.source.renderAssertions;
    if (
      assertions.length !== record.assertionCount ||
      assertionHash(assertions) !== record.assertionsSha256
    ) {
      issues.push(`assertion identity drift ${record.requirementId}`);
    }
    const sourcePath = resolve(repositoryRoot, record.sourcePath);
    if (!existsSync(sourcePath)) {
      issues.push(`missing source ${record.requirementId}`);
    } else {
      const source = readFileSync(sourcePath, "utf8");
      if (assertions.some((assertion) => !source.includes(assertion))) {
        issues.push(`source assertion absent ${record.requirementId}`);
      }
    }
    if (
      story.coverage.status !== "tested" ||
      screen.coverage.route.status !== "tested" ||
      screen.coverage.userStories.status !== "tested" ||
      screen.coverage.tests.status !== "tested" ||
      !DEMO_ROUTE_AUDIT_EVALUATION.passedRoutes.includes(record.route)
    ) {
      issues.push(`unproved render ${record.requirementId}`);
    }
    assert.deepEqual(
      story.evidence.test,
      PRODUCT_ROUTE_STORY_TEST_BY_FAMILY[record.family],
    );
    const expectedEvidence = PRODUCT_ROUTE_MASTER_EVIDENCE[record.requirementId];
    if (
      !expectedEvidence ||
      evidenceById[record.requirementId]?.status !== "tested" ||
      JSON.stringify(evidenceById[record.requirementId]?.evidence) !==
        JSON.stringify(expectedEvidence.evidence)
    ) {
      issues.push(`evidence drift ${record.requirementId}`);
    }
  }
  return issues;
}

function assertionHash(assertions: readonly string[]) {
  return createHash("sha256").update(JSON.stringify(assertions)).digest("hex");
}

function expectInvalid(
  records: readonly ProductRouteMasterEvidenceRecord[],
  expected: RegExp,
  options?: Parameters<typeof validate>[1],
) {
  const issues = validate(records, options);
  assert.ok(
    issues.some((issue) => expected.test(issue)),
    `Expected ${expected}; received ${issues.join(", ")}`,
  );
}
