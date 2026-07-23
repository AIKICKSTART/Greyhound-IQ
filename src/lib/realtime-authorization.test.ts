import assert from "node:assert/strict";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildRealtimeTopicGrants,
  canProfileAccessConversationRealtime,
  conversationRealtimeChannel,
  profileRealtimeChannel,
  revokeConversationRealtimeGrants,
} from "./realtime-service";

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const previousSecret = process.env.REALTIME_CHANNEL_SECRET;

  try {
    delete process.env.REALTIME_CHANNEL_SECRET;
    await assert.doesNotReject(() =>
      revokeConversationRealtimeGrants("conversation-no-channel", ["profile-a"]),
    );
    process.env.REALTIME_CHANNEL_SECRET = "realtime-authorization-test-secret";

  const openConversation = {
    id: "conversation-123",
    participantAId: "profile-a",
    participantBId: "profile-b",
    blockedById: null,
  };
  assert.equal(
    canProfileAccessConversationRealtime("profile-a", openConversation),
    true
  );
  assert.equal(
    canProfileAccessConversationRealtime("profile-c", openConversation),
    false,
    "non-participants must not receive conversation grants"
  );
  assert.equal(
    canProfileAccessConversationRealtime("profile-b", {
      ...openConversation,
      blockedById: "profile-a",
    }),
    false,
    "a blocked conversation must not receive a realtime grant"
  );

  const grants = buildRealtimeTopicGrants("profile-a", [
    openConversation,
    { ...openConversation, id: "conversation-unrelated", participantAId: "profile-c" },
    { ...openConversation, id: "conversation-blocked", blockedById: "profile-b" },
  ]);
  assert.deepEqual(grants, [
    {
      topic: conversationRealtimeChannel(openConversation.id),
      extension: "broadcast",
    },
    {
      topic: conversationRealtimeChannel(openConversation.id),
      extension: "presence",
    },
    {
      topic: profileRealtimeChannel("profile-a"),
      extension: "broadcast",
    },
  ]);
  assert.equal(
    grants.some((grant) => grant.topic.startsWith("presence:")),
    false,
    "authorization must never grant a global member-presence topic"
  );

  const observed: {
    functionName?: string;
    args?: Record<string, unknown>;
  } = {};
  const client = {
    async rpc(functionName: string, args: Record<string, unknown>) {
      observed.functionName = functionName;
      observed.args = args;
      return { error: null };
    },
  } as unknown as SupabaseClient;

    await revokeConversationRealtimeGrants(
      "conversation-123",
      ["profile-a", "profile-b", "profile-a"],
      client
    );
    assert.deepEqual(observed, {
      functionName: "giq_revoke_realtime_topic_grants",
      args: {
        requested_profile_ids: ["profile-a", "profile-b"],
        requested_topics: [conversationRealtimeChannel("conversation-123")],
      },
    });

    console.log("realtime authorization tests passed");
  } finally {
    if (previousSecret === undefined) delete process.env.REALTIME_CHANNEL_SECRET;
    else process.env.REALTIME_CHANNEL_SECRET = previousSecret;
  }
}
