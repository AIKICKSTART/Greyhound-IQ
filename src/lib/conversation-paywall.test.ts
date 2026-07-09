import assert from "node:assert/strict";

import type { CurrentUserProfile } from "@/lib/auth";
import {
  sendConversationMessage,
  startOrGetConversation,
} from "@/lib/conversation-service";

// Paywall contract: STARTING a conversation is Pro-only and must reject a
// Free-tier caller BEFORE any DB work. REPLYING is open to any tier, but only
// inside a conversation the sender already participates in — a Free caller on
// a conversation they don't belong to gets conversation.not_found, never a
// message write. (DB triggers giq_message_write_guard/giq_conversation_write_guard
// enforce the same shape under RLS.)
const freeUser = { tier: "free", profileId: "profile_free" } as CurrentUserProfile;

async function main() {
  await assert.rejects(
    () => startOrGetConversation(freeUser, "profile_recipient"),
    /payment\.required/
  );
  // Reply path: participant check happens first; a non-participant (or
  // nonexistent) conversation is rejected without touching Message.
  await assert.rejects(
    () => sendConversationMessage(freeUser, "conversation_nonexistent", { body: "hi" }),
    /conversation\.not_found/
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
