import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  ADMIN_NAV_ITEMS,
  adminHomeForRole,
  adminNavForRole,
} from "./admin-nav-data";

function hrefs(role: string) {
  return adminNavForRole(role).flatMap((group) =>
    group.items.map((item) => item.href)
  );
}

assert.equal(hrefs("moderator").includes("/admin/page-rules"), false);
assert.equal(hrefs("moderator").includes("/admin/site-content"), false);
assert.equal(hrefs("admin").includes("/admin/page-rules"), true);
assert.equal(hrefs("admin").includes("/admin/site-content"), true);
assert.equal(hrefs("moderator").includes("/admin/reports"), true);
assert.equal(adminHomeForRole("admin"), "/admin");
assert.equal(adminHomeForRole("moderator"), "/admin/reports");
assert.deepEqual(hrefs("member"), [], "unknown roles must receive no operator navigation");

const adminOnlyItems = ADMIN_NAV_ITEMS.filter(
  (item) => item.minimumRole === "admin"
);

assert.ok(adminOnlyItems.length > 0, "admin-only routes must be declared");
for (const item of adminOnlyItems) {
  assert.equal(
    hrefs("moderator").includes(item.href),
    false,
    `${item.href} must not appear in moderator navigation`
  );
  assert.equal(
    hrefs("admin").includes(item.href),
    true,
    `${item.href} must remain available to administrators`
  );

  const pagePath =
    item.href === "/admin"
      ? join(process.cwd(), "src", "app", "admin", "page.tsx")
      : join(process.cwd(), "src", "app", ...item.href.slice(1).split("/"), "page.tsx");
  const source = readFileSync(pagePath, "utf8");
  assert.match(
    source,
    /requireAdminProfile\(\)/,
    `${item.href} must enforce administrator access on the server`
  );
}

console.log("admin role-aware navigation tests passed");
