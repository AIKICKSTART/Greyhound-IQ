import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import { ADMIN_AUTHORIZATION_INVENTORY } from "../src/app/admin/admin-authorization-inventory";
import { isAdminRole, isModeratorRole } from "../src/lib/auth-roles";
import { MODERATOR_API_BOUNDARY_MASTER_EVIDENCE } from "./moderator-api-boundary-evidence";

assert.equal(isAdminRole("moderator"), false);
assert.equal(isAdminRole("admin"), true);
assert.equal(isModeratorRole("moderator"), true);
assert.equal(isModeratorRole("admin"), true);

assert.deepEqual(ADMIN_AUTHORIZATION_INVENTORY.routeHandlers, [
  {
    kind: "route-handler",
    id: "POST /api/reports/[id]/resolve",
    sourceFile: "src/app/api/reports/[id]/resolve/route.ts",
    requiredRole: "moderator",
  },
]);
const moderatorRoute = readFileSync(
  "src/app/api/reports/[id]/resolve/route.ts",
  "utf8",
);
assert.match(moderatorRoute, /requireModeratorProfile\(\)/);
assert.doesNotMatch(moderatorRoute, /requireAdminProfile\(\)/);

const adminOnlySurfaces = [
  ...ADMIN_AUTHORIZATION_INVENTORY.pages,
  ...ADMIN_AUTHORIZATION_INVENTORY.serverActions,
].filter(({ requiredRole }) => requiredRole === "admin");
assert.ok(adminOnlySurfaces.length > 0);
for (const surface of adminOnlySurfaces) {
  const source = readFileSync(surface.sourceFile, "utf8");
  assert.match(
    source,
    /requireAdminProfile\(\)/,
    `${surface.id}: admin-only source must use the distinct admin guard`,
  );
}

const requirementId =
  "security.api-inventory-management.moderator-not-admin";
assert.deepEqual(
  SECURITY_MASTER_EVIDENCE[requirementId],
  MODERATOR_API_BOUNDARY_MASTER_EVIDENCE[requirementId],
);
const requirement = MASTER_AUDIT_REQUIREMENTS.find(
  (candidate) => candidate.id === requirementId,
);
assert.ok(requirement);
assert.equal(isMasterRequirementComplete(requirement), true);

console.log(
  "Moderator API boundary passed: moderator access stays distinct from administrator-only surfaces",
);

