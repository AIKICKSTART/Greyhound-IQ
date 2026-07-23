import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const siteHeader = readFileSync(join(__dirname, "site-header.tsx"), "utf8");
const prototypeHeader = readFileSync(
  join(__dirname, "prototype-member-chrome.tsx"),
  "utf8"
);
const globalStyles = readFileSync(
  join(__dirname, "..", "app", "globals.css"),
  "utf8"
);
const mobileMenuLinks = readFileSync(
  join(__dirname, "mobile-menu-close-link.tsx"),
  "utf8"
);
const supportHelp = readFileSync(
  join(__dirname, "account-support-help-centre.tsx"),
  "utf8"
);

assert.ok(
  siteHeader.match(/aria-label="Open navigation menu"/g)?.length === 2,
  "Public and signed-in headers must both expose a mobile navigation trigger"
);
assert.match(
  siteHeader,
  /giq-member-race-nav hidden[^\"]*md:flex/,
  "The signed-in race navigation must remain desktop-only"
);
assert.match(
  siteHeader,
  /data-mobile-command-row/,
  "The signed-in header must expose one deterministic mobile command row"
);
assert.match(
  siteHeader,
  /giq-mobile-profile-button md:hidden/,
  "The signed-in account must use a distinct mobile-only circular profile trigger"
);
assert.match(
  siteHeader,
  /DANIEL_DEMO_PROFILE_PORTRAIT[\s\S]*const DANIEL_PROFILE_PORTRAIT = DANIEL_DEMO_PROFILE_PORTRAIT/,
  "Daniel's real signed-in chrome must use the verified local founder portrait"
);
assert.match(
  siteHeader,
  /ActorMediaImage[\s\S]*DANIEL_DEMO_PROFILE_ALIGNMENT/,
  "Daniel's signed-in chrome must apply the shared verified portrait alignment"
);
assert.match(
  siteHeader,
  /showDanielPortrait[\s\S]*giq-mobile-profile-initials/,
  "Other WorkOS members must retain initials as the portrait fallback"
);
assert.match(
  siteHeader,
  /giq-mobile-menu-label[^>]*[^<]*Menu/,
  "The hamburger control must have a visible Menu label"
);
assert.doesNotMatch(
  siteHeader,
  /function AccountNavigationMenu[\s\S]*Help &amp; onboarding[\s\S]*InteractiveHelpMenuControls/,
  "The real profile sheet must not retain onboarding controls when help is disabled"
);
assert.match(
  siteHeader,
  /aria-label="Quick actions"[\s\S]*MobileMenuLink href="\/races"[\s\S]*MobileMenuLink href="\/feed"[\s\S]*MobileMenuLink href="\/pulse"/,
  "The signed-in drawer must expose clickable races, feed, and Chat quick actions"
);
assert.match(
  prototypeHeader,
  /aria-label="Open navigation menu"/,
  "Standalone demo variants must expose the same mobile menu trigger"
);
assert.match(
  prototypeHeader,
  /Signed in · Pro demo account/,
  "The demo drawer must make the signed-in account state explicit"
);
assert.match(
  prototypeHeader,
  /giq-mobile-profile-button md:hidden[\s\S]*src=\{DANIEL_PROFILE_PORTRAIT\}[\s\S]*alt=""/,
  "The labeled demo account trigger must use Daniel's decorative founder portrait"
);
assert.match(
  prototypeHeader,
  /alt="Daniel Fleuren profile portrait"/,
  "Daniel's portrait must have meaningful alternative text in account cards"
);
assert.match(
  prototypeHeader,
  /PrototypeAccountNavigationMenu[\s\S]*SheetTitle className="sr-only">Demo account menu/,
  "The DF profile trigger must open a keyboard-managed account sheet"
);
assert.doesNotMatch(
  prototypeHeader,
  /function PrototypeAccountNavigationMenu[\s\S]*Help &amp; onboarding[\s\S]*InteractiveHelpMenuControls/,
  "The demo profile sheet must not retain obsolete onboarding controls"
);
assert.match(
  supportHelp,
  /Onboarding preferences[\s\S]*InteractiveHelpMenuControls/,
  "Account Support must expose the intentional onboarding restart and preference controls"
);
assert.match(
  prototypeHeader,
  /window\.location\.search[\s\S]*const feedHref = buildPrototypeDemoHref\(currentSearch\)/,
  "Demo feed links must retain variant, dock, sponsored, and demo query context"
);
assert.match(
  prototypeHeader,
  /giq-member-race-nav hidden[^\"]*md:flex/,
  "Standalone demo variants must not squeeze desktop race navigation onto mobile"
);
assert.match(
  globalStyles,
  /@media \(max-width: 767px\)[\s\S]*giq-member-race-nav[\s\S]*display: none;/,
  "Compact-on-scroll styles must not restore desktop navigation on mobile"
);
assert.match(
  globalStyles,
  /@media \(max-width: 767px\)[\s\S]*\[data-mobile-command-row\][\s\S]*height: 52px;[\s\S]*giq-member-header-logo-mobile/,
  "Mobile member chrome must retain the 68px frame and a compact three-control command row"
);
assert.match(
  globalStyles,
  /@media \(min-width: 768px\)[\s\S]*\.giq-mobile-menu-button,[\s\S]*\.giq-mobile-profile-button,[\s\S]*display: none;/,
  "Hamburger and compact profile controls must be hidden from tablet width onward"
);
assert.doesNotMatch(
  globalStyles,
  /\.giq-header-actions \.giq-mobile-menu-button\s*\{\s*display: inline-flex !important;/,
  "No tablet rule may force the mobile hamburger back on"
);
assert.doesNotMatch(
  globalStyles,
  /\.giq-site-header \.giq-header-nav,\s*\.giq-site-header \.giq-header-meta-row/,
  "Tablet chrome must keep the desktop navigation visible"
);
assert.match(
  globalStyles,
  /\.giq-mobile-profile-button\s*\{[\s\S]*height: 48px;[\s\S]*width: 48px;/,
  "The mobile profile target must exceed the 44px accessibility minimum"
);
assert.match(
  globalStyles,
  /\.giq-mobile-menu-sheet\s*\{[\s\S]*z-index: 100 !important;/,
  "The open drawer must remain clickable above sticky app chrome and docks"
);
assert.match(
  mobileMenuLinks,
  /querySelector<HTMLElement>\('\[data-slot="sheet-close"\]'\)[\s\S]*closeButton\?\.click\(\)/,
  "Every drawer destination must close its containing sheet after navigation"
);

console.log("member mobile hamburger contract passed");
