import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { MARKETPLACE_TEMPLATE_LISTINGS } from "../../../components/marketplace-template-data";
import {
  DEFAULT_MARKETPLACE_TEMPLATE,
  MARKETPLACE_TEMPLATE_OPTIONS,
  resolveMarketplaceTemplateKey,
} from "../../../components/marketplace-template-variants";

// screen-evidence-test-id: DL-MARKETPLACE-TEMPLATES

const pageSource = readFileSync(join(__dirname, "page.tsx"), "utf8");
const componentSource = readFileSync(
  join(
    __dirname,
    "..",
    "..",
    "..",
    "components",
    "marketplace-template-catalogue.tsx"
  ),
  "utf8"
);
const styleSource = readFileSync(
  join(
    __dirname,
    "..",
    "..",
    "..",
    "components",
    "marketplace-template-catalogue.module.css"
  ),
  "utf8"
);
const registrySource = readFileSync(
  join(
    __dirname,
    "..",
    "..",
    "..",
    "components",
    "marketplace-template-variants.ts"
  ),
  "utf8"
);

assert.deepEqual(
  MARKETPLACE_TEMPLATE_OPTIONS.map(({ key, label, detail }) => ({
    key,
    label,
    detail,
  })),
  [
    { key: "M1", label: "Grandstand Market", detail: "Editorial discovery" },
    { key: "M2", label: "Compact Exchange", detail: "Dense comparison" },
    { key: "M3", label: "Market Control", detail: "Operations overview" },
    { key: "M4", label: "Seller Cockpit", detail: "Listing workflow" },
    { key: "M5", label: "Social Bazaar", detail: "Community discovery" },
    { key: "M6", label: "Data Exchange", detail: "Record comparison" },
  ],
  "M1-M6 registry must remain stable for Design Lab and Appearance consumers"
);
assert.equal(DEFAULT_MARKETPLACE_TEMPLATE, "M1");
assert.equal(resolveMarketplaceTemplateKey("M6"), "M6");
assert.equal(resolveMarketplaceTemplateKey("unknown"), "M1");
assert.equal(resolveMarketplaceTemplateKey(null), "M1");
assert.equal(resolveMarketplaceTemplateKey(undefined), "M1");
assert.ok(!registrySource.includes("import "));
assert.ok(!registrySource.includes("fetch("));

assert.equal(MARKETPLACE_TEMPLATE_LISTINGS.length, 6);
assert.deepEqual(
  MARKETPLACE_TEMPLATE_LISTINGS.map(({ name, starts, wins }) => ({
    name,
    starts,
    wins,
  })),
  [
    { name: "GreyhoundIQ Demo Rocket", starts: 10, wins: 3 },
    { name: "Saanvi", starts: 74, wins: 22 },
    { name: "Saahd", starts: 70, wins: 16 },
    { name: "Aariella's Girl", starts: 37, wins: 13 },
    { name: "O'hara", starts: 75, wins: 12 },
    { name: "Aaron Alpaca", starts: 67, wins: 11 },
  ]
);
assert.equal(
  new Set(MARKETPLACE_TEMPLATE_LISTINGS.map((listing) => listing.listingId))
    .size,
  MARKETPLACE_TEMPLATE_LISTINGS.length
);
assert.equal(
  new Set(MARKETPLACE_TEMPLATE_LISTINGS.map((listing) => listing.artworkSrc))
    .size,
  MARKETPLACE_TEMPLATE_LISTINGS.length
);
for (const listing of MARKETPLACE_TEMPLATE_LISTINGS) {
  assert.ok(listing.profileHref.startsWith("/dogs/"));
  assert.ok(listing.listingHref.startsWith("/marketplace"));
  assert.equal(listing.seller.displayName, "Seller details on listing");
  const assetPath = join(process.cwd(), "public", listing.artworkSrc.slice(1));
  assert.ok(existsSync(assetPath), `Missing Marketplace card asset: ${assetPath}`);
  const header = readFileSync(assetPath).subarray(0, 12);
  assert.equal(header.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(header.subarray(8, 12).toString("ascii"), "WEBP");
}

const layoutFamilies = [
  "editorial-grandstand",
  "dense-exchange",
  "command-centre",
  "seller-workbench",
  "community-stream",
  "comparison-matrix",
];
for (const [index, option] of MARKETPLACE_TEMPLATE_OPTIONS.entries()) {
  assert.ok(
    componentSource.includes(`data-marketplace-template="${option.key}"`),
    `${option.key} must have its own render surface`
  );
  assert.ok(
    componentSource.includes(`data-layout-family="${layoutFamilies[index]}"`),
    `${option.key} must preserve its distinct layout family`
  );
}
for (const componentName of [
  "M1GrandstandMarket",
  "M2CompactExchange",
  "M3MarketControl",
  "M4SellerCockpit",
  "M5SocialBazaar",
  "M6DataExchange",
]) {
  assert.ok(componentSource.includes(`function ${componentName}(`));
}

assert.ok(componentSource.includes('aria-label="Marketplace page templates"'));
assert.ok(componentSource.includes("MARKETPLACE_TEMPLATE_OPTIONS.map"));
assert.ok(componentSource.includes("<MarketplaceDogPlayerCard"));
assert.ok(componentSource.includes('saveMode="local"'));
assert.ok(!componentSource.includes("fetch("));
assert.ok(!componentSource.includes("/api/"));
assert.ok(!componentSource.includes('"use server"'));
assert.ok(styleSource.includes("@media (max-width: 74rem)"));
assert.ok(styleSource.includes("@media (max-width: 52rem)"));
assert.ok(styleSource.includes("@media (max-width: 38rem)"));
assert.ok(styleSource.includes("overflow-x: auto"));

assert.ok(pageSource.includes("searchParams: Promise"));
assert.ok(pageSource.includes("resolveMarketplaceTemplateKey"));
assert.ok(pageSource.includes("robots: { index: false, follow: false }"));
assert.ok(pageSource.includes('import { requireDesignLabReviewer } from "@/lib/design-lab-access"'));
assert.ok(pageSource.includes("await requireDesignLabReviewer();"));
assert.ok(!pageSource.includes("@/lib/auth"));
assert.ok(!pageSource.includes("@/lib/queries"));
assert.ok(!pageSource.includes("billing"));

console.log("Marketplace M1-M6 Design Lab contract tests passed");
