import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  ADMIN_AUTHORIZATION_INVENTORY,
  type AdminAuthorizationSurface,
} from "../src/app/admin/admin-authorization-inventory";
import { adminNavForRole } from "../src/app/admin/admin-nav-data";
import {
  assertAdminSelfAccessChange,
} from "../src/lib/admin-access-contract";
import { isAdminRole, isModeratorRole } from "../src/lib/auth-roles";
import { ADMINISTRATION_BOUNDARY_MASTER_EVIDENCE } from "./administration-boundary-evidence";

assert.equal(isAdminRole("admin"), true);
assert.equal(isAdminRole("moderator"), false);
assert.equal(isModeratorRole("admin"), true);
assert.equal(isModeratorRole("moderator"), true);

const moderatorNavigation = new Set(
  adminNavForRole("moderator").flatMap((group) =>
    group.items.map((item) => item.href),
  ),
);
for (const surface of ADMIN_AUTHORIZATION_INVENTORY.pages) {
  const source = readFileSync(surface.sourceFile, "utf8");
  assertSurfaceGuard(surface, source);
  if (surface.requiredRole === "admin") {
    assert.equal(
      moderatorNavigation.has(surface.id),
      false,
      `${surface.id}: moderator navigation must not expose administrator pages`,
    );
  }
}

for (const surface of ADMIN_AUTHORIZATION_INVENTORY.serverActions) {
  const source = readFileSync(surface.sourceFile, "utf8");
  const body = exportedAsyncFunction(source, surface.id);
  assert.ok(body, `${surface.id}: registered server action must exist`);
  assertSurfaceGuard(surface, body);
}

assert.throws(
  () =>
    assertAdminSelfAccessChange({
      actingUserId: "admin-1",
      targetUserId: "admin-1",
      nextRole: "moderator",
      banned: false,
    }),
  /admin\.self_lockout_forbidden/,
);

const adminServiceSource = readFileSync("src/lib/admin-service.ts", "utf8");
const resourceUnion = new Set(
  sourceBetween(adminServiceSource, "export type AdminResource =", ";")
    .match(/"[A-Za-z]+"/g)
    ?.map((value) => value.slice(1, -1)) ?? [],
);
const resourceCases = new Set(
  sourceBetween(adminServiceSource, "async function updateAllowedResource", "\n}\n\nasync function logAdminMutation")
    .match(/case "([A-Za-z]+)"/g)
    ?.map((value) => value.slice(6, -1)) ?? [],
);
assert.ok(resourceUnion.size > 0, "administrator resource allowlist is empty");
assert.deepEqual(
  [...resourceCases].toSorted(),
  [...resourceUnion].toSorted(),
  "every generic administrator resource must be explicitly reviewed in the switch allowlist",
);
assert.throws(
  () =>
    assertAdminSelfAccessChange({
      actingUserId: "admin-1",
      targetUserId: "admin-1",
      nextRole: "admin",
      banned: true,
    }),
  /admin\.self_lockout_forbidden/,
);

assert.equal(
  ADMIN_AUTHORIZATION_INVENTORY.runtimeDenial.status,
  "unverified",
  "source/local evidence must not claim deployed request-level denial",
);

for (const requirementId of Object.keys(
  ADMINISTRATION_BOUNDARY_MASTER_EVIDENCE,
)) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    ADMINISTRATION_BOUNDARY_MASTER_EVIDENCE[requirementId],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
}

console.log(
  "Administration boundary passed: five source/local controls verified; request-level denial remains unverified",
);

function assertSurfaceGuard(
  surface: AdminAuthorizationSurface,
  source: string,
) {
  const expectedGuard =
    surface.requiredRole === "admin"
      ? "requireAdminProfile()"
      : "requireModeratorProfile()";
  assert.ok(
    source.includes(expectedGuard),
    `${surface.id}: ${surface.requiredRole} server guard is required`,
  );
}

function exportedAsyncFunction(source: string, name: string) {
  const starts = [...source.matchAll(/^export async function (\w+)\s*\(/gm)];
  const index = starts.findIndex((match) => match[1] === name);
  if (index < 0) return null;
  return source.slice(starts[index].index, starts[index + 1]?.index ?? source.length);
}

function sourceBetween(source: string, startMarker: string, endMarker: string) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `missing end marker: ${endMarker}`);
  return source.slice(start, end);
}
