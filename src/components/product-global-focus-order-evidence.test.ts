import { strict as assert } from "node:assert";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import {
  PRODUCT_GLOBAL_FOCUS_ORDER_EVIDENCE_SCOPE,
  PRODUCT_GLOBAL_FOCUS_ORDER_MASTER_EVIDENCE,
  PRODUCT_GLOBAL_FOCUS_ORDER_REQUIREMENT_IDS,
} from "./product-global-focus-order-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

const repositoryRoot = process.cwd();
const sourceRoot = join(repositoryRoot, "src");

function findFiles(
  directory: string,
  matcher: (fileName: string) => boolean,
): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return findFiles(entryPath, matcher);
    }

    return matcher(entry.name) ? [entryPath] : [];
  });
}

assert.deepEqual(PRODUCT_GLOBAL_FOCUS_ORDER_REQUIREMENT_IDS, [
  "GLOBAL.A11Y.focus-order",
]);
assert.deepEqual(Object.keys(PRODUCT_GLOBAL_FOCUS_ORDER_MASTER_EVIDENCE), [
  "GLOBAL.A11Y.focus-order",
]);
assert.match(PRODUCT_GLOBAL_FOCUS_ORDER_EVIDENCE_SCOPE, /does not prove browser layout/);

const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  (candidate) => candidate.id === "GLOBAL.A11Y.focus-order",
);
assert.ok(requirement, "The product master must define the focus-order requirement.");
assert.equal(
  PRODUCT_GLOBAL_FOCUS_ORDER_MASTER_EVIDENCE["GLOBAL.A11Y.focus-order"].status,
  "tested",
);

for (const evidencePath of PRODUCT_GLOBAL_FOCUS_ORDER_MASTER_EVIDENCE[
  "GLOBAL.A11Y.focus-order"
].evidence) {
  assert.doesNotThrow(() => readFileSync(join(repositoryRoot, evidencePath)), evidencePath);
}

const visualOrderUtilities = findFiles(
  sourceRoot,
  (fileName) => fileName.endsWith(".tsx") && !fileName.endsWith(".test.tsx"),
).flatMap((filePath) => {
  const contents = readFileSync(filePath, "utf8");
  const matches = contents.match(/\border-(?:first|last|\d+|\[[^\]]+\])/g) ?? [];
  const displayPath = relative(repositoryRoot, filePath).replaceAll("\\", "/");

  return matches.map((match) => `${displayPath}:${match}`);
});

assert.deepEqual(visualOrderUtilities, ["src/app/listings/page.tsx:order-first"]);

const listings = readFileSync(join(sourceRoot, "app/listings/page.tsx"), "utf8");
const listingMedia = listings.indexOf("data-marketplace-item-media");
const listingContent = listings.indexOf('className="flex flex-1 flex-col p-5 pt-4"');
assert.ok(listingMedia >= 0, "The permitted order-first marker must remain on media.");
assert.ok(listingContent > listingMedia, "The permitted marker must be on the first DOM child.");

for (const cssPath of findFiles(sourceRoot, (fileName) => fileName.endsWith(".css"))) {
  const css = readFileSync(cssPath, "utf8");
  assert.doesNotMatch(css, /(?:^|[;{])\s*order\s*:/m, cssPath);
  assert.doesNotMatch(css, /flex-direction\s*:\s*(?:row|column)-reverse/, cssPath);
  assert.doesNotMatch(css, /grid-auto-flow\s*:\s*dense/, cssPath);
}

const layout = readFileSync(join(sourceRoot, "app/layout.tsx"), "utf8");
const skipLink = layout.indexOf("Skip to main content");
const header = layout.indexOf("<SiteHeader ");
const main = layout.indexOf("<main\n");
const footer = layout.indexOf("<SiteFooter");
assert.ok(skipLink >= 0 && header > skipLink && main > header && footer > main);

const feedPrototype = readFileSync(
  join(sourceRoot, "components/feed-system-prototype.tsx"),
  "utf8",
);
assert.doesNotMatch(feedPrototype, /\border-(?:first|last|\d+|\[[^\]]+\])/);
assert.match(
  feedPrototype,
  /family === "B"\s*\?\s*"lg:grid-cols-\[300px_minmax\(0,1fr\)\] 2xl:grid-cols-\[340px_minmax\(0,1fr\)\]"/,
);

console.log(
  "Global focus-order evidence passed: app shell order plus all TSX and CSS visual-order constraints reviewed.",
);
