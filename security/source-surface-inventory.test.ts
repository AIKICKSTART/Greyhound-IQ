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
  serverComponentData: 779,
  worker: 17,
  queuePublisher: 10,
  queueConsumer: 6,
  databaseFunction: 62,
  databaseTrigger: 22,
  searchIndex: 87,
  cache: 288,
  rpc: 2,
  realtimeConnection: 7,
  realtimeEvent: 68,
  adminCli: 76,
  clientSearch: 4,
  emailWorkerSearch: 5,
} as const;

const expectedDigests = {
  serverComponentData:
    "f75eed1dccda2db6527995027419713cd80997df0cfc4529fc7d4aa8876b324e",
  worker: "22e462a7185be9ecc52051c1cdc3b28f296f6440061c616256923fc30ad205eb",
  queuePublisher:
    "d6776df6c198950b39573cf710e98f6fff341f6c195276a1d03aaa0dcda7db2b",
  queueConsumer:
    "0eae0c98347873771e614442cb780b9fd921f38f1872ee617abe532939116eb8",
  databaseFunction:
    "e481ade077e1d47ae328f0e1c1033d9f9f337e95fac877f6ad7decc631031a4d",
  databaseTrigger:
    "dcb30ffaa5e17ed2a89ad0fb0a0f72ea1eaaf3a528f9d1ea15590bc4c71a9572",
  searchIndex:
    "0ff7a75667f873e8a32f3c89bd339c9bc3247af9b2826daf6c06e211d5365acb",
  cache: "d4f967ee64fea727853a7a50ec5afb7d063b8fb9c0bbbc6f80acce2901f40a82",
  rpc: "787958d1c1d51dc3050d1a27deed55f0329bb4a832bd3ae59aa5685797e6d1e9",
  realtimeConnection:
    "de8d002b265408f9c7d46ad5ab46f0f4364f0923e19d0716ed0a55eadc2fc966",
  realtimeEvent:
    "989002767c6ee5cfb8d217b83576ae58e380b213886d86caa74514f6be4a406a",
  adminCli:
    "488caf2b1bba47da5a3fda82e5a1663a00254f79731ea28f017a2b1cbe2b9fce",
  clientSearch:
    "f1291446c4fb21044bbc02ede994121a291cb1662836f891d43ac880ad09f44d",
  emailWorkerSearch:
    "6177c3d140dcc48afe7e1796e8848f89fc9043dffec8fd518631c90cdb135a18",
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
  "EMAIL-SURFACE src/components/vet-finder/VetDetail.tsx#link:mailto",
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
