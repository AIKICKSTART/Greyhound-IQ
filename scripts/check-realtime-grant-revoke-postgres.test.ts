import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DATABASE_OPERATIONS } from "../security/database-operations";
import {
  REALTIME_GRANT_REVOKE_EVIDENCE_PATH,
  REALTIME_GRANT_REVOKE_VERIFY_CONFIRMATION,
  assertRealtimeGrantRevokeVerifierTarget,
  validateRealtimeGrantRevokeEvidence,
} from "./check-realtime-grant-revoke-postgres";

const root = process.cwd();
const adminUrl = "postgresql://postgres@127.0.0.1:55734/postgres";
assert.equal(
  assertRealtimeGrantRevokeVerifierTarget(
    adminUrl,
    REALTIME_GRANT_REVOKE_VERIFY_CONFIRMATION,
  ).toString(),
  adminUrl,
);
for (const invalid of [
  "postgresql://postgres@127.0.0.1:55733/postgres",
  "postgresql://greyhoundiq_runtime@127.0.0.1:55734/postgres",
  "postgresql://postgres:secret@127.0.0.1:55734/postgres",
  "postgresql://postgres@localhost:55734/postgres",
  "postgresql://postgres@127.0.0.1:55734/greyhoundiq",
  "postgresql://postgres@127.0.0.1:55734/postgres?host=db.invalid",
]) {
  assert.throws(() =>
    assertRealtimeGrantRevokeVerifierTarget(
      invalid,
      REALTIME_GRANT_REVOKE_VERIFY_CONFIRMATION,
    ),
  );
}
assert.throws(() =>
  assertRealtimeGrantRevokeVerifierTarget(adminUrl, "wrong-confirmation"),
);

const evidence = JSON.parse(
  readFileSync(resolve(root, REALTIME_GRANT_REVOKE_EVIDENCE_PATH), "utf8"),
) as Record<string, unknown>;
assert.doesNotThrow(() =>
  validateRealtimeGrantRevokeEvidence(evidence, root),
);

const operation = DATABASE_OPERATIONS.find(
  (candidate) => candidate.queryId === "DB.PULSE.REALTIME_GRANT.REVOKE",
);
assert.ok(operation);
assert.equal(operation.verificationStatus, "Verified");
assert.equal(operation.sourceFile, "src/lib/realtime-service.ts");
assert.equal(operation.sourceSymbol, "revokeRealtimeTopicGrants");
assert.equal(operation.storedProcedure, "giq_revoke_realtime_topic_grants");
assert.equal(operation.databaseRole, "service_role");
assert.equal(
  operation.databaseName,
  "Supabase Realtime authorization database (deployment-specific); isolated proof database greyhoundiq_realtime_proof",
);
assert.equal(operation.schemaName, "public");
assert.equal(operation.maximumRowCount, 200);
assert.ok(
  operation.tests.includes(
    "scripts/check-realtime-grant-revoke-postgres.test.ts",
  ),
);
assert.ok(
  operation.evidence.some((entry) =>
    entry.includes(REALTIME_GRANT_REVOKE_EVIDENCE_PATH),
  ),
);

const policySource = source("scripts/sql/supabase-private-realtime-policies.sql");
for (const contract of [
  "cardinality(requested_profile_ids) > 10",
  "cardinality(requested_topics) > 10",
  "length(requested_profile.profile_id) > 128",
  "requested_topic.topic !~ '^conversation:[0-9a-f]{48}$'",
  "pg_catalog.pg_advisory_xact_lock",
  "select distinct requested_profile.profile_id",
  "order by requested_profile.profile_id",
  "where profile_id = any(requested_profile_ids)",
  "and topic = any(requested_topics)",
  "security definer",
  "set search_path = ''",
  "revoke all on function public.giq_revoke_realtime_topic_grants(text[], text[])\n  from public, anon, authenticated",
  "grant execute on function public.giq_revoke_realtime_topic_grants(text[], text[])\n  to service_role",
]) {
  assert.ok(policySource.includes(contract), contract);
}

const serviceSource = source("src/lib/realtime-service.ts");
const revokeService = between(
  serviceSource,
  "export async function revokeConversationRealtimeGrants",
  "function scopedRealtimeChannel",
);
assert.match(revokeService, /new Set\(profileIds\.map/);
assert.match(revokeService, /if \(!topic \|\| uniqueProfileIds\.length === 0\) return/);
assert.match(revokeService, /client\.rpc\("giq_revoke_realtime_topic_grants"/);
assert.match(revokeService, /requested_profile_ids: profileIds/);
assert.match(revokeService, /requested_topics: topics/);
assert.match(revokeService, /throw new Error\("realtime\.grant_revoke_failed"\)/);

console.log(
  "Realtime grant-revoke database evidence passed: isolated exact function, service-role-only execution, bounded idempotent deletion and cleanup",
);

function source(path: string) {
  return readFileSync(resolve(root, path), "utf8");
}

function between(value: string, start: string, end: string) {
  const from = value.indexOf(start);
  const to = value.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing source slice ${start} -> ${end}`);
  return value.slice(from, to);
}
