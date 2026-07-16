import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  assertDemoFixtureVerifierTarget,
  DEMO_FIXTURE_VERIFY_CONFIRMATION,
  deriveDemoFixtureCleanupUrl,
} from "./check-demo-route-fixture-idempotency";

const safe =
  "postgresql://greyhoundiq_runtime@127.0.0.1:55734/greyhoundiq";
assert.doesNotThrow(() =>
  assertDemoFixtureVerifierTarget(safe, DEMO_FIXTURE_VERIFY_CONFIRMATION),
);
assert.doesNotThrow(() =>
  assertDemoFixtureVerifierTarget(
    "postgresql://greyhoundiq_runtime@[::1]:55734/greyhoundiq",
    DEMO_FIXTURE_VERIFY_CONFIRMATION,
  ),
);
const runtimeTarget = assertDemoFixtureVerifierTarget(
  safe,
  DEMO_FIXTURE_VERIFY_CONFIRMATION,
);
const cleanupTarget = deriveDemoFixtureCleanupUrl(
  safe,
  DEMO_FIXTURE_VERIFY_CONFIRMATION,
);
assert.equal(cleanupTarget.hostname, runtimeTarget.hostname);
assert.equal(cleanupTarget.port, runtimeTarget.port);
assert.equal(cleanupTarget.pathname, runtimeTarget.pathname);
assert.equal(cleanupTarget.username, "postgres");
assert.equal(cleanupTarget.password, "");
assert.equal(cleanupTarget.searchParams.get("connection_limit"), "1");
assert.equal(
  cleanupTarget.searchParams.get("application_name"),
  "greyhoundiq_fixture_verifier_cleanup",
);
for (const unsafe of [
  "postgresql://greyhoundiq_runtime@127.0.0.1:55733/greyhoundiq",
  "postgresql://greyhoundiq_runtime@localhost:55734/greyhoundiq",
  "postgresql://greyhoundiq_runtime@127.0.0.1:55734/postgres",
  "postgresql://greyhoundiq_runtime@example.test:55734/greyhoundiq",
  "postgresql://greyhoundiq_runtime@127.0.0.1:55734/greyhoundiq?host=example.test",
  "postgresql://postgres@127.0.0.1:55734/greyhoundiq",
  "postgresql://greyhoundiq_runtime:password@127.0.0.1:55734/greyhoundiq",
]) {
  assert.throws(() =>
    assertDemoFixtureVerifierTarget(unsafe, DEMO_FIXTURE_VERIFY_CONFIRMATION),
  );
}
assert.throws(() => assertDemoFixtureVerifierTarget(safe, "wrong-confirmation"));

const source = readFileSync(
  "scripts/check-demo-route-fixture-idempotency.ts",
  "utf8",
);
for (const contract of [
  "runUserCollisionRollbackProbe",
  "runThreadCollisionRollbackProbe",
  "const firstSummary = await seedDemoRouteFixtures()",
  "const secondSummary = await seedDemoRouteFixtures()",
  "providerAfter.rowsSha256",
  "providerBefore.rowsSha256",
  "DB.AUTH.CALLBACK.ACCEPTANCE.TRANSACTION",
  "DB.PULSE.CONVERSATION.ACCESS.SELECT",
  "DB.MEDIA.ASSET.STATUS.SELECT",
  "DB.MEDIA.ASSET.DELETE.TOMBSTONE",
  "DB.ACCOUNT.DELETION.REQUEST.TRANSACTION",
  "DB.PULSE.CONVERSATION.BLOCK.UPDATE",
  "DB.PULSE.USER_BLOCK.UPSERT",
  "DB.AUTH.SIGNUP_OUTBOX.CLAIM",
  "DB.AUTH.SIGNUP_OUTBOX.SETTLE",
  "getConversationForProfile",
  "getMediaStatusForCurrentUser",
  "deleteMediaForCurrentUser",
  "requestAccountDeletion",
  "syncAuthUser",
  "setConversationBlock",
  "signupAcceptanceWorkerStore",
  "FOR UPDATE SKIP LOCKED",
  "demo_fixture.block_transaction_rollback",
  "demo_fixture.signup_outbox_claim_rollback",
  "demo_fixture.signup_outbox_complete_rollback",
  "demo_fixture.signup_outbox_retry_rollback",
  "demo_fixture.signup_outbox_dead_letter_rollback",
  "demo_fixture.media_delete_rollback",
  "demo_fixture.account_deletion_rollback",
  "demo_fixture.auth_acceptance_rollback",
  "duplicate-email-rejected-without-linking",
  "exact-user-insert-rejected-by-rls",
  "restored-user-and-inserted-one-audit",
  "returned-without-mutation",
  "exact-insert-returning-rejected",
  "insert-with-check-true-remains",
  "three-distinct-parameterized-statements",
  "unique-pair-read-no-second-mutation",
  "expectExactOperationError",
  "runtimeIdentity: identity[0]",
  "databaseOperationProofs",
  "captureDisposableReplayQueries",
  "observedSelectEvidence",
  "persistedParameterValues: false",
  "EXPLAIN (FORMAT JSON, ANALYZE FALSE",
  "DEMO_FIXTURE_QUERY_EVIDENCE_MODE",
  'process.env.REALTIME_BROADCAST_DISABLED = "true"',
  'process.env.REALTIME_CHANNEL_SECRET = "your_realtime_channel_secret"',
  'process.env.SUPABASE_URL = "http://127.0.0.1:1"',
  'process.env.SUPABASE_SERVICE_ROLE_KEY = "your_service_role_key"',
  "cleanupVerifierRows",
  "conversationBlockAuditWhere()",
  "mediaDeleteAuditWhere()",
  "accountDeletionAuditWhere",
  "AuthAcceptanceSignupOutbox",
  "AuthAcceptanceRestoreAuditLog",
  "SIGNUP_OUTBOX_CLAIM_PROBE_ID",
  "SIGNUP_OUTBOX_CLAIM_IDEMPOTENCY_KEY",
  "validateDemoFixtureEvidence(report",
  "buildDemoFixtureSourceBinding(root)",
  "elevatedAdminUsedForVerification: false",
  "elevatedAdminUsedForCleanupOnly: true",
]) {
  assert.ok(source.includes(contract), `Verifier contract missing: ${contract}`);
}
const databaseSource = readFileSync("src/lib/db.ts", "utf8");
for (const contract of [
  "capture-sanitized-statements-on-disposable-loopback-55734",
  '["127.0.0.1", "::1", "[::1]"].includes(url.hostname)',
  'url.port === "55734"',
  'url.pathname === "/greyhoundiq"',
  'decodeURIComponent(url.username) === "greyhoundiq_runtime"',
  'process.env.NODE_ENV === "production"',
  "disposable_query_evidence_capture_active",
]) {
  assert.ok(
    databaseSource.includes(contract),
    `Database query evidence guard missing: ${contract}`,
  );
}
assert.doesNotMatch(databaseSource, /console\.(?:log|info|warn|error).*params/);
const cleanupSource = source.slice(
  source.indexOf("async function cleanupVerifierRows"),
  source.indexOf("function canonicalize"),
);
assert.doesNotMatch(cleanupSource, /deleteMany\(\s*\{\s*\}\s*\)/);
assert.doesNotMatch(cleanupSource, /deleteMany\(\s*\{\s*where:\s*\{\s*\}/);
assert.doesNotMatch(cleanupSource, /startsWith|endsWith|NOT\s+IN/i);
for (const exactScope of [
  "DEMO_FIXTURE_MANIFEST.listing.historyId",
  "DEMO_FIXTURE_MANIFEST.conversation.messageId",
  "DEMO_FIXTURE_MANIFEST.conversation.id",
  "conversationBlockAuditWhere()",
  "mediaDeleteAuditWhere()",
  "accountDeletionAuditWhere(accounts[1].userId)",
  "blockerProfileId: accounts[0].profileId",
  "blockedProfileId: accounts[1].profileId",
  "id: SIGNUP_OUTBOX_CLAIM_PROBE_ID",
  "idempotencyKey: SIGNUP_OUTBOX_CLAIM_IDEMPOTENCY_KEY",
  "DEMO_FIXTURE_MANIFEST.pageMedia.map((asset) => asset.id)",
  "DEMO_FIXTURE_MANIFEST.community.threadId",
  "DEMO_FIXTURE_MANIFEST.friendship.id",
  "DEMO_FIXTURE_MANIFEST.providerSamples.raceId",
  "DEMO_FIXTURE_MANIFEST.providerSamples.trackId",
  "DEMO_FIXTURE_MANIFEST.providerSamples.dogId",
  "PROVIDER_MEETING_ID",
]) {
  assert.ok(cleanupSource.includes(exactScope), `Cleanup scope missing: ${exactScope}`);
}

console.log("demo fixture verifier safety tests passed");
