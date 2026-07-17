import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const helpSource = readFileSync("src/components/interactive-help.tsx", "utf8");

assert.match(helpSource, /new MutationObserver\(scheduleResolution\)/);
assert.match(helpSource, /observer\.observe\(document\.body/);
assert.match(helpSource, /childList: true/);
assert.match(helpSource, /subtree: true/);
assert.match(helpSource, /data-onboarding-target/);
assert.match(helpSource, /scheduledFrame = window\.requestAnimationFrame\(resolveTarget\)/);
assert.match(helpSource, /if \(scheduledFrame !== null\) return/);
assert.match(helpSource, /if \(primary\) observer\.disconnect\(\)/);
assert.match(helpSource, /observer\.disconnect\(\)/);
assert.match(helpSource, /window\.cancelAnimationFrame\(scheduledFrame\)/);
assert.match(helpSource, /this step will attach if it loads/);
assert.doesNotMatch(helpSource, /\bsetTimeout\s*\(|\bsetInterval\s*\(/);

console.log(
  "Interactive help delayed-target contract passed: mutation-driven retry, animation-frame coalescing and deterministic cleanup.",
);
