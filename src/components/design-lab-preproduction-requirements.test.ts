import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DESIGN_LAB_PREPRODUCTION_REQUIREMENTS,
  DESIGN_LAB_PREPRODUCTION_SUMMARY,
  GREYHOUNDIQ_DUAL_DOMAIN_CONTROLS,
  GREYHOUNDIQ_PRODUCTION_HOSTS,
  isDesignLabPreproductionRequirementComplete,
  type DesignLabPreproductionRequirement,
} from "./design-lab-preproduction-requirements";
import { DESIGN_LAB_DATA_FEED_GATES } from "./design-lab-data-feed-registry";
import { DESIGN_LAB_DATABASE_NORMALIZATION_REQUIREMENTS } from "./design-lab-database-normalization-requirements";

assert.equal(
  new Set(DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.map((item) => item.id)).size,
  DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.length
);
assert.ok(DESIGN_LAB_PREPRODUCTION_SUMMARY.total >= 10);
assert.equal(
  DESIGN_LAB_PREPRODUCTION_SUMMARY.complete,
  DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.filter(
    isDesignLabPreproductionRequirementComplete
  ).length
);
assert.equal(
  DESIGN_LAB_PREPRODUCTION_SUMMARY.releaseTotal,
  DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.filter((item) => item.releaseBlocking)
    .length,
);
assert.equal(
  DESIGN_LAB_PREPRODUCTION_SUMMARY.postMvpTotal,
  DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.filter((item) => !item.releaseBlocking)
    .length,
);
assert.equal(DESIGN_LAB_PREPRODUCTION_SUMMARY.postMvpTotal, 5);
const durableSqlRequirement = DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.find(
  (item) => item.id === "PREPROD.PG_DURABLE.EVALUATION",
);
assert.equal(durableSqlRequirement?.status, "verified");
assert.equal(
  durableSqlRequirement
    ? isDesignLabPreproductionRequirementComplete(durableSqlRequirement)
    : false,
  true,
);
assert.match(durableSqlRequirement?.requirement ?? "", /Do not adopt PG Durable SQL/);
assert.match(durableSqlRequirement?.requirement ?? "", /Prisma and PostgreSQL/);
assert.match(durableSqlRequirement?.simulationContract ?? "", /no PG Durable dependency/);
assert.match(durableSqlRequirement?.remainingEvidence ?? "", /Future adoption remains post-MVP/);

const pgDurableRuntimeSurfaces = [
  "package.json",
  "package-lock.json",
  "prisma/schema.prisma",
  "src/lib/db.ts",
  "docker-compose.local-db.yml",
] as const;
for (const file of pgDurableRuntimeSurfaces) {
  assert.doesNotMatch(
    readFileSync(file, "utf8"),
    /\bpg[_-]durable\b/i,
    `${file} must not adopt PG Durable for MVP.`,
  );
}
assert.match(readFileSync("prisma/schema.prisma", "utf8"), /provider\s*=\s*"postgresql"/);
assert.match(readFileSync("src/lib/db.ts", "utf8"), /PrismaClient/);

const normalizationReleaseRequirements =
  DESIGN_LAB_DATABASE_NORMALIZATION_REQUIREMENTS.filter(
    (requirement) => requirement.releaseBlocking,
  );
assert.equal(normalizationReleaseRequirements.length, 23);
assert.ok(
  normalizationReleaseRequirements.every((requirement) =>
    DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.includes(requirement),
  ),
);
assert.ok(
  DESIGN_LAB_DATABASE_NORMALIZATION_REQUIREMENTS.filter(
    (requirement) => !requirement.releaseBlocking,
  ).every(
    (requirement) =>
      !DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.some(
        (item) => item.id === requirement.id,
      ),
  ),
);

for (const gate of DESIGN_LAB_DATA_FEED_GATES) {
  const requirement = DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.find(
    (item) => item.id === gate.id,
  );
  assert.ok(requirement, `${gate.id} must be in the release gate.`);
  assert.equal(requirement.system, "data-feeds");
  assert.equal(requirement.status, gate.status);
  assert.deepEqual(requirement.evidence, gate.evidence);
  assert.deepEqual(requirement.tests, []);
  assert.equal(isDesignLabPreproductionRequirementComplete(requirement), false);
}
assert.ok(
  DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.some(
    (item) => item.id === "PREPROD.API.STATIC_CONTRACT_AUDIT"
  )
);
assert.ok(
  DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.some(
    (item) => item.id === "PREPROD.ARCHITECTURE.RESILIENCE_EVIDENCE"
  )
);
assert.ok(
  DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.some(
    (item) => item.id === "PREPROD.CAPACITY.50000_DAU"
  )
);

const architectureRequirement = DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.find(
  (item) => item.id === "PREPROD.ARCHITECTURE.RESILIENCE_EVIDENCE",
);
const capacityRequirement = DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.find(
  (item) => item.id === "PREPROD.CAPACITY.50000_DAU",
);
const managedStagingRequirement = DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.find(
  (item) => item.id === "PREPROD.GCP.MANAGED_SERVICE_PARITY",
);
const promotionRequirement = DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.find(
  (item) => item.id === "PREPROD.PROMOTION.EVIDENCE_MANIFEST",
);
const dualDomainRequirement = DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.find(
  (item) => item.id === "PREPROD.PROMOTION.DUAL_DOMAIN_CUTOVER",
);

assert.equal(architectureRequirement?.status, "not-verified");
assert.equal(capacityRequirement?.status, "not-verified");
assert.equal(managedStagingRequirement?.status, "not-verified");
assert.equal(promotionRequirement?.status, "partially-verified");
assert.deepEqual(GREYHOUNDIQ_PRODUCTION_HOSTS, [
  "greyhoundsiq.com.au",
  "www.greyhoundsiq.com.au",
  "greyhoundsiq.com",
  "www.greyhoundsiq.com",
]);
assert.equal(dualDomainRequirement?.system, "promotion");
assert.equal(dualDomainRequirement?.status, "not-verified");
assert.equal(dualDomainRequirement?.releaseBlocking, true);
assert.deepEqual(dualDomainRequirement?.evidence, []);
assert.deepEqual(dualDomainRequirement?.tests, []);
assert.deepEqual(dualDomainRequirement?.operatorCommands, []);
assert.equal(
  dualDomainRequirement
    ? isDesignLabPreproductionRequirementComplete(dualDomainRequirement)
    : true,
  false,
);
const dualDomainContract = [
  dualDomainRequirement?.requirement,
  dualDomainRequirement?.simulationContract,
  dualDomainRequirement?.remainingEvidence,
  ...(dualDomainRequirement?.dependencies ?? []),
].join(" ");
for (const hostname of GREYHOUNDIQ_PRODUCTION_HOSTS) {
  assert.ok(dualDomainContract.includes(hostname), `${hostname} must be gated.`);
}
for (const control of GREYHOUNDIQ_DUAL_DOMAIN_CONTROLS) {
  assert.ok(dualDomainContract.includes(control), `${control} must be gated.`);
}
assert.match(dualDomainContract, /Daniel's explicit final approval/);
assert.match(dualDomainContract, /before changing public DNS or cutting over traffic/);
for (const requirement of [
  architectureRequirement,
  managedStagingRequirement,
  promotionRequirement,
]) {
  assert.ok(requirement?.evidence.includes("output/production-readiness/local-load/latest.json"));
  assert.ok(requirement?.evidence.includes("output/production-readiness/local-dr/latest.json"));
  assert.ok(requirement?.evidence.includes("output/gcp-provider-readiness/latest.json"));
  assert.ok(requirement?.evidence.includes("infra/terraform"));
}
assert.ok(capacityRequirement?.evidence.includes("output/production-readiness/local-load/latest.json"));
assert.ok(capacityRequirement?.evidence.includes("output/gcp-provider-readiness/latest.json"));
assert.ok(
  DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.every(
    (item) => !item.operatorCommands.includes("npm run db:seed")
  )
);
assert.ok(
  DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.every(
    (item) => item.remainingEvidence.trim()
  )
);
const mobileRequirements = DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.filter(
  (item) => item.system === "mobile",
);
assert.equal(mobileRequirements.length, 5);
assert.ok(mobileRequirements.every((item) => !item.releaseBlocking));
assert.ok(
  DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.filter(
    (item) => item.system !== "mobile",
  ).every((item) => item.releaseBlocking),
);
assert.ok(
  DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.some(
    (item) => item.id === "PREPROD.GCP.CLOUD_STORAGE" && item.status === "not-verified",
  ),
);
assert.ok(
  DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.some(
    (item) =>
      item.id === "PREPROD.GCP.APPLICATION_REALTIME" &&
      item.status === "not-verified",
  ),
);
assert.ok(
  DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.some(
    (item) =>
      item.id === "PREPROD.DATA.ALLOYDB_BOOTSTRAP_PROVIDER_REHYDRATION" &&
      item.releaseBlocking,
  ),
);

const fixture: DesignLabPreproductionRequirement = {
  ...DESIGN_LAB_PREPRODUCTION_REQUIREMENTS[0],
  status: "verified",
  evidence: ["evidence"],
  tests: ["test"],
};
assert.equal(isDesignLabPreproductionRequirementComplete(fixture), true);
assert.equal(
  isDesignLabPreproductionRequirementComplete({ ...fixture, evidence: [] }),
  false
);
assert.equal(
  isDesignLabPreproductionRequirementComplete({
    ...fixture,
    tests: ["PLACEHOLDER TEST: not runnable"],
  }),
  false,
);
assert.equal(
  isDesignLabPreproductionRequirementComplete({ ...fixture, tests: [] }),
  false
);
assert.equal(
  isDesignLabPreproductionRequirementComplete({
    ...fixture,
    status: "partially-verified",
  }),
  false
);

console.log("Design Lab pre-production requirement tests passed");
