import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_RESPONSIVE_BEHAVIOUR_EVIDENCE_FILE,
  PRODUCT_RESPONSIVE_BEHAVIOUR_MASTER_EVIDENCE,
  PRODUCT_RESPONSIVE_BEHAVIOUR_REQUIREMENT_IDS,
  PRODUCT_RESPONSIVE_BEHAVIOUR_TEST_FILE,
} from "./product-responsive-behaviour-evidence";
import { PRODUCT_RESPONSIVE_REQUIRED_WIDTHS } from "./product-responsive-width-evidence";

const repositoryRoot = resolve(__dirname, "../..");
const source = (relativePath: string) =>
  readFileSync(resolve(repositoryRoot, relativePath), "utf8");
const exactPromptIds = PRODUCT_MASTER_REQUIREMENTS.filter(
  (requirement) => requirement.section === "global.responsive-behaviour",
).map((requirement) => requirement.id);

assert.equal(PRODUCT_RESPONSIVE_BEHAVIOUR_REQUIREMENT_IDS.length, 10);
assert.deepEqual(
  PRODUCT_RESPONSIVE_BEHAVIOUR_REQUIREMENT_IDS.toSorted(),
  exactPromptIds.filter((id) => id !== "GLOBAL.RESP.tour").toSorted(),
);
assert.deepEqual(
  Object.keys(PRODUCT_RESPONSIVE_BEHAVIOUR_MASTER_EVIDENCE).toSorted(),
  PRODUCT_RESPONSIVE_BEHAVIOUR_REQUIREMENT_IDS.toSorted(),
);
for (const requirementId of PRODUCT_RESPONSIVE_BEHAVIOUR_REQUIREMENT_IDS) {
  const record = PRODUCT_RESPONSIVE_BEHAVIOUR_MASTER_EVIDENCE[requirementId];
  assert.equal(record.status, "tested", requirementId);
  assert.ok(record.evidence.includes(PRODUCT_RESPONSIVE_BEHAVIOUR_EVIDENCE_FILE));
  assert.ok(record.evidence.includes(PRODUCT_RESPONSIVE_BEHAVIOUR_TEST_FILE));
  for (const evidencePath of record.evidence) {
    assert.equal(existsSync(resolve(repositoryRoot, evidencePath)), true, evidencePath);
  }
}

const globals = source("src/app/globals.css");
const dock = source("src/components/mobile-bottom-dock.tsx");
const sheet = source("src/components/ui/sheet.tsx");
const privacy = source("src/app/account/privacy/page.tsx");
const races = source("src/app/races/page.tsx");
const discover = source("src/app/discover/page.tsx");
const listingMedia = source("src/components/listing-card-media-carousel.tsx");
const video = source("src/components/processed-video.tsx");

assert.match(globals, /overflow-x: clip;/, "the document shell must suppress horizontal overflow");
assert.match(
  globals,
  /\.giq-mobile-menu-sheet \{[\s\S]*width: min\(430px, calc\(100vw - 16px\)\)[\s\S]*max-width: calc\(100vw - 16px\);/,
  "the mobile menu must fit the viewport width",
);
assert.match(
  globals,
  /\.giq-mobile-menu-scroll \{[\s\S]*max-height: calc\(100dvh - 16px[\s\S]*overflow-y: auto;/,
  "the mobile menu must scroll within the viewport height",
);
assert.match(
  sheet,
  /data-\[side=bottom\]:inset-x-0[\s\S]*data-\[side=bottom\]:bottom-0/,
  "bottom sheets must be anchored rather than offset off screen",
);
assert.match(
  globals,
  /\.giq-mobile-dock-sheet \{[\s\S]*max-height: calc\(100dvh - var\(--giq-mobile-dock-clearance\)[\s\S]*overflow-y: auto;/,
  "the dock sheet must remain scrollable above the fixed dock",
);
assert.match(
  dock,
  /href: "\/feed#feed-composer", label: "Post", icon: Plus, tone: "create"/,
  "the dock must retain a visible primary post action",
);
assert.match(
  globals,
  /body,\s*#main-content \{[\s\S]*padding-bottom: var\(--giq-mobile-dock-clearance\);/,
  "fixed dock clearance must protect page actions",
);
assert.match(
  globals,
  /\.giq-table-shell \{[\s\S]*overflow-x: auto;[\s\S]*-webkit-overflow-scrolling: touch;/,
  "wide tables must use contained touch scrolling",
);
assert.match(
  privacy,
  /role="region"[\s\S]*aria-label="Scrollable account records"[\s\S]*tabIndex=\{0\}[\s\S]*min-w-\[720px\]/,
  "wide account tables must expose a keyboard-focusable scroll region",
);
assert.match(
  races,
  /className="giq-filter-band"[\s\S]*className="giq-filter-scroll"/,
  "race filters must use the shared responsive filter layout",
);
assert.match(
  globals,
  /@media \(max-width: 920px\) \{[\s\S]*\.giq-filter-band \{[\s\S]*grid-template-columns: 1fr;/,
  "filter bands must collapse on compact widths",
);
assert.match(
  globals,
  /\.giq-filter-scroll \{[\s\S]*overflow-x: auto;/,
  "overflowing filter chips must remain reachable",
);
assert.match(
  listingMedia,
  /aspect-\[16\/10\][\s\S]*w-full overflow-hidden[\s\S]*h-full w-full object-cover/,
  "listing media must retain a stable responsive aspect frame",
);
assert.match(
  video,
  /<video[\s\S]*playsInline[\s\S]*w-full bg-black object-contain/,
  "video playback must preserve its media bounds on mobile",
);
assert.match(races, /type="search"/, "race lookup must request a search keyboard");
assert.match(races, /type="date"/, "date selection must request a date keyboard");
assert.match(discover, /enterKeyHint="search"/, "discovery search must expose its mobile submit intent");
assert.ok(
  [768, 820, 1024].every((width) =>
    new Set<number>(PRODUCT_RESPONSIVE_REQUIRED_WIDTHS).has(width),
  ),
  "the paired loopback browser audit must retain representative tablet widths",
);
assert.match(
  globals,
  /min-width: 768px\) and \(max-width: 1024px\) and \(orientation: portrait\)[\s\S]*min-width: 900px\) and \(max-width: 1024px\) and \(max-height: 900px\) and \(orientation: landscape\)/,
  "the shell must define both tablet portrait and landscape behaviour",
);

console.log("Responsive behaviour evidence passed: 10 shared source controls");
