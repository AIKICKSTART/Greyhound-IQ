import assert from "node:assert/strict";

import type { CurrentUserProfile } from "./auth";
import {
  assertAdmin,
  assertModerator,
  updateAdminResourceStatus,
} from "./admin-service";

function actor(profileRole: string): CurrentUserProfile {
  return {
    id: `${profileRole}-workos`,
    dbUserId: `${profileRole}-user`,
    profileId: `${profileRole}-profile`,
    email: `${profileRole}@example.test`,
    firstName: profileRole,
    lastName: null,
    name: profileRole,
    tier: "pro_plus",
    role: profileRole,
    isBanned: false,
    deletionRequestedAt: null,
    displayName: profileRole,
    profileRole,
    verified: true,
  };
}

async function main() {
  const member = actor("member");
  const moderator = actor("moderator");

  assert.throws(() => assertAdmin(member), /auth\.forbidden/);
  assert.throws(() => assertAdmin(moderator), /auth\.forbidden/);
  assert.doesNotThrow(() => assertModerator(moderator));
  assert.throws(() => assertModerator(member), /auth\.forbidden/);

  await assert.rejects(
    () =>
      updateAdminResourceStatus(moderator, {
        resource: "plan",
        id: "plan-not-reached",
        status: "inactive",
        reason: "Moderator denial check",
      }),
    /auth\.forbidden/,
    "a moderator must be denied before an administrator-only status mutation reaches the database",
  );

  console.log("admin service authorization denial tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
