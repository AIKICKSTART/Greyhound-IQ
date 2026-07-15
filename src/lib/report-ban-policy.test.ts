import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { assertReportUserBanAllowed } from "./admin-access-contract";

type TestCase = {
  name: string;
  input: Parameters<typeof assertReportUserBanAllowed>[0];
  error?: RegExp;
};

const cases: readonly TestCase[] = [
  {
    name: "moderator can ban an ordinary member",
    input: {
      actingUserId: "moderator-1",
      actingRole: "moderator",
      actingCurrentlyActive: true,
      targetUserId: "member-1",
      targetCurrentRole: "member",
      targetCurrentlyActive: true,
      activeAdminCount: 1,
    },
  },
  {
    name: "moderator can ban an ordinary breeder",
    input: {
      actingUserId: "moderator-1",
      actingRole: "moderator",
      actingCurrentlyActive: true,
      targetUserId: "breeder-1",
      targetCurrentRole: "breeder",
      targetCurrentlyActive: true,
      activeAdminCount: 1,
    },
  },
  {
    name: "moderator can ban an ordinary trainer",
    input: {
      actingUserId: "moderator-1",
      actingRole: "moderator",
      actingCurrentlyActive: true,
      targetUserId: "trainer-1",
      targetCurrentRole: "trainer",
      targetCurrentlyActive: true,
      activeAdminCount: 1,
    },
  },
  {
    name: "moderator cannot ban themselves",
    input: {
      actingUserId: "moderator-1",
      actingRole: "moderator",
      actingCurrentlyActive: true,
      targetUserId: "moderator-1",
      targetCurrentRole: "moderator",
      targetCurrentlyActive: true,
      activeAdminCount: 1,
    },
    error: /admin\.self_lockout_forbidden/,
  },
  {
    name: "moderator cannot ban another moderator",
    input: {
      actingUserId: "moderator-1",
      actingRole: "moderator",
      actingCurrentlyActive: true,
      targetUserId: "moderator-2",
      targetCurrentRole: "moderator",
      targetCurrentlyActive: true,
      activeAdminCount: 1,
    },
    error: /auth\.forbidden/,
  },
  {
    name: "admin can ban another administrator when one remains",
    input: {
      actingUserId: "admin-1",
      actingRole: "admin",
      actingCurrentlyActive: true,
      targetUserId: "admin-2",
      targetCurrentRole: "admin",
      targetCurrentlyActive: true,
      activeAdminCount: 2,
    },
  },
  {
    name: "admin can ban a moderator",
    input: {
      actingUserId: "admin-1",
      actingRole: "admin",
      actingCurrentlyActive: true,
      targetUserId: "moderator-1",
      targetCurrentRole: "moderator",
      targetCurrentlyActive: true,
      activeAdminCount: 1,
    },
  },
  {
    name: "moderator cannot ban an administrator",
    input: {
      actingUserId: "moderator-1",
      actingRole: "moderator",
      actingCurrentlyActive: true,
      targetUserId: "admin-1",
      targetCurrentRole: "admin",
      targetCurrentlyActive: true,
      activeAdminCount: 2,
    },
    error: /auth\.forbidden/,
  },
  {
    name: "moderator cannot ban an unrecognized role",
    input: {
      actingUserId: "moderator-1",
      actingRole: "moderator",
      actingCurrentlyActive: true,
      targetUserId: "operator-1",
      targetCurrentRole: "operator",
      targetCurrentlyActive: true,
      activeAdminCount: 1,
    },
    error: /auth\.forbidden/,
  },
  {
    name: "moderator cannot ban a target with no role",
    input: {
      actingUserId: "moderator-1",
      actingRole: "moderator",
      actingCurrentlyActive: true,
      targetUserId: "profile-missing-1",
      targetCurrentRole: null,
      targetCurrentlyActive: true,
      activeAdminCount: 1,
    },
    error: /auth\.forbidden/,
  },
  {
    name: "admin can ban a target with no role",
    input: {
      actingUserId: "admin-1",
      actingRole: "admin",
      actingCurrentlyActive: true,
      targetUserId: "profile-missing-1",
      targetCurrentRole: null,
      targetCurrentlyActive: true,
      activeAdminCount: 1,
    },
  },
  {
    name: "administrator cannot ban themselves",
    input: {
      actingUserId: "admin-1",
      actingRole: "admin",
      actingCurrentlyActive: true,
      targetUserId: "admin-1",
      targetCurrentRole: "admin",
      targetCurrentlyActive: true,
      activeAdminCount: 2,
    },
    error: /admin\.self_lockout_forbidden/,
  },
  {
    name: "administrator cannot ban the last active administrator",
    input: {
      actingUserId: "admin-1",
      actingRole: "admin",
      actingCurrentlyActive: true,
      targetUserId: "admin-2",
      targetCurrentRole: "admin",
      targetCurrentlyActive: true,
      activeAdminCount: 1,
    },
    error: /admin\.last_admin_forbidden/,
  },
  {
    name: "inactive moderator cannot ban a member",
    input: {
      actingUserId: "moderator-1",
      actingRole: "moderator",
      actingCurrentlyActive: false,
      targetUserId: "member-1",
      targetCurrentRole: "member",
      targetCurrentlyActive: true,
      activeAdminCount: 1,
    },
    error: /auth\.forbidden/,
  },
  {
    name: "demoted moderator cannot ban a member",
    input: {
      actingUserId: "moderator-1",
      actingRole: "member",
      actingCurrentlyActive: true,
      targetUserId: "member-1",
      targetCurrentRole: "member",
      targetCurrentlyActive: true,
      activeAdminCount: 1,
    },
    error: /auth\.forbidden/,
  },
];

for (const testCase of cases) {
  if (testCase.error) {
    assert.throws(
      () => assertReportUserBanAllowed(testCase.input),
      testCase.error,
      testCase.name
    );
  } else {
    assert.doesNotThrow(
      () => assertReportUserBanAllowed(testCase.input),
      testCase.name
    );
  }
}

const reportServiceSource = readFileSync(join(__dirname, "report-service.ts"), "utf8");
const resolveReportSource = /export async function resolveReportForModerator\([\s\S]*?(?=\nasync function getReportedUserId)/.exec(
  reportServiceSource
)?.[0];
assert.ok(resolveReportSource, "resolveReportForModerator must remain exported");

const lockIndex = resolveReportSource.indexOf("await lockAdminAccessChanges(tx)");
const actorReadIndex = resolveReportSource.indexOf("const freshActor =");
const freshRoleIndex = resolveReportSource.indexOf(
  "actingRole: freshActor?.profile?.role"
);
const targetRoleIndex = resolveReportSource.indexOf(
  "targetCurrentRole: reported.profile?.role"
);
const policyIndex = resolveReportSource.indexOf("assertReportUserBanAllowed({");
const banUpdateIndex = resolveReportSource.indexOf("await tx.user.update({");
assert.ok(lockIndex >= 0, "report bans must serialize administrator access changes");
assert.ok(actorReadIndex > lockIndex, "report bans must refresh the actor after locking");
assert.ok(policyIndex > actorReadIndex, "report bans must authorize the refreshed actor");
assert.ok(
  freshRoleIndex > policyIndex && freshRoleIndex < banUpdateIndex,
  "report bans must pass the refreshed actor role to policy"
);
assert.ok(
  targetRoleIndex > policyIndex && targetRoleIndex < banUpdateIndex,
  "report bans must pass the refreshed target role to policy"
);
assert.doesNotMatch(
  resolveReportSource,
  /targetCurrentRole: reported\.profile\?\.role\s*\?\?/,
  "report bans must not convert a missing target role into an allowed role"
);
assert.match(
  resolveReportSource,
  /freshActor &&\s*!freshActor\.isBanned &&\s*freshActor\.deletionRequestedAt === null/,
  "report bans must use the refreshed actor status"
);
assert.ok(banUpdateIndex > policyIndex, "report bans must authorize before updating the user");

console.log("report ban policy tests passed");
