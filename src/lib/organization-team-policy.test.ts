import assert from "node:assert/strict";

import {
  canChangeTeamMemberRole,
  canInviteTeamRole,
  canLeaveTeam,
  canRemoveTeamMember,
  resolveTeamAuthority,
} from "./organization-team-policy";

assert.equal(
  resolveTeamAuthority({
    actorUserId: "owner",
    organizationOwnerId: "owner",
    membership: null,
  }),
  "owner",
);
assert.equal(
  resolveTeamAuthority({
    actorUserId: "stale-owner",
    organizationOwnerId: "owner",
    membership: { role: "owner", status: "active" },
  }),
  "member",
);
assert.equal(
  resolveTeamAuthority({
    actorUserId: "legacy-owner",
    organizationOwnerId: null,
    membership: { role: "owner", status: "accepted" },
  }),
  "owner",
);
assert.equal(
  resolveTeamAuthority({
    actorUserId: "removed-admin",
    organizationOwnerId: "owner",
    membership: { role: "admin", status: "removed" },
  }),
  "none",
);

assert.equal(canInviteTeamRole("owner", "admin"), true);
assert.equal(canInviteTeamRole("admin", "member"), true);
assert.equal(canInviteTeamRole("admin", "admin"), false);
assert.equal(canInviteTeamRole("member", "member"), false);

assert.equal(
  canRemoveTeamMember({
    authority: "owner",
    targetAuthority: "admin",
    isSelf: false,
  }),
  true,
);
assert.equal(
  canRemoveTeamMember({
    authority: "admin",
    targetAuthority: "member",
    isSelf: false,
  }),
  true,
);
assert.equal(
  canRemoveTeamMember({
    authority: "admin",
    targetAuthority: "admin",
    isSelf: false,
  }),
  false,
);
assert.equal(
  canRemoveTeamMember({
    authority: "owner",
    targetAuthority: "owner",
    isSelf: false,
  }),
  false,
);
assert.equal(
  canRemoveTeamMember({
    authority: "owner",
    targetAuthority: "member",
    isSelf: true,
  }),
  false,
);

assert.equal(
  canChangeTeamMemberRole({
    authority: "owner",
    targetAuthority: "member",
    nextRole: "owner",
    isSelf: false,
  }),
  true,
);
assert.equal(
  canChangeTeamMemberRole({
    authority: "admin",
    targetAuthority: "member",
    nextRole: "admin",
    isSelf: false,
  }),
  false,
);
assert.equal(
  canChangeTeamMemberRole({
    authority: "owner",
    targetAuthority: "owner",
    nextRole: "member",
    isSelf: false,
  }),
  false,
);

assert.equal(canLeaveTeam("owner"), false);
assert.equal(canLeaveTeam("admin"), true);
assert.equal(canLeaveTeam("member"), true);
assert.equal(canLeaveTeam("none"), false);

console.log("organization team policy tests passed");
