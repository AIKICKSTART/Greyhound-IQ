import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(__dirname, "feed-house-promotion.tsx"),
  "utf8"
);

for (const contract of [
  'export type FeedHousePromotionVariant = "compact" | "billboard"',
  'aria-label="GreyhoundIQ house promotion"',
  "GreyhoundIQ house promotion",
  "/images/feed/greyhoundiq-house-feed-ad.webp",
  "/images/feed/greyhoundiq-race-night-billboard.webp",
  'data-feed-house-promotion={variant}',
  'aria-label="GreyhoundIQ"',
]) {
  assert.ok(source.includes(contract), `House promotion must preserve: ${contract}`);
}

const housePromotionSource = source.slice(
  0,
  source.indexOf("export type FeedAdvertiserConceptBrand"),
);

assert.ok(
  !/sponsor|partnership/i.test(housePromotionSource),
  "House promotion must not make sponsor or partnership claims"
);

for (const contract of [
  'data-feed-advertiser-concept={brand}',
  'data-advertiser-placement={placement}',
  "Demo advertiser concept · Not a paid partnership",
  "18+ · Gamble responsibly · Creative requires partner and legal approval",
  "Text-only brand treatment for visual review.",
  "Concept interaction only — no wagering action is available.",
  "<details",
  "View concept notes",
  'A1: { compact: "ladbrokes", billboard: "tab" }',
  'A2: { compact: "sportsbet", billboard: "bet365" }',
  'B1: { compact: "tab", billboard: "sportsbet" }',
  'B2: { compact: "bet365", billboard: "ladbrokes" }',
  'C1: { compact: "sportsbet", billboard: "tab" }',
  'C2: { compact: "ladbrokes", billboard: "bet365" }',
]) {
  assert.ok(
    source.includes(contract),
    `Advertiser concept must preserve: ${contract}`,
  );
}

for (const brand of ["Ladbrokes", "TAB", "Sportsbet", "bet365"]) {
  assert.ok(source.includes(`name: "${brand}"`), `${brand} concept must exist`);
}

const advertiserSource = source.slice(
  source.indexOf("export function FeedAdvertiserConcept"),
);
assert.ok(
  !advertiserSource.includes("href="),
  "Advertiser concepts must not link to wagering or checkout destinations",
);
assert.ok(
  !advertiserSource.includes("<Image"),
  "Advertiser concepts must remain code-native without invented logo artwork",
);
assert.ok(
  !/bonus|boosted|deposit match|\$\d/i.test(advertiserSource),
  "Advertiser concepts must not invent promotional offers",
);

console.log("Feed house promotion contract tests passed");
