import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  DATABASE_COMPATIBILITY_BASELINE,
  collectDatabaseCompatibilityInventory,
  databaseCompatibilityInventoryDiff,
} from "../scripts/check-database-compatibility-inventory";
import {
  ADMIN_CLI_MEMBERS,
  BACKGROUND_WORKER_MEMBERS,
  CACHE_OPERATION_MEMBERS,
  CLIENT_SEARCH_MEMBERS,
  DATABASE_FUNCTION_MEMBERS,
  DATABASE_TRIGGER_MEMBERS,
  EMAIL_WORKER_SEARCH_MEMBERS,
  QUEUE_CONSUMER_MEMBERS,
  QUEUE_MODEL_DISPOSITIONS,
  QUEUE_PUBLISHER_MEMBERS,
  REALTIME_CONNECTION_MEMBERS,
  REALTIME_EVENT_MEMBERS,
  RPC_CALL_MEMBERS,
  SEARCH_INDEX_OPERATION_MEMBERS,
  SERVER_COMPONENT_DATA_MEMBERS,
  discoverQueueModels,
} from "./source-surface-inventory";

const inventories = {
  serverComponentData: SERVER_COMPONENT_DATA_MEMBERS,
  worker: BACKGROUND_WORKER_MEMBERS,
  queuePublisher: QUEUE_PUBLISHER_MEMBERS,
  queueConsumer: QUEUE_CONSUMER_MEMBERS,
  databaseFunction: DATABASE_FUNCTION_MEMBERS,
  databaseTrigger: DATABASE_TRIGGER_MEMBERS,
  searchIndex: SEARCH_INDEX_OPERATION_MEMBERS,
  cache: CACHE_OPERATION_MEMBERS,
  rpc: RPC_CALL_MEMBERS,
  realtimeConnection: REALTIME_CONNECTION_MEMBERS,
  realtimeEvent: REALTIME_EVENT_MEMBERS,
  adminCli: ADMIN_CLI_MEMBERS,
  clientSearch: CLIENT_SEARCH_MEMBERS,
  emailWorkerSearch: EMAIL_WORKER_SEARCH_MEMBERS,
} as const;

const expectedCounts = {
  serverComponentData: 744,
  worker: 17,
  queuePublisher: 10,
  queueConsumer: 6,
  databaseFunction: 60,
  databaseTrigger: 21,
  searchIndex: 87,
  cache: 275,
  rpc: 2,
  realtimeConnection: 7,
  realtimeEvent: 69,
  adminCli: 73,
  clientSearch: 4,
  emailWorkerSearch: 4,
} as const;

const expectedDigests = {
  serverComponentData:
    "81bbb3d4dd9296c8eda287169e2b3018ee1366c45af95b406eb03570a6dae41d",
  worker: "22e462a7185be9ecc52051c1cdc3b28f296f6440061c616256923fc30ad205eb",
  queuePublisher:
    "d6776df6c198950b39573cf710e98f6fff341f6c195276a1d03aaa0dcda7db2b",
  queueConsumer:
    "0eae0c98347873771e614442cb780b9fd921f38f1872ee617abe532939116eb8",
  databaseFunction:
    "ef16370c1ed17e8219428291d868438a158395a2800d39c1b72eee136d368f4f",
  databaseTrigger:
    "6987d2cb4a13dd58063df215d327552c8cecc5d4c0a082ef9be6ad406869f16b",
  searchIndex:
    "0ff7a75667f873e8a32f3c89bd339c9bc3247af9b2826daf6c06e211d5365acb",
  cache: "4e29068925037c424bc5e77f2b6a9b79b1742f8d89fa13559ab55829a65cc9d4",
  rpc: "787958d1c1d51dc3050d1a27deed55f0329bb4a832bd3ae59aa5685797e6d1e9",
  realtimeConnection:
    "de8d002b265408f9c7d46ad5ab46f0f4364f0923e19d0716ed0a55eadc2fc966",
  realtimeEvent:
    "b58b931a0fffe410d88ad6e52460a042fe2733cfceecc3de5f64a4be0b9dc957",
  adminCli:
    "8e9e88c4889d676902df4ecd1ad9abe3f78afbf35fd18e7c9ff3ee60a1002cdb",
  clientSearch:
    "f1291446c4fb21044bbc02ede994121a291cb1662836f891d43ac880ad09f44d",
  emailWorkerSearch:
    "cd5018a48b02d4fc9d5ae98ab32ca7220a46236d75716254fe089a502187ddd4",
} as const;

for (const key of Object.keys(inventories) as Array<keyof typeof inventories>) {
  const members = inventories[key];
  assert.equal(
    members.length,
    expectedCounts[key],
    `${key} count changed; review and deliberately refresh its source inventory`,
  );
  assert.equal(new Set(members).size, members.length, `${key} contains duplicates`);
  assert.deepEqual(members, members.toSorted(), `${key} must be deterministic`);
  assert.equal(
    digest(members),
    expectedDigests[key],
    `${key} source boundary changed; review every added/removed member`,
  );
}

for (const member of [
  "SERVER-DATA src/app/account/appearance/page.tsx#getCurrentUser",
  "SERVER-DATA src/app/account/appearance/page.tsx#redirect",
]) {
  assert.ok(
    SERVER_COMPONENT_DATA_MEMBERS.includes(member),
    `${member}: production-disabled preview must still fail closed when enabled`,
  );
}

assert.deepEqual(discoverQueueModels(), [
  "DeletionJob",
  "Notification",
  "SignupOutbox",
  "UsageEvent",
  "UsageOutbox",
  "WebhookEvent",
]);
for (const disposition of QUEUE_MODEL_DISPOSITIONS) {
  assert.ok(
    QUEUE_PUBLISHER_MEMBERS.some((member) =>
      member.includes(`#${disposition.model}.`),
    ),
    `${disposition.model} needs at least one source publisher`,
  );
  assert.notEqual(
    disposition.consumers.length > 0,
    Boolean(disposition.consumerGap),
    `${disposition.model} needs consumers or one explicit unwired gap`,
  );
}
assert.deepEqual(
  QUEUE_MODEL_DISPOSITIONS.filter((entry) => entry.consumerGap).map(
    (entry) => entry.model,
  ),
  ["SignupOutbox"],
);

const usageInspector = readFileSync("scripts/usage-outbox-delivery.ts", "utf8");
assert.match(usageInspector, /requires --dry-run/);
assert.match(usageInspector, /dbMutations: none/);
assert.match(usageInspector, /lagoCalls: none/);

const compatibility = collectDatabaseCompatibilityInventory();
assert.deepEqual(databaseCompatibilityInventoryDiff(compatibility), []);
assert.equal(
  DATABASE_FUNCTION_MEMBERS.filter(
    (member) =>
      member.startsWith("FUNCTION app-db ") ||
      member.startsWith("FUNCTION app-migration-temp "),
  ).length,
  DATABASE_COMPATIBILITY_BASELINE.counts.functions,
);
assert.equal(
  DATABASE_TRIGGER_MEMBERS.length,
  DATABASE_COMPATIBILITY_BASELINE.counts.triggers,
);
assert.equal(
  DATABASE_FUNCTION_MEMBERS.filter((member) =>
    member.startsWith("FUNCTION supabase-realtime-db "),
  ).length,
  3,
);

assert.deepEqual(RPC_CALL_MEMBERS, [
  "RPC src/lib/realtime-service.ts#giq_replace_realtime_topic_grants",
  "RPC src/lib/realtime-service.ts#giq_revoke_realtime_topic_grants",
]);

assert.ok(
  REALTIME_CONNECTION_MEMBERS.some((member) => member.includes("livekit-room-connect")),
);
assert.ok(
  REALTIME_CONNECTION_MEMBERS.some((member) => member.includes("supabase-channel:feed:public")),
);
for (const event of [
  "RoomEvent.Disconnected",
  "message_created",
  "typing",
  "participant_joined",
]) {
  assert.ok(
    REALTIME_EVENT_MEMBERS.some((member) => member.includes(event)),
    `missing realtime event ${event}`,
  );
}
assert.ok(ADMIN_CLI_MEMBERS.some((member) => member.includes("npm:admin:bootstrap")));
assert.ok(ADMIN_CLI_MEMBERS.some((member) => member.includes("npm:gcp:deploy")));
assert.deepEqual(CLIENT_SEARCH_MEMBERS, [
  "CLIENT-ABSENT android-native:no Android project root",
  "CLIENT-ABSENT apple-native:no iOS/iPadOS project root",
  "CLIENT-ABSENT generated-api-client:no root or generator configuration",
  "CLIENT-SCOPE repository-workspace-root:. (separate repositories are outside this proof)",
]);
assert.deepEqual(EMAIL_WORKER_SEARCH_MEMBERS, [
  "EMAIL-ABSENT delivery-worker:no source-controlled email worker or sender call",
  "EMAIL-ABSENT outbound-provider:no runtime email SDK import",
  "EMAIL-SCOPE repository-source-only:provider-managed email delivery is outside this proof",
  "EMAIL-SURFACE src/app/p/[handle]/page.tsx#link:mailto",
]);

const packageSource = readFileSync("package.json", "utf8");
assert.doesNotMatch(
  packageSource,
  /"(?:@elastic\/|algoliasearch|elasticsearch|ioredis|meilisearch|redis|typesense)"/i,
  "a new external search/cache runtime requires a new explicit inventory adapter",
);

console.log(
  `Source surface inventory passed: ${SERVER_COMPONENT_DATA_MEMBERS.length} server-component data calls, ${BACKGROUND_WORKER_MEMBERS.length} workers, ${QUEUE_PUBLISHER_MEMBERS.length} publishers, ${QUEUE_CONSUMER_MEMBERS.length} consumers, ${DATABASE_FUNCTION_MEMBERS.length} routines, ${DATABASE_TRIGGER_MEMBERS.length} active triggers, ${SEARCH_INDEX_OPERATION_MEMBERS.length} search-index operations, ${CACHE_OPERATION_MEMBERS.length} cache operations, and ${RPC_CALL_MEMBERS.length} RPC callsites bound`,
);

function digest(members: readonly string[]) {
  return createHash("sha256").update(members.join("\n")).digest("hex");
}
