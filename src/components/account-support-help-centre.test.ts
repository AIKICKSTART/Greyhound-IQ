import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const centreSource = readFileSync(
  "src/components/account-support-help-centre.tsx",
  "utf8",
);
const pageSource = readFileSync("src/app/account/support/page.tsx", "utf8");
const menuSource = readFileSync("src/components/interactive-help.tsx", "utf8");

for (const contract of [
  /id="help-topics"/,
  /role="search"/,
  /aria-label="Search help topics and guided tours"/,
  /maxLength=\{80\}/,
  /filterSupportHelpTopics\(normalizedQuery\)/,
  /getAvailableOnboardingHelpTours\(\{ authenticated: true, role \}\)/,
  /No help topics match this search/,
  /Available guided tours \(\{tours\.length\}\)/,
  /Open support/,
  /Tour\s+visibility never grants additional access\./,
]) {
  assert.match(centreSource, contract);
}
assert.match(
  pageSource,
  /<AccountSupportHelpCentre query=\{query\.q\} role=\{current\.role\} \/>/,
);
assert.match(menuSource, /Reset all tours on this device/);
assert.match(menuSource, /href="\/account\/support#help-topics"/);
assert.match(menuSource, /href="\/contact"/);
assert.match(menuSource, /Skip step/);
assert.doesNotMatch(centreSource, /dangerouslySetInnerHTML/);
assert.doesNotMatch(centreSource, /\bfetch\s*\(/);

console.log("Account support help centre source contract passed.");
