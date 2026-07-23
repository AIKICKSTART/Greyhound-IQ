import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pageSource = readFileSync("src/app/results/page.tsx", "utf8");
const querySource = readFileSync("src/lib/queries.ts", "utf8");

assert.doesNotMatch(pageSource, /RacingDataDisclosure/);
assert.match(pageSource, /type="search"/);
assert.match(pageSource, /type="date"/);
assert.match(pageSource, /name="q"/);
assert.match(pageSource, />\s*Search\s*</);
assert.match(pageSource, /sm:grid-cols-2/);
assert.match(pageSource, /xl:grid-cols-\[minmax\(240px,320px\)/);

assert.match(querySource, /query\?: string \| null/);
assert.match(querySource, /raceFilters\.push\(\{ raceNumber \}\)/);
assert.match(querySource, /dog:\s*\{\s*name: \{ contains: textQuery/);

console.log("results search controls: ok");
