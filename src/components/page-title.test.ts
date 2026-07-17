import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const componentSource = readFileSync("src/components/page-title.tsx", "utf8");
const styles = readFileSync("src/app/globals.css", "utf8");

assert.match(componentSource, /<h1/);
assert.match(componentSource, /data-page-title="true"/);
assert.match(componentSource, /data-page-title-size=\{size\}/);
assert.match(componentSource, /giq-page-title/);

for (const styleContract of [
  /\.giq-page-title \{[\s\S]*font-family: var\(--font-display\)/,
  /\.giq-page-title \{[\s\S]*color: hsl\(var\(--metal-silver-bright\)\)/,
  /\.giq-page-title::before[\s\S]*var\(--secondary-light\)[\s\S]*var\(--primary-bright\)/,
  /\.giq-page-title::after[\s\S]*var\(--secondary-light\)[\s\S]*var\(--primary-bright\)/,
  /data-page-title-size="compact"/,
  /data-page-title-size="display"/,
  /@media \(max-width: 640px\)[\s\S]*\.giq-page-title/,
  /@media \(forced-colors: active\)[\s\S]*\.giq-page-title/,
]) {
  assert.match(styles, styleContract);
}

const sharedTitleSurfaces = [
  "src/components/page-hero.tsx",
  "src/components/website-kit.tsx",
  "src/app/admin/admin-page-header.tsx",
];

const directPageTitleSurfaces = [
  "src/app/account/page.tsx",
  "src/app/account/appearance/page.tsx",
  "src/app/account/billing/page.tsx",
  "src/app/account/listings/seller-listings-page.tsx",
  "src/app/account/notifications/page.tsx",
  "src/app/account/pages/page.tsx",
  "src/app/account/pages/[id]/page.tsx",
  "src/app/account/privacy/page.tsx",
  "src/app/account/profile/page.tsx",
  "src/app/account/saved-listings/page.tsx",
  "src/app/account/security/page.tsx",
  "src/app/account/support/page.tsx",
  "src/app/account/support/[id]/page.tsx",
  "src/app/account/team/page.tsx",
  "src/app/account/usage/page.tsx",
  "src/app/discover/page.tsx",
  "src/app/dogs/[id]/page.tsx",
  "src/app/forum/page.tsx",
  "src/app/forum/[slug]/page.tsx",
  "src/app/forum/threads/[id]/page.tsx",
  "src/app/listings/page.tsx",
  "src/app/listings/new/page.tsx",
  "src/app/listings/[id]/page.tsx",
  "src/app/listings/[id]/edit/page.tsx",
  "src/app/meetings/[id]/page.tsx",
  "src/app/messages/[id]/page.tsx",
  "src/app/p/[handle]/page.tsx",
  "src/app/privacy/page.tsx",
  "src/app/races/page.tsx",
  "src/app/races/[id]/page.tsx",
  "src/app/responsible-use/page.tsx",
  "src/app/terms/page.tsx",
  "src/app/tracks/[id]/page.tsx",
];

for (const path of [...sharedTitleSurfaces, ...directPageTitleSurfaces]) {
  const source = readFileSync(path, "utf8");
  assert.match(source, /<PageTitle/, `${path} must use the shared page title`);
  assert.match(
    source,
    /import \{ PageTitle \} from "@\/components\/page-title";/,
    `${path} must import the shared page title`,
  );
}

for (const path of sharedTitleSurfaces) {
  assert.doesNotMatch(
    readFileSync(path, "utf8"),
    /<h1\b/,
    `${path} must not retain a legacy raw page heading`,
  );
}

console.log(
  `Page title contract passed: ${directPageTitleSurfaces.length} direct production surfaces plus ${sharedTitleSurfaces.length} shared headers use the accessible logo-inspired title.`,
);
