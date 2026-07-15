import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const proxy = readFileSync(join(__dirname, "proxy.ts"), "utf8");
const notFoundPage = readFileSync(
  join(__dirname, "app/not-found.tsx"),
  "utf8"
);

assert.match(notFoundPage, /export default function NotFound\(\)/);
assert.match(notFoundPage, /title: "Page Not Found — GreyhoundIQ"/);
assert.match(notFoundPage, />\s*404\s*<\/span>/);
assert.match(notFoundPage, /Off-track\./);
assert.match(notFoundPage, /href="\/"[\s\S]*Back to home/);
assert.match(notFoundPage, /href="\/dogs"[\s\S]*Search dogs/);
assert.doesNotMatch(
  notFoundPage,
  /\b(?:getCurrentUser|withAuth|requireAdminProfile|requireDesignLabReviewer)\s*\(/,
  "the public not-found experience must not acquire an authenticated gate"
);

assert.match(
  proxy,
  /dogs\|races\|tracks\|p\|forum\|groups\|listings\|marketplace/
);
assert.match(proxy, /FORUM_THREAD_ROUTE = \/\^\\\/\(forum\|groups\)/);
assert.match(proxy, /prisma\.forumCategory\.count\(\{ where: \{ slug: param \} \}\)/);
assert.match(proxy, /prisma\.thread\.count\(\{ where: \{ id: param \} \}\)/);
assert.match(proxy, /resolveDemoProviderRouteId\("dog", param\)/);
assert.match(proxy, /resolveDemoProviderRouteId\("race", param\)/);
assert.match(proxy, /resolveDemoProviderRouteId\("track", param\)/);

assert.match(proxy, /request\.cookies\.has\(sessionCookieName\)/);
assert.match(proxy, /hasAuthenticatedSession \|\|/);
assert.match(proxy, /NON_LISTING_DETAIL_SEGMENTS = new Set\(\["new", "design-lab"\]\)/);
assert.match(proxy, /moderationStatus: "approved"/);
assert.match(proxy, /archivedAt: null/);
assert.match(proxy, /expiresAt: \{ gt: new Date\(\) \}/);
assert.match(proxy, /NextResponse\.rewrite\(new URL\("\/_not-found-404"/);

console.log("proxy detail route 404 contract passed");
