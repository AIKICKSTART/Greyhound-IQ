import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "page.tsx"), "utf8");
const styles = readFileSync(join(__dirname, "../globals.css"), "utf8");
const railStart = source.indexOf('<aside className="giq-races-side-rail">');
const railEnd = source.indexOf("</aside>", railStart);

assert.ok(!source.includes("giq-live-status-panel"));
assert.ok(railStart >= 0 && railEnd > railStart);
assert.match(
  source.slice(railStart, railEnd),
  /<aside className="giq-races-side-rail">\s*<UpcomingQueue /
);

const tabletRulesStart = styles.indexOf("@media (max-width: 1180px)");
const tabletRulesEnd = styles.indexOf("@media (max-width: 920px)", tabletRulesStart);
const tabletRules = styles.slice(tabletRulesStart, tabletRulesEnd);
assert.match(
  tabletRules,
  /\.giq-races-side-rail\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/,
  "The sole Upcoming Queue must occupy the full tablet-width rail",
);

console.log("Races side rail contract tests passed");
