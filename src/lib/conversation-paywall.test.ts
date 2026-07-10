import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const service = readFileSync(join(__dirname, "conversation-service.ts"), "utf8");
const startBody = sliceFunction(service, "startOrGetConversation");
const sendBody = sliceFunction(service, "sendConversationMessage");

assert.match(
  startBody,
  /if \(senderActor\.kind === "page"\) \{\s+assertPaidFeatureAccess\(current\);/,
  "Only managed-page initiation requires Pro"
);
assert.ok(
  !sendBody.includes("assertPaidFeatureAccess("),
  "Downgraded page owners and Free personal members may reply to existing conversations"
);
assert.ok(
  /requireOwnedActor\(\s*current,\s*options\?\.senderActorId,\s*tx\s*\)/.test(
    startBody
  ),
  "The accountable profile must own the selected sender actor"
);
assert.ok(
  startBody.includes("assertConversationActorPair(conversation, actorPair)"),
  "An existing profile pair must not be relabelled as a different actor pair"
);
assert.ok(
  sendBody.includes("senderActorId: senderActor.id") &&
    sendBody.includes("recipientActorId: recipientActor.id"),
  "Messages must dual-write visible actors alongside legacy profiles"
);
const realtimePayload = sendBody.slice(
  sendBody.indexOf("await broadcastConversationRefresh"),
  sendBody.indexOf("await createInAppNotificationDeduped")
);
assert.ok(
  !realtimePayload.includes("input.body") &&
    !realtimePayload.includes("message.body"),
  "Conversation realtime broadcasts must remain content-free"
);

const migration = readFileSync(
  join(
    __dirname,
    "..",
    "..",
    "prisma",
    "migrations",
    "20260710133700_free_personal_conversation_start",
    "migration.sql"
  ),
  "utf8"
);
assert.ok(migration.includes("CREATE POLICY giq_conversation_insert"));
assert.ok(migration.includes("public.giq_current_profile_id() IN"));
assert.ok(migration.includes("giq_is_profile_in_conversation"));

console.log("personal conversation entitlement tests passed");

function sliceFunction(source: string, name: string) {
  const start = source.indexOf(`export async function ${name}`);
  assert.ok(start >= 0, `conversation-service.ts must export ${name}`);
  const rest = source.slice(start + 1);
  const nextExport = rest.search(/\nexport /);
  return nextExport >= 0 ? rest.slice(0, nextExport) : rest;
}
