import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const prototype = readFileSync(
  join(__dirname, "feed-system-prototype.tsx"),
  "utf8"
);
const header = readFileSync(
  join(__dirname, "feed-header-planner-prototype.tsx"),
  "utf8"
);
const preview = readFileSync(
  join(__dirname, "../app/feed/device-preview/page.tsx"),
  "utf8"
);
const styles = readFileSync(join(__dirname, "../app/globals.css"), "utf8");

for (const contract of [
  'data-social-hub-mode={socialMode ?? undefined}',
  'density={getPrototypePlannerDensity(variant)}',
  'socialMode === "compact" ? <CompactSocialDigest /> : null',
  'socialMode === "expanded" ? <SocialMomentum /> : null',
  'socialMode === "expanded" ? <RelationshipRail /> : null',
  'data-sponsored-marketplace={showMarketplacePreview ? "visible" : "hidden"}',
  "showMarketplacePreview ? (",
  'data-template-social-digest',
  'aria-label="Compact community signal preview"',
]) {
  assert.ok(prototype.includes(contract), `Feed prototype must preserve: ${contract}`);
}

for (const contract of [
  'data-social-hub-mode={mode}',
  'C1 · Expanded Social Data Hub',
  'C2 · Compact Social Data Hub',
  'Your racing network,',
  'Community signals,',
]) {
  assert.ok(header.includes(contract), `Social header must preserve: ${contract}`);
}

for (const selector of [
  '.giq-template-root[data-app-template="C1"] [data-template-social-momentum]',
  '.giq-template-root[data-app-template="C1"] [data-template-relationship-rail]',
  '.giq-template-root[data-app-template="C2"] [data-template-social-digest]',
  '.giq-template-root[data-app-template="C2"] .giq-template-feed-post',
]) {
  assert.ok(styles.includes(selector), `Variant styling must stay scoped: ${selector}`);
}

for (const contract of [
  'data-review-frame-id={reviewFrame.id}',
  'data-review-dock={reviewFrame.dock}',
  "data-review-target={targetHref}",
  "data-sponsored-marketplace={sponsoredMarketplace}",
  'Frame {reviewFrame.ordinal} of {APP_DOCK_REVIEW_FRAMES.length}',
  "src={targetHref}",
]) {
  assert.ok(preview.includes(contract), `Device preview must preserve: ${contract}`);
}

console.log("C1/C2 social and 108-frame app/dock review contracts passed");
