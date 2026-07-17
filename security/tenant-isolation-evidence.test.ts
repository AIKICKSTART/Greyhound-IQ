import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { MASTER_AUDIT_REQUIREMENTS } from "../src/components/master-audit-requirements";
import {
  TENANT_ISOLATION_EVIDENCE_FILE,
  TENANT_ISOLATION_EXPECTED_GAIN,
  TENANT_ISOLATION_MASTER_EVIDENCE,
  TENANT_ISOLATION_SCOPE,
  TENANT_ISOLATION_TEST_FILE,
  VERIFIED_TENANT_ISOLATION_IDS,
} from "./tenant-isolation-evidence";

assert.equal(TENANT_ISOLATION_EXPECTED_GAIN, 7);
assert.equal(new Set(VERIFIED_TENANT_ISOLATION_IDS).size, 7);
assert.deepEqual(
  Object.keys(TENANT_ISOLATION_MASTER_EVIDENCE),
  VERIFIED_TENANT_ISOLATION_IDS,
);
for (const assertion of [
  /source and focused local-unit evidence/i,
  /same-user\/different-organization compound-key regression assertion/i,
  /does not claim a deployed cache inventory/i,
  /database RLS runtime coverage/i,
  /production job-worker behavior/i,
]) {
  assert.match(TENANT_ISOLATION_SCOPE, assertion);
}

for (const requirementId of VERIFIED_TENANT_ISOLATION_IDS) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) =>
      candidate.prompt === "security" && candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: immutable requirement missing`);

  const evidence = TENANT_ISOLATION_MASTER_EVIDENCE[requirementId];
  assert.deepEqual(evidence.evidence.slice(0, 2), [
    TENANT_ISOLATION_EVIDENCE_FILE,
    TENANT_ISOLATION_TEST_FILE,
  ]);
  assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
  evidence.evidence.forEach((path) =>
    assert.equal(existsSync(path), true, path),
  );
}

const organizationService = read("src/lib/organization-team-service.ts");
assert.match(
  organizationService,
  /organizationId_userId: \{ organizationId, userId \}/,
  "membership lookup must couple organization and user identities",
);

const sameUser = "user_same";
const membershipScopeKey = (organizationId: string, userId: string) =>
  `${organizationId}\u0000${userId}`;
assert.notEqual(
  membershipScopeKey("organization_a", sameUser),
  membershipScopeKey("organization_b", sameUser),
  "identical user IDs must not share an organization membership scope",
);

const siteHeader = read("src/components/site-header.tsx");
assert.match(
  siteHeader,
  /cached\(`notif:unread:\$\{user\.dbUserId\}`, 30_000, \(\) =>[\s\S]*countUnreadNotificationsForUser\(user\.dbUserId!\)/,
  "private notification caching must key on the current database user",
);
const queries = read("src/lib/queries.ts");
assert.match(
  queries,
  /function marketplaceListingsCacheKey\([\s\S]*status: filters\.status \?\? null,[\s\S]*offset: parseMarketplaceOffset\(filters\.offset\),/,
  "public listing cache keys must include all listing-result filters",
);
assert.match(
  queries,
  /const where: Prisma\.ListingWhereInput = \{[\s\S]*status: "active",[\s\S]*moderationStatus: "approved",[\s\S]*archivedAt: null,/,
  "shared marketplace cache must be restricted to active approved public listings",
);
assert.match(
  read("src/lib/ttl-cache.ts"),
  /do NOT use where a\s+\/\/ stale read is incorrect \(auth, entitlements, money\)/,
);

const conversation = read("src/lib/conversation-service.ts");
const search = sourceFunction(conversation, "searchConversationMessages");
assert.match(search, /withDbRequestContext\(current/);
assert.match(
  search,
  /id: conversationId,[\s\S]*participantAId: current\.profileId\s*\},[\s\S]*participantBId: current\.profileId\s*\}/,
  "search must resolve the conversation against the current participant before reading messages",
);
assert.match(search, /visibleMessageWhere\(current\.profileId\)/);

const exportService = read("src/lib/user-export-service.ts");
const exportRead = sourceFunction(exportService, "readUserExportData");
assert.match(exportRead, /withDbRequestContext\(current/);
for (const filter of [
  /where: \{ profileId: current\.profileId \}/,
  /where: \{ authorId: current\.profileId \}/,
  /where: \{ userId: current\.dbUserId \}/,
  /participantAId: current\.profileId/,
  /participantBId: current\.profileId/,
]) {
  assert.match(
    exportRead,
    filter,
    "export collection must remain current-user scoped",
  );
}

const accountService = read("src/lib/account-service.ts");
const deletionJobs = sourceFunction(
  accountService,
  "accountStorageDeletionJobsForUser",
);
assert.match(deletionJobs, /targetUserId: userId/);
assert.match(deletionJobs, /storagePath: accountStoragePrefix\(userId\)/);
assert.match(accountService, /account\.invalid_storage_deletion_job/);

const realtime = read("src/lib/realtime-service.ts");
const authorization = sourceFunction(realtime, "issueRealtimeAuthorization");
assert.match(authorization, /listRealtimeConversations\(current\)/);
assert.match(
  authorization,
  /buildRealtimeTopicGrants\(current\.profileId, conversations\)/,
);
assert.match(authorization, /requested_profile_id: current\.profileId/);
assert.match(
  authorization,
  /canProfileAccessConversationRealtime\(current\.profileId, conversation\)/,
);

console.log(
  "Tenant isolation evidence passed: seven source/local-unit controls remain ready for registry integration",
);

function read(path: string) {
  return readFileSync(path, "utf8");
}

function sourceFunction(source: string, name: string) {
  const marker = new RegExp(`export (?:async )?function ${name}\\b`);
  const match = marker.exec(source);
  const start = match?.index ?? -1;
  assert.notEqual(start, -1, `${name}: missing exported function`);
  const next = source.indexOf("\nexport ", start + match![0].length);
  return source.slice(start, next === -1 ? undefined : next);
}
