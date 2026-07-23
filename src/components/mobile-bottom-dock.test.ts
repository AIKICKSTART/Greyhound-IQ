import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  isDockLinkActive,
  subscriptionDockDestinationForTier,
} from "../lib/mobile-dock-policy";

const feed = { href: "/feed" };
const post = { href: "/feed#feed-composer", tone: "create" as const };

assert.equal(isDockLinkActive("/feed", "", feed), true);
assert.equal(isDockLinkActive("/feed", "#feed-composer", feed), false);
assert.equal(isDockLinkActive("/feed", "#feed-composer", post), true);
assert.equal(isDockLinkActive("/feed", "#latest", feed), true);
assert.equal(isDockLinkActive("/feed", "#latest", post), false);
assert.equal(isDockLinkActive("/feed/following", "", feed), true);
assert.equal(isDockLinkActive("/dogs", "", { href: "/" }), false);
assert.equal(subscriptionDockDestinationForTier("free").href, "/pricing");
assert.equal(subscriptionDockDestinationForTier("pro").href, "/account/pages");
assert.equal(subscriptionDockDestinationForTier("pro_plus").href, "/agents");
assert.equal(subscriptionDockDestinationForTier("pro_plus").label, "Tips");

const source = readFileSync(join(__dirname, "mobile-bottom-dock.tsx"), "utf8");
const globalStyles = readFileSync(join(__dirname, "../app/globals.css"), "utf8");

assert.match(
  source,
  /const dockLinks = \[\.\.\.DOCK_LINKS, subscriptionDockLinkForTier\(tier\)\]/,
  "the fifth dock destination must update from the current subscription tier"
);
assert.match(
  globalStyles,
  /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/,
  "the subscription-aware dock must reserve five equal destinations"
);

assert.match(
  source,
  /aria-current=\{menuActive \? "page" : undefined\}/,
  "menu destinations must expose the active dock state"
);
assert.match(
  source,
  /<Sheet open=\{menuOpen\} onOpenChange=\{setMenuOpen\}>[\s\S]*data-popup-open=\{menuOpen \? "" : undefined\}/,
  "the open menu must use the premium active dock treatment"
);
assert.match(
  source,
  /focus-visible:outline-\[hsl\(var\(--primary-light\)\)\]/,
  "menu entries must retain a visible keyboard focus indicator"
);
assert.match(
  globalStyles,
  /@media \(max-width: 380px\)[\s\S]*--giq-mobile-dock-clearance: calc\(96px \+ env\(safe-area-inset-bottom, 0px\)\);[\s\S]*\.giq-mobile-dock-link span \{[\s\S]*font-size: 9px;/,
  "narrow phones must retain safe content clearance and legible dock labels"
);

console.log("mobile bottom dock tests passed");
