import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const styles = readFileSync(join(__dirname, "../app/globals.css"), "utf8");

for (const selector of [
  ".giq-form-control",
  ".giq-segment",
  ".giq-market-card-control",
]) {
  const block = styles.match(
    new RegExp(`${selector.replaceAll(".", "\\.")}\\s*\\{[^}]+\\}`)
  )?.[0];
  assert.ok(block, `${selector} style block is missing`);
  assert.match(block, /min-height:\s*44px/);
}

console.log("premium 44px touch-target contract passed");
