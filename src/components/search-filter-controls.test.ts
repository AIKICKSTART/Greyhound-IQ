import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(join(__dirname, path), "utf8");
const control = read("auto-submit-select.tsx");
const races = read("../app/races/page.tsx");
const results = read("../app/results/page.tsx");
const tracks = read("../app/tracks/page.tsx");
const marketplace = read("../app/listings/page.tsx");
const adminUsers = read("../app/admin/users/page.tsx");
const siteHeader = read("site-header.tsx");
const prototypeHeader = read("prototype-member-chrome.tsx");

assert.match(control, /event\.currentTarget\.form\?\.requestSubmit\(\)/);
assert.match(control, /data-auto-submit-select/);

for (const [name, source] of [
  ["races", races],
  ["results", results],
  ["tracks", tracks],
  ["marketplace", marketplace],
  ["admin users", adminUsers],
] as const) {
  assert.match(
    source,
    /<AutoSubmitSelect/,
    `${name} filters must submit as soon as a dropdown changes`,
  );
}

assert.doesNotMatch(races, />\s*(Apply|Go)\s*</);
assert.match(races, />\s*Search\s*</);
assert.match(races, />\s*Filter\s*</);
assert.match(results, />\s*Filter\s*</);
assert.match(tracks, />\s*Filter\s*</);
assert.match(marketplace, />\s*Search\s*</);
assert.doesNotMatch(marketplace, /Show results/);
assert.match(adminUsers, />\s*Search\s*</);
assert.match(adminUsers, />\s*Filter\s*</);
assert.match(adminUsers, /View details/);
assert.match(adminUsers, /Page \{result\.page\} of \{result\.pageCount\}/);

for (const [name, source] of [
  ["site header", siteHeader],
  ["prototype header", prototypeHeader],
] as const) {
  assert.match(
    source,
    /<button type="submit" aria-label="Search races">[\s\S]*?<span>Search<\/span>[\s\S]*?<\/button>/,
    `${name} mobile search action must display Search`,
  );
}

console.log("search and filter control contract passed");
