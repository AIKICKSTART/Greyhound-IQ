import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// screen-evidence-test-id: ADMIN.SOURCE-HEALTH.RESPONSIVE

const source = readFileSync(join(__dirname, "page.tsx"), "utf8");

assert.ok(source.includes("data-source-feed-grid"));
assert.ok(source.includes("data-source-health-grid"));
assert.ok(source.includes("data-live-feed={feed.name}"));
assert.ok(source.includes("data-source-health-row={row.sourceProvider}"));
assert.equal(/<table(?:\s|>)/i.test(source), false);
assert.equal(/min-w-\[\d+px\]/.test(source), false);
assert.equal(source.includes("overflow-x-auto"), false);
assert.ok(source.includes("sm:grid-cols-2"));
assert.ok(source.includes("xl:grid-cols-3"));
assert.ok(source.includes("lg:grid-cols-2"));
assert.ok(source.includes('resource="dataSourceHealth"'));

console.log(
  "Admin source-health responsive contract passed: feed and runtime records use wrapping cards without wide tables.",
);
