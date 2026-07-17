import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  assertDemoFixtureManifest,
  DEMO_CONTROL_ROOM_AVATAR,
  DEMO_FIXTURE_APPROVED_ASSETS,
  DEMO_FIXTURE_BOUND_SOURCE_FILES,
  DEMO_FIXTURE_MANIFEST,
  DEMO_PRIVATE_FIXTURE_ROW_COUNT,
} from "../../scripts/demo-route-fixture-contract";
import { assertDemoTarget } from "../../scripts/seed-demo-route-fixtures";

const root = join(__dirname, "../..");
const fixtureSource = readFileSync(
  join(root, "scripts/seed-demo-route-fixtures.ts"),
  "utf8",
);
const manifestSource = readFileSync(
  join(root, "scripts/demo-route-fixture-contract.ts"),
  "utf8",
);
const friendSource = readFileSync(join(__dirname, "friend-service.ts"), "utf8");
const conversationSource = readFileSync(
  join(__dirname, "conversation-service.ts"),
  "utf8",
);
const packageJson = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8"),
) as { scripts: Record<string, string> };

assert.doesNotThrow(() => assertDemoFixtureManifest());
assert.equal(DEMO_PRIVATE_FIXTURE_ROW_COUNT, 37);
assert.equal(DEMO_FIXTURE_MANIFEST.accounts.length, 4);
assert.equal(DEMO_FIXTURE_MANIFEST.accounts[0].displayName, "Adele Admin");
assert.equal(
  DEMO_FIXTURE_MANIFEST.accounts[0].avatarUrl,
  DEMO_CONTROL_ROOM_AVATAR,
);
assert.equal(DEMO_FIXTURE_MANIFEST.community.threadId, "demo-route-audit-thread");
assert.equal(DEMO_FIXTURE_APPROVED_ASSETS.length, 9);
assert.equal(
  new Set(DEMO_FIXTURE_APPROVED_ASSETS.map((asset) => asset.filePath)).size,
  DEMO_FIXTURE_APPROVED_ASSETS.length,
);
for (const asset of DEMO_FIXTURE_APPROVED_ASSETS) {
  const bytes = readFileSync(join(root, asset.filePath));
  assert.equal(bytes.byteLength, asset.sizeBytes, `${asset.id} byte length`);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    asset.sha256,
    `${asset.id} sha256`,
  );
  assert.equal(asset.provenance.synthetic, true);
  assert.equal(asset.provenance.realPersonSource, false);
  assert.equal(asset.provenance.approvedForPrivateFixtures, true);
}
for (const requiredSource of [
  "src/lib/demo-access.ts",
  "src/lib/demo-profile-media.ts",
  "scripts/demo-route-fixture-evidence.ts",
]) {
  assert.ok(
    (DEMO_FIXTURE_BOUND_SOURCE_FILES as readonly string[]).includes(
      requiredSource,
    ),
    `Fixture source binding is missing ${requiredSource}`,
  );
}

const privateFixturePayload = JSON.stringify(DEMO_FIXTURE_MANIFEST);
assert.doesNotMatch(privateFixturePayload, /Daniel Fleuren/);
assert.doesNotMatch(privateFixturePayload, /daniel-fleuren-founder-portrait/i);
assert.match(manifestSource, /demo_fixture_manifest\.real_person/);
for (const account of DEMO_FIXTURE_MANIFEST.accounts) {
  assert.match(account.email, /\.test$/);
  for (const id of [account.userId, account.profileId, account.actorId]) {
    assert.match(id, /^demo-/);
  }
  assert.match(account.actorHandle, /^demo-/);
}

for (const model of ["dog", "track", "meeting", "race"]) {
  assert.doesNotMatch(
    fixtureSource,
    new RegExp(`\\.${model}\\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\\s*\\(`),
    `The approved private-fixture seed must never mutate provider ${model} rows`,
  );
}
for (const contract of [
  "assertDemoFixtureManifest()",
  "ensureDemoIdentities",
  "resolveProviderRouteSamples",
  "findDemoProviderRouteSamples",
  "provider_samples_missing",
  "user_collision",
  "profile_collision",
  "actor_collision",
  "friendshipPair",
  "friendship_collision",
  "DEMO_PAGE_MEDIA_ASSETS",
  "galleryMediaIds:",
  "page_media_resolution_failed",
]) {
  assert.ok(
    fixtureSource.includes(contract),
    `Demo fixture must preserve the audited contract: ${contract}`,
  );
}

assert.equal(
  packageJson.scripts["db:demo:fixtures"],
  "tsx --conditions=react-server scripts/seed-demo-route-fixtures.ts",
);
assert.ok(
  !packageJson.scripts["db:demo:fixtures"].includes("db:seed"),
  "Design Lab fixture loading must not invoke the destructive general seed",
);

assert.doesNotThrow(() =>
  assertDemoTarget({
    APP_ENV: "demo",
    DEMO_AUTH_MODE: "full-access",
    DATABASE_URL: "postgresql://demo:demo@127.0.0.1:55734/greyhoundiq_demo_replay",
  }),
);
assert.doesNotThrow(() =>
  assertDemoTarget({
    APP_ENV: "demo",
    DEMO_AUTH_MODE: "full-access",
    DATABASE_URL: "postgresql://demo:demo@[::1]:55734/greyhoundiq_demo_replay",
  }),
);
assert.throws(
  () =>
    assertDemoTarget({
      APP_ENV: "demo",
      DEMO_AUTH_MODE: "full-access",
      DATABASE_URL: "postgresql://demo:demo@127.0.0.1:55734/greyhoundiq_demo_replay",
      NEXT_PUBLIC_APP_URL: "https://greyhoundiq.com.au",
    }),
  /blocked_production_host/,
);
assert.throws(
  () =>
    assertDemoTarget({
      APP_ENV: "demo",
      DEMO_AUTH_MODE: "full-access",
      DATABASE_URL: "postgresql://demo:demo@db.abcdefghij.supabase.co/postgres",
    }),
  /DEMO_STAGING_SUPABASE_PROJECT_REF is required/,
);
assert.throws(
  () =>
    assertDemoTarget({
      APP_ENV: "demo",
      DEMO_AUTH_MODE: "full-access",
      DATABASE_URL: "postgresql://demo:demo@db.abcdefghij.supabase.co/postgres",
      DEMO_STAGING_SUPABASE_PROJECT_REF: "zyxwvutsrq",
    }),
  /remote database project ref mismatch/,
);

assert.ok(
  friendSource.includes(
    "resolveDemoProfilePortrait(friend.displayName, friend.avatarUrl)",
  ),
  "Friend rows must preserve stored fixture media with the demo fallback",
);
for (const contract of [
  "isFullAccessDemo()",
  'DEMO_FRIEND_DISPLAY_NAME = "Patricia Pro"',
  'DEMO_FRIEND_CONVERSATION_ID = "demo-conversation-admin-pro"',
]) {
  assert.ok(friendSource.includes(contract), `Friend read contract missing: ${contract}`);
}
assert.equal(
  conversationSource.match(/displayName: true, avatarUrl: true/g)?.length,
  2,
);
assert.equal(
  conversationSource.match(
    /resolveDemoProfilePortrait\(\s*conversation\.participant[AB]\.displayName/g,
  )?.length,
  2,
);

console.log("synthetic private fixture contract tests passed");
