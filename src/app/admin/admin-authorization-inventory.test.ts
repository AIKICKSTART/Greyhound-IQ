import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { ADMIN_NAV_ITEMS } from "./admin-nav-data";
import {
  ADMIN_AUTHORIZATION_INVENTORY,
  assertAdminAuthorizationInventory,
  type AdminAuthorizationObservation,
  type AdminRequiredRole,
} from "./admin-authorization-inventory";
import { assertReportUserBanAllowed } from "../../lib/admin-access-contract";

const root = process.cwd();
const actual = [
  ...discoverPages(),
  ...discoverActions("src/app/admin/users/actions.ts", () => true),
  ...discoverActions("src/app/admin/mutations.ts", () => true),
  ...discoverActions(
    "src/app/actions.ts",
    (body) =>
      body.includes("requireAdminProfile()") ||
      body.includes("requireModeratorProfile()")
  ),
  ...discoverRouteHandlers("src/app/api/reports/[id]/resolve/route.ts"),
];

assert.equal(ADMIN_AUTHORIZATION_INVENTORY.pages.length, 32);
assert.equal(ADMIN_AUTHORIZATION_INVENTORY.serverActions.length, 32);
assert.equal(ADMIN_AUTHORIZATION_INVENTORY.routeHandlers.length, 1);
assert.equal(ADMIN_AUTHORIZATION_INVENTORY.runtimeDenial.status, "unverified");
assert.doesNotThrow(() => assertAdminAuthorizationInventory(actual));

const registeredPageRoles = ADMIN_AUTHORIZATION_INVENTORY.pages
  .map(({ id, requiredRole }) => `${id}:${requiredRole}`)
  .sort();
const navigationPageRoles = ADMIN_NAV_ITEMS.map(
  ({ href, minimumRole }) => `${href}:${minimumRole ?? "moderator"}`
).sort();
assert.deepEqual(navigationPageRoles, registeredPageRoles);

const firstPage = actual.find(({ kind }) => kind === "page")!;
assert.throws(
  () =>
    assertAdminAuthorizationInventory(
      actual.filter((surface) => surface !== firstPage)
    ),
  /missing surface: page:/
);
assert.throws(
  () =>
    assertAdminAuthorizationInventory([
      ...actual,
      {
        kind: "page",
        id: "/admin/unregistered",
        sourceFile: "src/app/admin/unregistered/page.tsx",
        requiredRole: "moderator",
      },
    ]),
  /unregistered surface: page:\/admin\/unregistered/
);

const firstAction = actual.find(({ kind }) => kind === "server-action")!;
assert.throws(
  () =>
    assertAdminAuthorizationInventory(
      actual.filter((surface) => surface !== firstAction)
    ),
  /missing surface: server-action:/
);
assert.throws(
  () =>
    assertAdminAuthorizationInventory([
      ...actual,
      {
        kind: "server-action",
        id: "unregisteredAdminAction",
        sourceFile: "src/app/admin/mutations.ts",
        requiredRole: "admin",
      },
    ]),
  /unregistered surface: server-action:unregisteredAdminAction/
);

const usersPage = actual.find(
  ({ kind, id }) => kind === "page" && id === "/admin/users"
)!;
assert.throws(
  () =>
    assertAdminAuthorizationInventory(
      actual.map((surface) =>
        surface === usersPage
          ? { ...surface, requiredRole: "moderator" }
          : surface
      )
    ),
  /surface mismatch: page:\/admin\/users expected admin/
);

const userAccessMutation = actual.find(
  ({ kind, id }) =>
    kind === "server-action" && id === "updateAdminUserAccessAction"
)!;
assert.equal(
  userAccessMutation.requiredRole,
  "admin",
  "tier, role, verification, ban, and deletion-cancellation mutation must remain administrator-only"
);

const peerBanControl = ADMIN_AUTHORIZATION_INVENTORY.controls.find(
  ({ id }) => id === "moderator-peer-ban-policy"
)!;
assert.equal(peerBanControl.status, "tested");
assert.equal(peerBanControl.decision, "deny");
assert.throws(() =>
  assertReportUserBanAllowed({
    actingUserId: "moderator-1",
    actingRole: "moderator",
    actingCurrentlyActive: true,
    targetUserId: "moderator-2",
    targetCurrentRole: "moderator",
    targetCurrentlyActive: true,
    activeAdminCount: 1,
  }),
  /auth\.forbidden/
);
assert.throws(
  () =>
    assertReportUserBanAllowed({
      actingUserId: "moderator-1",
      actingRole: "moderator",
      actingCurrentlyActive: true,
      targetUserId: "operator-1",
      targetCurrentRole: "operator",
      targetCurrentlyActive: true,
      activeAdminCount: 1,
    }),
  /auth\.forbidden/
);
assert.throws(
  () =>
    assertReportUserBanAllowed({
      actingUserId: "moderator-1",
      actingRole: "moderator",
      actingCurrentlyActive: true,
      targetUserId: "profile-missing-1",
      targetCurrentRole: null,
      targetCurrentlyActive: true,
      activeAdminCount: 1,
    }),
  /auth\.forbidden/
);
assert.doesNotThrow(() =>
  assertReportUserBanAllowed({
    actingUserId: "admin-1",
    actingRole: "admin",
    actingCurrentlyActive: true,
    targetUserId: "moderator-1",
    targetCurrentRole: "moderator",
    targetCurrentlyActive: true,
    activeAdminCount: 1,
  })
);
assert.equal(
  ADMIN_AUTHORIZATION_INVENTORY.blockers
    .map(({ id }) => id as string)
    .includes("moderator-peer-ban-policy"),
  false
);

const concurrencyBlocker = ADMIN_AUTHORIZATION_INVENTORY.blockers.find(
  ({ id }) => id === "last-admin-self-lockout-db-concurrency"
)!;
assert.equal(concurrencyBlocker.status, "blocked");
assert.equal(concurrencyBlocker.decision, "evidence-missing");

console.log("admin authorization inventory tests passed");

function discoverPages(): AdminAuthorizationObservation[] {
  const adminRoot = join(root, "src", "app", "admin");
  return findPages(adminRoot).map((file) => {
    const relativePage = relative(root, file).replaceAll("\\", "/");
    const relativeRoute = relative(adminRoot, file)
      .replaceAll("\\", "/")
      .replace(/\/?page\.tsx$/, "");
    const body = readFileSync(file, "utf8");
    return {
      kind: "page",
      id: `/admin${relativeRoute ? `/${relativeRoute}` : ""}`,
      sourceFile: relativePage,
      requiredRole: roleFromSource(body),
    };
  });
}

function findPages(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findPages(path);
    return entry.name === "page.tsx" ? [path] : [];
  });
}

function discoverActions(
  sourceFile: string,
  include: (body: string) => boolean
): AdminAuthorizationObservation[] {
  const source = readFileSync(join(root, sourceFile), "utf8");
  return exportedAsyncFunctions(source)
    .filter(({ body }) => include(body))
    .map(({ name, body }) => ({
      kind: "server-action",
      id: name,
      sourceFile,
      requiredRole: roleFromSource(body),
    }));
}

function discoverRouteHandlers(
  sourceFile: string
): AdminAuthorizationObservation[] {
  const source = readFileSync(join(root, sourceFile), "utf8");
  return exportedAsyncFunctions(source).map(({ name, body }) => ({
    kind: "route-handler",
    id: `${name} /api/reports/[id]/resolve`,
    sourceFile,
    requiredRole: roleFromSource(body),
  }));
}

function exportedAsyncFunctions(source: string) {
  const starts = [...source.matchAll(/^export async function (\w+)\s*\(/gm)];
  return starts.map((match, index) => ({
    name: match[1],
    body: source.slice(
      match.index,
      starts[index + 1]?.index ?? source.length
    ),
  }));
}

function roleFromSource(source: string): AdminRequiredRole | "unguarded" {
  if (source.includes("requireAdminProfile()")) return "admin";
  if (source.includes("requireModeratorProfile()")) return "moderator";
  return "unguarded";
}
