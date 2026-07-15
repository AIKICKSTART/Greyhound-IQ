import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("src/app/responsible-use/page.tsx", "utf8");
const footer = readFileSync("src/components/site-footer.tsx", "utf8");
const registry = readFileSync(
  "src/components/demo-experience-registry.ts",
  "utf8"
);

assert.match(page, /alternates: \{ canonical: "\/responsible-use" \}/);
assert.match(page, /Gambling Help Online/);
assert.match(page, /1800 858 858/);
assert.match(page, /does not place or accept wagers/);
assert.match(page, /href="\/terms"/);
assert.match(page, /href="\/privacy"/);
assert.match(page, /href="\/contact"/);
assert.match(footer, /href: "\/responsible-use"/);
assert.match(registry, /route: "\/responsible-use"/);

console.log("responsible-use route contract tests passed");
