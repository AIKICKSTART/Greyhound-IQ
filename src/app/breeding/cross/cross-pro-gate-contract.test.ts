import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Test mating is sold as a Pro ($20/month) feature. The page must gate the
// tool UI and BOTH cross APIs must enforce the tier server-side — a client
// gate alone is bypassable with a direct request.

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

const page = read("src/app/breeding/cross/page.tsx");
assert.ok(page.includes('hasTier(user.tier, "pro")'), "page must check Pro tier");
assert.ok(page.includes("CrossUpsell"), "page must upsell free users");
assert.ok(page.includes("/pricing"), "upsell must route to pricing");

for (const routePath of [
  "src/app/api/breeding/cross/route.ts",
  "src/app/api/breeding/cross/partners/route.ts",
]) {
  const route = read(routePath);
  assert.ok(route.includes('hasTier(user.tier, "pro")'), `${routePath} must enforce Pro`);
  assert.ok(route.includes("tier.pro_required"), `${routePath} must return the tier error code`);
  // Legacy hist_dog_* ids carry underscores; the id guard must accept them.
  assert.ok(route.includes("/^[a-z0-9_-]+$/iu"), `${routePath} must accept legacy ids`);
}

const pricing = read("src/lib/site-content.ts");
assert.ok(
  pricing.includes("Test mating — full sire × dam cross records"),
  "Pro plan must list test mating",
);
assert.ok(pricing.includes("No test mating tool"), "Free plan must state the exclusion");

console.log("test mating pro gate contract tests passed");
