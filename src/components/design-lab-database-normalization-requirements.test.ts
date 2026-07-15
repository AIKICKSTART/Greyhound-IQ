import assert from "node:assert/strict";

import {
  DESIGN_LAB_DATABASE_NORMALIZATION_MILESTONES,
  DESIGN_LAB_DATABASE_NORMALIZATION_REQUIREMENTS,
  type DesignLabDatabaseNormalizationRequirement,
} from "./design-lab-database-normalization-requirements";
import type { DesignLabPreproductionRequirement } from "./design-lab-preproduction-requirements";

const EXPECTED_IDS = [
  "PREPROD.DB.NORMALIZATION.M0.ASSUMPTION_REGISTER",
  "PREPROD.DB.NORMALIZATION.M0.VIOLATION_BASELINE",
  "PREPROD.DB.NORMALIZATION.M0.CANONICAL_FACT_ADRS",
  "PREPROD.DB.NORMALIZATION.M0.ONLINE_MIGRATION_PLAN",
  "PREPROD.DB.NORMALIZATION.M1.TENANT_MEMBERSHIP_RLS",
  "PREPROD.DB.NORMALIZATION.M1.ORGANIZATION_AUTHORITY",
  "PREPROD.DB.NORMALIZATION.M1.RACING_LINEAGE",
  "PREPROD.DB.NORMALIZATION.M1.IMPORT_IDENTITIES",
  "PREPROD.DB.NORMALIZATION.M1.NULLABLE_BUSINESS_KEYS",
  "PREPROD.DB.NORMALIZATION.M1.BILLING_LINEAGE",
  "PREPROD.DB.NORMALIZATION.M1.BILLING_DOMAINS",
  "PREPROD.DB.NORMALIZATION.M1.CUSTOM_DESIGN_ORDERS",
  "PREPROD.DB.NORMALIZATION.M1.MONEY_CURRENCY",
  "PREPROD.DB.NORMALIZATION.M1.DELETION_EXPORT_SCOPE",
  "PREPROD.DB.NORMALIZATION.M1.AUTH_CONFIG_DOMAINS",
  "PREPROD.DB.NORMALIZATION.M1.IDENTITY_LEGAL_AUDIT",
  "PREPROD.DB.NORMALIZATION.M1.LOCAL_REFERENCES",
  "PREPROD.DB.NORMALIZATION.M1.WEBHOOK_PAYLOAD_BOUNDS",
  "PREPROD.DB.NORMALIZATION.M2.PROJECTION_DRIFT",
  "PREPROD.DB.NORMALIZATION.M2.RATE_LIMIT_BACKEND",
  "PREPROD.DB.NORMALIZATION.M2.HOT_ROWS_GROWTH",
  "PREPROD.DB.NORMALIZATION.M2.JSON_SEMANTICS",
  "PREPROD.DB.NORMALIZATION.M2.AU_TIME_CONTRACT",
  "PREPROD.DB.NORMALIZATION.M2.PAIR_THREAD_INVARIANTS",
  "PREPROD.DB.NORMALIZATION.M2.REPLAY_RESTORE",
  "PREPROD.DB.NORMALIZATION.M3.LEGACY_IDENTITY_CONTRACTION",
  "PREPROD.DB.NORMALIZATION.M3.DUPLICATE_PROJECTION_CONTRACTION",
  "PREPROD.DB.NORMALIZATION.M3.INDEX_PARTITION_REVIEW",
  "PREPROD.DB.NORMALIZATION.M3.SHARDING_THRESHOLD",
] as const;

const EXPECTED_RELEASE_BLOCKERS = new Set([
  "PREPROD.DB.NORMALIZATION.M0.ASSUMPTION_REGISTER",
  "PREPROD.DB.NORMALIZATION.M0.VIOLATION_BASELINE",
  "PREPROD.DB.NORMALIZATION.M0.CANONICAL_FACT_ADRS",
  "PREPROD.DB.NORMALIZATION.M0.ONLINE_MIGRATION_PLAN",
  "PREPROD.DB.NORMALIZATION.M1.TENANT_MEMBERSHIP_RLS",
  "PREPROD.DB.NORMALIZATION.M1.ORGANIZATION_AUTHORITY",
  "PREPROD.DB.NORMALIZATION.M1.RACING_LINEAGE",
  "PREPROD.DB.NORMALIZATION.M1.IMPORT_IDENTITIES",
  "PREPROD.DB.NORMALIZATION.M1.NULLABLE_BUSINESS_KEYS",
  "PREPROD.DB.NORMALIZATION.M1.BILLING_LINEAGE",
  "PREPROD.DB.NORMALIZATION.M1.BILLING_DOMAINS",
  "PREPROD.DB.NORMALIZATION.M1.CUSTOM_DESIGN_ORDERS",
  "PREPROD.DB.NORMALIZATION.M1.MONEY_CURRENCY",
  "PREPROD.DB.NORMALIZATION.M1.DELETION_EXPORT_SCOPE",
  "PREPROD.DB.NORMALIZATION.M1.AUTH_CONFIG_DOMAINS",
  "PREPROD.DB.NORMALIZATION.M1.IDENTITY_LEGAL_AUDIT",
  "PREPROD.DB.NORMALIZATION.M1.LOCAL_REFERENCES",
  "PREPROD.DB.NORMALIZATION.M1.WEBHOOK_PAYLOAD_BOUNDS",
  "PREPROD.DB.NORMALIZATION.M2.PROJECTION_DRIFT",
  "PREPROD.DB.NORMALIZATION.M2.RATE_LIMIT_BACKEND",
  "PREPROD.DB.NORMALIZATION.M2.AU_TIME_CONTRACT",
  "PREPROD.DB.NORMALIZATION.M2.PAIR_THREAD_INVARIANTS",
  "PREPROD.DB.NORMALIZATION.M2.REPLAY_RESTORE",
]);
const PARTIALLY_VERIFIED_ID = "PREPROD.DB.NORMALIZATION.M2.REPLAY_RESTORE";

const ids = DESIGN_LAB_DATABASE_NORMALIZATION_REQUIREMENTS.map(({ id }) => id);
assert.equal(new Set(ids).size, ids.length, "Normalization IDs must be unique.");
assert.deepEqual(
  [...ids].toSorted(),
  [...EXPECTED_IDS].toSorted(),
  "The normalization registry must contain the exact reviewed stable ID set.",
);
assert.ok(
  ids.every((id) => /^PREPROD\.DB\.NORMALIZATION\.M[0-3]\.[A-Z0-9_]+$/.test(id)),
  "Every normalization ID must follow the stable namespace.",
);

assert.deepEqual(DESIGN_LAB_DATABASE_NORMALIZATION_MILESTONES, ["M0", "M1", "M2", "M3"]);
assert.deepEqual(classificationCounts(), {
  M0: { total: 4, releaseBlocking: 4, mandatoryBefore50k: 4 },
  M1: { total: 14, releaseBlocking: 14, mandatoryBefore50k: 14 },
  M2: { total: 7, releaseBlocking: 5, mandatoryBefore50k: 7 },
  M3: { total: 4, releaseBlocking: 0, mandatoryBefore50k: 0 },
});
assert.equal(DESIGN_LAB_DATABASE_NORMALIZATION_REQUIREMENTS.length, 29);
assert.equal(
  DESIGN_LAB_DATABASE_NORMALIZATION_REQUIREMENTS.filter(({ releaseBlocking }) => releaseBlocking)
    .length,
  23,
);
assert.equal(
  DESIGN_LAB_DATABASE_NORMALIZATION_REQUIREMENTS.filter(({ mandatoryBefore50k }) =>
    Boolean(mandatoryBefore50k),
  ).length,
  25,
);

for (const item of DESIGN_LAB_DATABASE_NORMALIZATION_REQUIREMENTS) {
  assert.equal(item.system, "database", `${item.id} must stay in the database system.`);
  if (item.status === "partially-verified") {
    assert.equal(item.id, PARTIALLY_VERIFIED_ID);
    assert.deepEqual(item.evidence, [
      "scripts/check-local-dr-restore.ts",
      "output/production-readiness/local-dr/latest.json",
    ]);
    assert.deepEqual(item.tests, ["scripts/check-local-dr-restore.test.ts"]);
    assert.deepEqual(item.operatorCommands, ["npm run check:local-dr-restore"]);
  } else {
    assert.notEqual(item.id, PARTIALLY_VERIFIED_ID);
    assert.deepEqual(item.evidence, [], `${item.id} must not claim completion evidence.`);
  }
  assert.equal(
    item.releaseBlocking,
    EXPECTED_RELEASE_BLOCKERS.has(item.id),
    `${item.id} has the wrong launch-blocker classification.`,
  );
  assert.equal(
    item.mandatoryBefore50k,
    item.milestone !== "M3",
    `${item.id} has the wrong 50k-scale classification.`,
  );
  assert.ok(item.owner.trim(), `${item.id} needs an accountable owner.`);
  assert.ok(
    item.remainingEvidence.trim() && !/^none\b|^n\/a\b/i.test(item.remainingEvidence.trim()),
    `${item.id} needs explicit remaining evidence.`,
  );
  assert.equal(
    /\b(?:already|currently)\s+(?:passed|verified|complete|deployed|proven)\b/i.test(
      item.remainingEvidence,
    ),
    false,
    `${item.id} must not overstate accepted evidence.`,
  );
  assert.equal(hasObjectivePassCriteria(item), true, `${item.id} needs objective pass criteria.`);
  if (item.status === "not-verified") assertSafePlaceholders(item);
}

let baseCompatibleLaunchBlockerCount = 0;
for (const item of DESIGN_LAB_DATABASE_NORMALIZATION_REQUIREMENTS) {
  if (item.releaseBlocking) {
    const baseCompatibleItem: DesignLabPreproductionRequirement = item;
    assert.equal(baseCompatibleItem.releaseBlocking, true);
    baseCompatibleLaunchBlockerCount += 1;
  }
}
assert.equal(baseCompatibleLaunchBlockerCount, EXPECTED_RELEASE_BLOCKERS.size);

console.log(
  "Design Lab database normalization registry passed: 29 gates (M0 4, M1 14, M2 7, M3 4), 23 launch blockers and 25 mandatory before 50k.",
);

function classificationCounts() {
  return Object.fromEntries(
    DESIGN_LAB_DATABASE_NORMALIZATION_MILESTONES.map((milestone) => {
      const items = DESIGN_LAB_DATABASE_NORMALIZATION_REQUIREMENTS.filter(
        (item) => item.milestone === milestone,
      );
      return [
        milestone,
        {
          total: items.length,
          releaseBlocking: items.filter(({ releaseBlocking }) => releaseBlocking).length,
          mandatoryBefore50k: items.filter(({ mandatoryBefore50k }) => mandatoryBefore50k).length,
        },
      ];
    }),
  );
}

function hasObjectivePassCriteria(item: DesignLabDatabaseNormalizationRequirement) {
  const measurable =
    /\b(?:zero|exactly|every|all|only|100 percent|23503|23505|23514|10x|p95|p99|RTO|RPO|one|no|reject(?:s|ed)?|den(?:y|ies|ied)|bounded|within|passes?|thresholds?)\b/i;
  const vague = /\b(?:should|could|ideally|TBD|TODO|improve later|review later)\b/i;
  return (
    item.passCriteria.length >= 2 &&
    item.passCriteria.every(
      (criterion) => criterion.trim().length >= 40 && criterion.trim().endsWith(".") && !vague.test(criterion),
    ) &&
    measurable.test(item.passCriteria.join(" "))
  );
}

function assertSafePlaceholders(
  item: Extract<DesignLabDatabaseNormalizationRequirement, { status: "not-verified" }>,
) {
  const forbiddenCommand =
    /(?:\b(?:npm|npx|pnpm|yarn|psql|prisma|gcloud|kubectl|docker|terraform|curl)\b|DATABASE_URL|DIRECT_URL|(?:^|\s)(?:INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE)\s|[;&|`$])/i;
  const secretValue = /\b(?:password|api[_ -]?key|bearer|secret value|token value)\b/i;

  assert.equal(item.tests.length, 1, `${item.id} needs one safe test placeholder.`);
  assert.equal(item.operatorCommands.length, 1, `${item.id} needs one safe operator placeholder.`);
  assert.ok(item.tests[0].startsWith("PLACEHOLDER TEST: "));
  assert.ok(item.operatorCommands[0].startsWith("PLACEHOLDER OPERATOR STEP: "));

  for (const placeholder of [...item.tests, ...item.operatorCommands]) {
    assert.equal(forbiddenCommand.test(placeholder), false, `${item.id} contains an executable command.`);
    assert.equal(secretValue.test(placeholder), false, `${item.id} contains a secret-value instruction.`);
  }
}
