import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";

import { SCREEN_CONTRACTS } from "./demo-experience-registry";
import { HomeHero } from "./home-hero";
import { MeetingCard } from "./meeting-card";
import { PageHero } from "./page-hero";
import { PageTitle } from "./page-title";
import {
  PRODUCT_ACCESSIBILITY_HEADING_EVIDENCE_FILE,
  PRODUCT_ACCESSIBILITY_HEADING_EXPECTED_GAIN,
  PRODUCT_ACCESSIBILITY_HEADING_MASTER_EVIDENCE,
  PRODUCT_ACCESSIBILITY_HEADING_REQUIREMENT_IDS,
  PRODUCT_ACCESSIBILITY_HEADING_SCOPE,
  PRODUCT_ACCESSIBILITY_HEADING_TEST_FILE,
} from "./product-accessibility-heading-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import { SiteFooter } from "./site-footer";

// screen-evidence-test-id: PRODUCT-ACCESSIBILITY-HEADING-EVIDENCE

const PUBLIC_ROUTES = [
  "/",
  "/about",
  "/auth/error",
  "/contact",
  "/pricing",
  "/privacy",
  "/responsible-use",
  "/terms",
] as const;

const pageSourceByRoute = new Map(
  SCREEN_CONTRACTS.filter(
    (screen) => screen.productionEnabled && screen.authentication === "public",
  ).map((screen) => [screen.route, screen.sourceFiles[0]]),
);

assert.deepEqual([...pageSourceByRoute.keys()], PUBLIC_ROUTES);
assert.deepEqual(
  PRODUCT_ACCESSIBILITY_HEADING_REQUIREMENT_IDS,
  ["GLOBAL.A11Y.headings"],
);
assert.equal(PRODUCT_ACCESSIBILITY_HEADING_EXPECTED_GAIN, 1);
assert.deepEqual(
  Object.keys(PRODUCT_ACCESSIBILITY_HEADING_MASTER_EVIDENCE),
  ["GLOBAL.A11Y.headings"],
);
assert.equal(
  PRODUCT_ACCESSIBILITY_HEADING_MASTER_EVIDENCE["GLOBAL.A11Y.headings"].status,
  "tested",
);
assert.deepEqual(
  PRODUCT_ACCESSIBILITY_HEADING_MASTER_EVIDENCE[
    "GLOBAL.A11Y.headings"
  ].evidence.slice(0, 2), [
  PRODUCT_ACCESSIBILITY_HEADING_EVIDENCE_FILE,
  PRODUCT_ACCESSIBILITY_HEADING_TEST_FILE,
]);
assert.equal(
  new Set(
    PRODUCT_ACCESSIBILITY_HEADING_MASTER_EVIDENCE["GLOBAL.A11Y.headings"].evidence,
  ).size,
  PRODUCT_ACCESSIBILITY_HEADING_MASTER_EVIDENCE["GLOBAL.A11Y.headings"].evidence.length,
);
for (const evidence of PRODUCT_ACCESSIBILITY_HEADING_MASTER_EVIDENCE[
  "GLOBAL.A11Y.headings"
].evidence) {
  assert.equal(existsSync(evidence), true, evidence);
}

assert.match(PRODUCT_ACCESSIBILITY_HEADING_SCOPE, /eight production-enabled public routes/i);
assert.match(PRODUCT_ACCESSIBILITY_HEADING_SCOPE, /does not prove browser-only conditional content/i);
assert.match(PRODUCT_ACCESSIBILITY_HEADING_SCOPE, /production readiness/i);

const pageHeroHeadings = headingLevels(
  renderToStaticMarkup(
    <PageHero image="/test.webp" subtitle="Test subtitle" title="Test title" />,
  ),
);
assert.deepEqual(pageHeroHeadings, [1]);
assert.deepEqual(headingLevels(renderToStaticMarkup(<HomeHero />)), [1]);
assert.deepEqual(
  headingLevels(renderToStaticMarkup(<PageTitle>Test title</PageTitle>)),
  [1],
);
assert.deepEqual(headingLevels(renderToStaticMarkup(<SiteFooter />)), [2, 2, 2]);
assert.deepEqual(
  headingLevels(
    renderToStaticMarkup(
      <MeetingCard
        meeting={{
          id: "heading-test-meeting",
          track: {
            id: "heading-test-track",
            name: "Heading Track",
            state: "NSW",
            hasIsolynx: false,
          },
          meetingDate: new Date("2026-01-01T00:00:00.000Z"),
          races: [],
        }}
      />,
    ),
  ),
  [3],
);

for (const route of PUBLIC_ROUTES) {
  const sourcePath = pageSourceByRoute.get(route);
  assert.ok(sourcePath, route);
  const source = readFileSync(resolve(sourcePath), "utf8");
  const directHeadings = headingLevels(source);
  const usesSharedHero = /<(?:PageHero|HomeHero|PageTitle)\b/.test(source);
  const levels = [
    ...(usesSharedHero ? [1] : []),
    ...directHeadings,
    2,
  ];

  assert.equal(levels.filter((level) => level === 1).length, 1, route);
  assertNoSkippedLevels(levels, route);
}

const homeSource = sourceFor("/");
assert.match(homeSource, /<HomeHero\b/);
assert.match(homeSource, /function FeatureCard[\s\S]*?<h2\b/);
assert.match(homeSource, /<TodaysRacesSection\s*\/>/);
assert.match(homeSource, /function TodaysRacesSection[\s\S]*?<h2\b/);
assert.match(source("src/components/meeting-card.tsx"), /<h3\b/);

const contactSource = sourceFor("/contact");
assert.match(contactSource, /CHANNELS\.map[\s\S]*?<h2\b/);
assert.match(contactSource, /Sign in to create a ticket/);
assert.match(contactSource, /<h3\b/);

const requirementIds = new Set(
  PRODUCT_MASTER_REQUIREMENTS.map((requirement) => requirement.id),
);
assert.equal(requirementIds.has("GLOBAL.A11Y.headings"), true);

console.log(
  `Accessibility heading evidence passed: ${PUBLIC_ROUTES.length} public routes have one h1 and non-skipped shared/direct heading levels.`,
);

function sourceFor(route: (typeof PUBLIC_ROUTES)[number]) {
  const sourcePath = pageSourceByRoute.get(route);
  assert.ok(sourcePath, route);
  return source(sourcePath);
}

function source(path: string) {
  return readFileSync(resolve(path), "utf8");
}

function headingLevels(markup: string) {
  return [...markup.matchAll(/<h([1-6])\b/gi)].map((match) =>
    Number(match[1]),
  );
}

function assertNoSkippedLevels(levels: readonly number[], route: string) {
  for (let index = 1; index < levels.length; index += 1) {
    assert.ok(
      levels[index] <= levels[index - 1] + 1,
      `${route}: h${levels[index - 1]} cannot skip to h${levels[index]}`,
    );
  }
}
