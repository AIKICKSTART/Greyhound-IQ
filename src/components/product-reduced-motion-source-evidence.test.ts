import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { PRODUCT_MASTER_EVIDENCE } from "./master-audit-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_REDUCED_MOTION_SOURCE_EVIDENCE_FILE,
  PRODUCT_REDUCED_MOTION_SOURCE_EXPECTED_GAIN,
  PRODUCT_REDUCED_MOTION_SOURCE_MASTER_EVIDENCE,
  PRODUCT_REDUCED_MOTION_SOURCE_REQUIREMENT_IDS,
  PRODUCT_REDUCED_MOTION_SOURCE_SCOPE,
  PRODUCT_REDUCED_MOTION_SOURCE_TEST_FILE,
} from "./product-reduced-motion-source-evidence";

// screen-evidence-test-id: PRODUCT-REDUCED-MOTION-SOURCE

const REQUIREMENT_ID = "GLOBAL.A11Y.motion" as const;
const REQUIREMENT_TEXT = "Respect reduced-motion settings." as const;

assert.deepEqual(PRODUCT_REDUCED_MOTION_SOURCE_REQUIREMENT_IDS, [
  REQUIREMENT_ID,
]);
assert.equal(PRODUCT_REDUCED_MOTION_SOURCE_EXPECTED_GAIN, 1);
const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  ({ id }) => id === REQUIREMENT_ID,
);
assert.ok(requirement, REQUIREMENT_ID);
assert.equal(requirement.requirement, REQUIREMENT_TEXT);

const record = PRODUCT_REDUCED_MOTION_SOURCE_MASTER_EVIDENCE[REQUIREMENT_ID];
assert.equal(record.status, "tested");
assert.deepEqual(record.evidence.slice(0, 2), [
  PRODUCT_REDUCED_MOTION_SOURCE_EVIDENCE_FILE,
  PRODUCT_REDUCED_MOTION_SOURCE_TEST_FILE,
]);
assert.equal(new Set(record.evidence).size, record.evidence.length);
record.evidence.forEach((path) => assert.equal(existsSync(path), true, path));
assert.deepEqual(PRODUCT_MASTER_EVIDENCE[REQUIREMENT_ID], record);

const evidenceSource = source(PRODUCT_REDUCED_MOTION_SOURCE_EVIDENCE_FILE);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(PRODUCT_REDUCED_MOTION_SOURCE_SCOPE, /operating-system preference/i);
assert.match(PRODUCT_REDUCED_MOTION_SOURCE_SCOPE, /every element and pseudo-element/i);
assert.match(PRODUCT_REDUCED_MOTION_SOURCE_SCOPE, /source contract only/i);
assert.match(PRODUCT_REDUCED_MOTION_SOURCE_SCOPE, /does not prove behaviour in every browser/i);
assert.match(PRODUCT_REDUCED_MOTION_SOURCE_SCOPE, /assistive-technology outcomes/i);

const rootLayout = source("src/app/layout.tsx");
assert.match(rootLayout, /import ["']\.\/globals\.css["'];/);

const globals = source("src/app/globals.css");
const reducedMotionBlock = balancedCssBlock(
  globals,
  "@media (prefers-reduced-motion: reduce)",
);
assert.match(reducedMotionBlock, /html\s*{\s*scroll-behavior:\s*auto;/);
assert.match(
  reducedMotionBlock,
  /\*,\s*\*::before,\s*\*::after\s*{[\s\S]*transition-duration:\s*0\.01ms\s*!important;/,
);
assert.match(reducedMotionBlock, /animation-duration:\s*0\.01ms\s*!important;/);
assert.match(reducedMotionBlock, /animation-iteration-count:\s*1\s*!important;/);

const cssFiles = collectFiles("src", (path) => path.endsWith(".css"));
const importantMotionDeclarations = cssFiles.flatMap((file) =>
  [...source(file).matchAll(/\b(?:animation|transition)(?:-[a-z-]+)?\s*:[^;{}]+!important\s*;/g)].map(
    ([declaration]) => `${file}:${declaration.replace(/\s+/g, " ").trim()}`,
  ),
);
assert.deepEqual(importantMotionDeclarations, [
  "src/app/globals.css:transition-duration: 0.01ms !important;",
  "src/app/globals.css:animation-duration: 0.01ms !important;",
  "src/app/globals.css:animation-iteration-count: 1 !important;",
]);

const sourceFiles = collectFiles(
  "src",
  (path) =>
    (path.endsWith(".ts") || path.endsWith(".tsx")) &&
    !path.includes(".test."),
);
const motionImporters = sourceFiles.filter((file) =>
  /from ["']motion\/react["']/.test(source(file)),
);
assert.deepEqual(motionImporters, [
  "src/components/agent-demo-console.tsx",
  "src/components/dog-search.tsx",
  "src/components/motion/motion-features.ts",
  "src/components/motion/motion-island.tsx",
]);

const motionConsumers = motionImporters.filter(
  (file) => !file.startsWith("src/components/motion/"),
);
assert.equal(motionConsumers.length, 2);
for (const file of motionConsumers) {
  const consumerSource = source(file);
  assert.match(
    consumerSource,
    /from ["']@\/components\/motion\/motion-island["']/,
    `${file}: direct motion consumers must import the reduced-motion boundary`,
  );
  assert.match(consumerSource, /<MotionIsland>/, `${file}: missing wrapper start`);
  assert.match(consumerSource, /<\/MotionIsland>/, `${file}: missing wrapper end`);
}

const motionIsland = source("src/components/motion/motion-island.tsx");
assert.match(motionIsland, /<MotionConfig reducedMotion="user">/);
assert.match(motionIsland, /<LazyMotion features={loadFeatures} strict>/);
assert.match(
  source("src/components/motion/motion-features.ts"),
  /export { domAnimation as default } from "motion\/react";/,
);

const interactiveHelp = source("src/components/interactive-help.tsx");
const onboardingRegistry = source("src/components/onboarding-tour-registry.ts");
assert.match(interactiveHelp, /window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
assert.match(interactiveHelp, /behavior: onboardingScrollBehavior\(reducedMotion\)/);
assert.match(
  onboardingRegistry,
  /return reducedMotion \? \("auto" as const\) : \("smooth" as const\);/,
);

console.log(
  `Product reduced-motion source evidence passed: global CSS, ${motionConsumers.length} motion/react UI consumers and onboarding scrolling respect the user preference with explicit source-only limits.`,
);

function source(path: string) {
  return readFileSync(path, "utf8");
}

function collectFiles(
  directory: string,
  include: (path: string) => boolean,
): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Unsupported symbolic link under source: ${fullPath}`);
      }
      if (entry.isDirectory()) return collectFiles(fullPath, include);
      const path = relative(process.cwd(), fullPath).replaceAll("\\", "/");
      return include(path) ? [path] : [];
    })
    .toSorted();
}

function balancedCssBlock(value: string, marker: string) {
  const markerIndex = value.indexOf(marker);
  assert.ok(markerIndex >= 0, `Missing CSS marker: ${marker}`);
  const openingBrace = value.indexOf("{", markerIndex);
  assert.ok(openingBrace >= 0, `Missing opening brace after: ${marker}`);
  let depth = 0;
  for (let index = openingBrace; index < value.length; index += 1) {
    if (value[index] === "{") depth += 1;
    if (value[index] !== "}") continue;
    depth -= 1;
    if (depth === 0) return value.slice(markerIndex, index + 1);
  }
  assert.fail(`Unclosed CSS block: ${marker}`);
}
