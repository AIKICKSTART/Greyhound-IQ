import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DESIGN_LAB_LOCAL_DATA_POLICY,
  DESIGN_LAB_LOCAL_DATA_POLICY_SUMMARY,
} from "../../security/local-data-policy";
import { DATA_CLASSIFICATIONS } from "../../security/data-classification";
import {
  DEMO_LOCAL_DERIVED_MODELS,
  DEMO_REFERENCE_SEED_MODELS,
  DEMO_SYNTHETIC_PRIVATE_MODELS,
} from "../../scripts/demo-route-fixture-contract";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};
const localDatabaseSource = readFileSync("scripts/local-database.ts", "utf8");
const liveSyncSource = readFileSync("scripts/sync-live.ts", "utf8");
const liveServiceSource = readFileSync("src/lib/live/sync.ts", "utf8");
const fixtureSource = readFileSync(
  "scripts/seed-demo-route-fixtures.ts",
  "utf8"
);
const prismaModels = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)]
  .map((match) => match[1])
  .sort();
const policyModels = Object.keys(DESIGN_LAB_LOCAL_DATA_POLICY).sort();

assert.deepEqual(
  policyModels,
  prismaModels,
  "every Prisma model must have exactly one local Design Lab data policy"
);
assert.equal(DESIGN_LAB_LOCAL_DATA_POLICY_SUMMARY.totalModels, prismaModels.length);
assert.equal(DESIGN_LAB_LOCAL_DATA_POLICY_SUMMARY.productionDatabaseCopyAllowed, 0);
assert.equal(DESIGN_LAB_LOCAL_DATA_POLICY_SUMMARY.providerPublic, 13);
assert.equal(DESIGN_LAB_LOCAL_DATA_POLICY_SUMMARY.providerMetadataOnly, 2);

for (const entry of Object.values(DESIGN_LAB_LOCAL_DATA_POLICY)) {
  assert.equal(entry.productionDatabaseCopy, "DENY");
  assert.ok(entry.classificationIds.length > 0);
  assert.ok(entry.relationStrategy.trim());
}

const classificationIds = new Set<string>(
  DATA_CLASSIFICATIONS.map((entry) => entry.id),
);
for (const entry of Object.values(DESIGN_LAB_LOCAL_DATA_POLICY)) {
  for (const classificationId of entry.classificationIds) {
    assert.ok(
      classificationIds.has(classificationId),
      `${entry.model} references undefined classification ${classificationId}`,
    );
  }
}
assert.ok(classificationIds.has("SYNTHETIC_PRIVATE"));
for (const model of DEMO_SYNTHETIC_PRIVATE_MODELS) {
  const entry = DESIGN_LAB_LOCAL_DATA_POLICY[model];
  assert.equal(entry.localSource, "SYNTHETIC_ONLY", `${model} fixture source`);
  assert.ok(entry.classificationIds.includes("SYNTHETIC_PRIVATE"));
}
for (const model of DEMO_REFERENCE_SEED_MODELS) {
  assert.equal(DESIGN_LAB_LOCAL_DATA_POLICY[model].localSource, "REFERENCE_SEED");
}
for (const model of DEMO_LOCAL_DERIVED_MODELS) {
  assert.equal(DESIGN_LAB_LOCAL_DATA_POLICY[model].localSource, "LOCAL_DERIVED");
}

assert.deepEqual(DESIGN_LAB_LOCAL_DATA_POLICY.Dog.nullFields, ["ownerName"]);
assert.deepEqual(DESIGN_LAB_LOCAL_DATA_POLICY.Runner.nullFields, [
  "startingPrice",
]);
assert.ok(
  DESIGN_LAB_LOCAL_DATA_POLICY.DogProfileArchive.nullFields.includes(
    "profileHtml"
  )
);
assert.deepEqual(DESIGN_LAB_LOCAL_DATA_POLICY.RaceDayArchive.nullFields, [
  "rawJson",
]);
assert.equal(DESIGN_LAB_LOCAL_DATA_POLICY.User.localSource, "SYNTHETIC_ONLY");
assert.equal(DESIGN_LAB_LOCAL_DATA_POLICY.AuditLog.localSource, "LOCAL_DERIVED");

const localGuardIndex = localDatabaseSource.indexOf(
  "assertLocalDatabaseUrl(LOCAL_DATABASE_URL)"
);
const localDispatchIndex = localDatabaseSource.indexOf(
  "switch (command as Command"
);
assert.ok(
  localGuardIndex >= 0 && localGuardIndex < localDispatchIndex,
  "the local database target must be rejected before any loader dispatch"
);
for (const databaseEnv of [
  "DATABASE_URL",
  "DIRECT_URL",
  "DATABASE_IMPORT_URL",
]) {
  assert.ok(
    localDatabaseSource.includes(`${databaseEnv}: LOCAL_DATABASE_URL`),
    `${databaseEnv} must receive the guarded loopback target`
  );
}
for (const [name, command] of Object.entries(packageJson.scripts).filter(
  ([name]) => name === "db:local" || name.startsWith("db:local:")
)) {
  assert.match(
    command,
    /^tsx scripts\/local-database\.ts(?:\s|$)/,
    `${name} must use the guarded local loader entrypoint`
  );
}

assert.equal(
  packageJson.scripts["db:demo:fixtures"],
  "tsx --conditions=react-server scripts/seed-demo-route-fixtures.ts"
);
const fixtureEntry = fixtureSource.slice(
  fixtureSource.indexOf("export async function seedDemoRouteFixtures()"),
  fixtureSource.indexOf("async function ensureDemoFixtureIntegrity") > -1
    ? fixtureSource.indexOf("async function ensureDemoFixtureIntegrity")
    : fixtureSource.indexOf("async function main()")
);
assert.ok(
  fixtureEntry.indexOf("assertDemoTarget()") >= 0 &&
    fixtureEntry.indexOf("assertDemoTarget()") <
      fixtureEntry.indexOf("withDbSystemContext"),
  "the synthetic fixture loader must reject its target before opening a write context"
);

assert.ok(
  localDatabaseSource.includes('case "sync-live":') &&
    localDatabaseSource.includes('runNpm(["run", "sync:live"'),
  "Design Lab live data must enter through the guarded local wrapper"
);
assert.ok(
  liveSyncSource.includes('import("../src/lib/live/sync")') &&
    liveSyncSource.includes("syncLiveData(daysArg(), scopeArg())"),
  "the live loader must delegate to the production provider ingestion service"
);
for (const source of [localDatabaseSource, liveSyncSource, liveServiceSource, fixtureSource]) {
  assert.doesNotMatch(
    source,
    /PRODUCTION_DATABASE_URL|PRODUCTION_DIRECT_URL|PRODUCTION_SUPABASE_DATABASE_URL/,
    "canonical Design Lab loaders must not expose a production database source"
  );
}

console.log(
  `Design Lab local data policy tests passed: ${policyModels.length} Prisma models, zero production-row copy paths and canonical loaders bound`
);
