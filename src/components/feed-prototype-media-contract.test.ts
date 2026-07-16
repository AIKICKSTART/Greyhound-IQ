import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(__dirname, "feed-system-prototype.tsx"),
  "utf8",
);
const feedPageSource = readFileSync(
  join(__dirname, "../app/feed/page.tsx"),
  "utf8",
);

for (const asset of [
  "/images/feed/founder-race-night-cover.webp",
  "/images/feed/daniel-fleuren-founder-portrait.png",
  "/images/feed/posts/sarah-trackside-note.webp",
  "/images/feed/posts/mark-sectional-comparison.webp",
  "/images/feed/posts/trainer-recovery-update.webp",
  "/images/feed/posts/owner-fiftieth-start.webp",
  "/images/feed/posts/evidence-sectional-review.webp",
  "/images/feed/posts/trackside-weather-report.webp",
  "/images/feed/posts/breeding-family-discussion.webp",
  "/images/feed/posts/marketplace-seller-handover.webp",
  "/images/feed/posts/lisa-community-night.webp",
]) {
  assert.ok(source.includes(asset), `Feed prototype must use ${asset}`);
}

for (const profileName of [
  "Daniel Fleuren",
  "Sarah Thompson",
  "Mark Riley",
  "Lisa Grant",
  "James Cole",
  "Ava Martinez",
  "Joel Nguyen",
  "Priya Shah",
  "Ben Callaghan",
  "Mia Lawson",
  "Emma Reed",
]) {
  assert.ok(
    source.includes(`DEMO_PROFILE_PORTRAITS["${profileName}"]`),
    `Feed prototype must render the approved portrait for ${profileName}`,
  );
}

assert.ok(
  !source.includes('initials="'),
  "Feed prototype member posts must not fall back to initials-only fixtures",
);

assert.equal(
  source.match(/\/images\/feed\/founder-race-night-cover\.webp/g)?.length,
  2,
  "Founder cover must be shared by the sidebar and main identity banner",
);
assert.equal(
  source.match(/\/images\/feed\/daniel-fleuren-founder-portrait\.png/g)
    ?.length,
  2,
  "Daniel's exact portrait must be shared by both founder avatars",
);

const compactPromotion = source.indexOf(
  '<FeedHousePromotion variant="compact" />',
);
const compactAdvertiser = source.indexOf(
  "brand={advertiserConcepts.compact}",
);
const marketplace = source.indexOf(
  "<MarketplacePreview compact={compactFeed} />",
);
const billboardAdvertiser = source.indexOf(
  "brand={advertiserConcepts.billboard}",
);
const billboard = source.indexOf(
  '<FeedHousePromotion variant="billboard" />',
);

assert.ok(compactPromotion >= 0, "Compact house promotion must be rendered");
assert.ok(compactAdvertiser > compactPromotion, "Compact advertiser concept must follow the house promotion");
assert.ok(marketplace > compactAdvertiser, "Marketplace must follow the compact advertiser concept");
assert.ok(billboardAdvertiser > marketplace, "Billboard advertiser concept must follow Marketplace");
assert.ok(billboard > marketplace, "Billboard must follow Marketplace");

for (const contract of [
  "const advertiserConcepts = getFeedAdvertiserConcepts(variant);",
  "showDemoAdvertiserConcepts = false,",
  'data-demo-advertiser-concepts={showDemoAdvertiserConcepts ? "visible" : "hidden"}',
  "{showDemoAdvertiserConcepts ? (",
  "brand={advertiserConcepts.compact}",
  'placement="compact"',
  "brand={advertiserConcepts.billboard}",
  'placement="billboard"',
]) {
  assert.ok(source.includes(contract), `Advertiser showcase must preserve: ${contract}`);
}

assert.equal(
  source.match(/<FeedAdvertiserConcept/g)?.length,
  2,
  "Each sponsored demo feed must contain compact and billboard advertiser concepts",
);

for (const retiredAsset of [
  "/images/hero-breaking-from-boxes.webp",
  "/images/feature-advanced-stats-v2.webp",
  "/images/feature-breeding-analytics-v2.webp",
  "/images/feed/sarah-trackside-starting-boxes.webp",
  "/images/feed/mark-sectional-aerial-bend.webp",
  "/images/feed/lisa-community-race-night.webp",
]) {
  assert.ok(
    !source.includes(retiredAsset),
    `Feed prototype must not retain ${retiredAsset}`,
  );
}

assert.equal(
  feedPageSource.match(/<FeedSystemPrototype[\s\S]*?firstName="Daniel"/g)
    ?.length,
  2,
  "Both full-prototype entry branches must use the fixed Daniel founder fixture",
);

assert.equal(
  feedPageSource.match(/showDemoAdvertiserConcepts={showSponsoredMarketplace}/g)
    ?.length,
  1,
  "Third-party advertiser concepts must be enabled only by the explicit demo branch",
);

console.log("Feed prototype media contract tests passed");
