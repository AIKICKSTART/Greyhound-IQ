import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  assertAdminSelfAccessChange,
  assertLastAdminAccessChange,
} from "./admin-access-contract";

assert.doesNotThrow(() =>
  assertAdminSelfAccessChange({
    actingUserId: "admin-1",
    targetUserId: "admin-1",
    nextRole: "admin",
    banned: false,
  })
);
assert.doesNotThrow(() =>
  assertAdminSelfAccessChange({
    actingUserId: "admin-1",
    targetUserId: "member-1",
    nextRole: "member",
    banned: true,
  })
);
assert.throws(
  () =>
    assertAdminSelfAccessChange({
      actingUserId: "admin-1",
      targetUserId: "admin-1",
      nextRole: "moderator",
      banned: false,
    }),
  /admin\.self_lockout_forbidden/
);
assert.throws(
  () =>
    assertAdminSelfAccessChange({
      actingUserId: "admin-1",
      targetUserId: "admin-1",
      nextRole: "admin",
      banned: true,
    }),
  /admin\.self_lockout_forbidden/
);

assert.throws(
  () =>
    assertLastAdminAccessChange({
      targetCurrentRole: "admin",
      targetCurrentlyActive: true,
      nextRole: "moderator",
      nextBanned: false,
      activeAdminCount: 1,
    }),
  /admin\.last_admin_forbidden/
);
assert.throws(
  () =>
    assertLastAdminAccessChange({
      targetCurrentRole: "admin",
      targetCurrentlyActive: true,
      nextRole: "admin",
      nextBanned: true,
      activeAdminCount: 1,
    }),
  /admin\.last_admin_forbidden/
);
assert.doesNotThrow(() =>
  assertLastAdminAccessChange({
    targetCurrentRole: "admin",
    targetCurrentlyActive: true,
    nextRole: "moderator",
    nextBanned: false,
    activeAdminCount: 2,
  })
);
assert.doesNotThrow(() =>
  assertLastAdminAccessChange({
    targetCurrentRole: "admin",
    targetCurrentlyActive: false,
    nextRole: "member",
    nextBanned: true,
    activeAdminCount: 1,
  })
);
assert.doesNotThrow(() =>
  assertLastAdminAccessChange({
    targetCurrentRole: "admin",
    targetCurrentlyActive: true,
    nextRole: "admin",
    nextBanned: false,
    activeAdminCount: 1,
  })
);

const adminServiceSource = readFileSync(join(__dirname, "admin-service.ts"), "utf8");
for (const action of ["createAdminUser", "updateAdminUserAccess"]) {
  const source = new RegExp(
    `export async function ${action}\\([\\s\\S]*?(?=\\nexport async function )`
  ).exec(adminServiceSource)?.[0];
  assert.ok(source, `${action} must remain exported`);
  assert.match(source, /lockAdminAccessChanges/, `${action} must serialize access changes`);
  assert.match(source, /assertAdminSelfAccessChange/, `${action} must block self-lockout`);
  assert.match(source, /assertLastAdminAccessChange/, `${action} must preserve an active admin`);
}

console.log("admin access contract tests passed");
