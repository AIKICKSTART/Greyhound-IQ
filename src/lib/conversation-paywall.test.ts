import assert from "node:assert/strict";

import type { CurrentUserProfile } from "@/lib/auth";
import {
  sendConversationMessage,
  startOrGetConversation,
} from "@/lib/conversation-service";

// F1 regression guard: direct messaging is Pro-only. Both chokepoints must
// reject a Free-tier caller BEFORE any DB work, so a Free user cannot bypass
// the paywall via /api/conversations, /api/messages, or the sendMessage action.
const freeUser = { tier: "free", profileId: "profile_free" } as CurrentUserProfile;

async function main() {
  await assert.rejects(
    () => startOrGetConversation(freeUser, "profile_recipient"),
    /payment\.required/
  );
  await assert.rejects(
    () => sendConversationMessage(freeUser, "conversation_1", { body: "hi" }),
    /payment\.required/
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
