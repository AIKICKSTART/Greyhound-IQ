import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { customPageCreateSchema } from "@/lib/custom-page-validation";
import {
  assertPaidFeatureAccess,
  assertProPlusFeatureAccess,
} from "@/lib/tier-access";

const source = (path: string) => readFileSync(path, "utf8");
const dock = source("src/components/mobile-bottom-dock.tsx");
const dockPolicy = source("src/lib/mobile-dock-policy.ts");
const layout = source("src/app/layout.tsx");
const pages = source("src/app/account/pages/page.tsx");
const pageEditor = source("src/app/account/pages/[id]/page.tsx");
const pageService = source("src/lib/custom-page-service.ts");
const tipsPage = source("src/app/agents/page.tsx");
const legacyTipsPage = source("src/app/tips/page.tsx");
const tipsApi = source("src/app/api/tips/preview/route.ts");
const tipsService = source("src/lib/tips-preview.ts");
const migration = source(
  "prisma/migrations/20260724113000_enforce_custom_page_pro_rls/migration.sql",
);

assert.throws(() => assertPaidFeatureAccess({ tier: "free" }), /payment\.required/);
assert.doesNotThrow(() => assertPaidFeatureAccess({ tier: "pro" }));
assert.doesNotThrow(() => assertPaidFeatureAccess({ tier: "pro_plus" }));
assert.throws(
  () => assertProPlusFeatureAccess({ tier: "pro" }),
  /payment\.required/,
);
assert.doesNotThrow(() => assertProPlusFeatureAccess({ tier: "pro_plus" }));

for (const pageType of ["trainer", "owner", "breeder", "kennel", "business"] as const) {
  const parsed = customPageCreateSchema.parse({
    pageType,
    title: `${pageType} page`,
    contactVisibility: "only_me",
    galleryMediaIds: [],
    services: [],
  });
  assert.equal(parsed.pageType, pageType);
}

assert.match(dock, /subscriptionDockLinkForTier\(tier\)/);
assert.match(dockPolicy, /href: "\/account\/pages", label: "Pages"/);
assert.match(dockPolicy, /href: "\/agents", label: "Tips"/);
assert.match(layout, /tier=\{user\.tier\}/);
assert.match(pages, /"trainer", "owner", "breeder", "kennel", "business"/);
assert.match(pageEditor, /<ProGate minTier="pro" feature="Page management">/);
assert.match(pageEditor, /name="services"/);
assert.match(pageService, /assertPaidFeatureAccess\(current\);/);
assert.match(pageService, /if \(!hasTier\(current\.tier, "pro"\)\) return Promise\.resolve\(\[\]\)/);

assert.match(tipsPage, /Tips are coming soon 🐾/);
assert.match(
  tipsPage,
  /Our prediction engine is still in training—studying every race,/,
);
assert.match(tipsPage, /hasTier\(current\.tier, "pro_plus"\)/);
assert.match(tipsPage, /Pro\+ sign-up coming soon/);
assert.match(legacyTipsPage, /permanentRedirect\("\/agents"\)/);
assert.match(tipsApi, /requireCurrentUserProfile\(\)/);
assert.match(tipsApi, /getTipsPreview\(current\)/);
assert.match(tipsService, /assertProPlusFeatureAccess\(current\)/);

for (const policy of [
  "giq_custom_page_select",
  "giq_custom_page_insert",
  "giq_custom_page_update",
  "giq_custom_page_delete",
]) {
  assert.match(migration, new RegExp(`CREATE POLICY ${policy}`));
}
assert.match(
  migration,
  /public\.giq_is_pro\(\)\s+AND "ownerProfileId" = public\.giq_current_profile_id\(\)/,
);
assert.match(
  migration,
  /\("published" = true AND "moderationStatus" <> 'removed'\)/,
);

console.log("Pages, Tips and subscription tier contract passed");
