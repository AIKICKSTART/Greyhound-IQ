import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// screen-evidence-test-id: DL-DOCK-VISUAL

const styles = readFileSync(
  join(__dirname, "dock-skin-catalogue-preview.module.css"),
  "utf8"
);
const source = readFileSync(
  join(__dirname, "dock-skin-catalogue-preview.tsx"),
  "utf8"
);

assert.match(styles, /\.action \{[\s\S]*min-height: 56px;/);
assert.match(styles, /\.action \{[\s\S]*touch-action: manipulation;/);
assert.match(styles, /\.actionLabel \{[\s\S]*font-size: 0\.625rem;/);
assert.match(styles, /\.unreadBadge \{[\s\S]*width: 16px;[\s\S]*font-size: 9px;/);
assert.match(
  styles,
  /data-action="post"\]\[data-active="true"\] \.iconShell \{[\s\S]*animation: goldPulse/,
  "D2 may pulse only while Post is selected"
);
assert.ok(
  styles.match(/-webkit-backdrop-filter:/g)?.length === 3,
  "D3, D5 and D6 must retain Safari glass support"
);
assert.match(styles, /@media \(max-width: 380px\)[\s\S]*D6[\s\S]*gap: 4px;/);
assert.match(styles, /@media \(forced-colors: active\)/);
assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(
  source,
  /3 unread messages/,
  "the Chat preview must expose its unread badge to assistive technology"
);

console.log("dock skin visual contract tests passed");
