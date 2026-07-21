import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const styles = readFileSync(join(__dirname, "../app/globals.css"), "utf8");

for (const selector of [
  ".giq-form-control",
  ".giq-filter-chip",
  ".giq-segment",
  ".giq-market-card-control",
]) {
  const block = styles.match(
    new RegExp(`${selector.replaceAll(".", "\\.")}\\s*\\{[^}]+\\}`)
  )?.[0];
  assert.ok(block, `${selector} style block is missing`);
  assert.match(block, /min-height:\s*44px/);
}

assert.match(
  styles,
  /\.giq-mobile-footer-links a\s*\{[\s\S]*?min-height:\s*44px/,
  "mobile footer destinations must retain 44px touch targets"
);
assert.match(
  styles,
  /\[data-admin-shell\] label:has\(input\[type="checkbox"\]\)[\s\S]*?min-height:\s*44px/,
  "admin checkbox labels must expose a full touch target"
);

console.log("premium 44px touch-target contract passed");
