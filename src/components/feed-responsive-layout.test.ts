import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const feedPage = readFileSync(join(__dirname, "../app/feed/page.tsx"), "utf8");
const racingDayConfig = readFileSync(
  join(__dirname, "feed-racing-day-config.tsx"),
  "utf8",
);

assert.equal(feedPage.match(/top-\[118px\]/g)?.length, 2);
assert.equal(feedPage.match(/100dvh-130px/g)?.length, 3);
assert.match(feedPage, /min\(300px, calc\(100vw - max\(1rem, env\(safe-area-inset-left\)\)/);
assert.match(racingDayConfig, /min\(320px, calc\(100vw - max\(1rem, env\(safe-area-inset-left\)\)/);
assert.doesNotMatch(feedPage, /w-\[300px\]/);
assert.doesNotMatch(racingDayConfig, /w-\[320px\]/);

console.log("Feed responsive layout contract passed.");
