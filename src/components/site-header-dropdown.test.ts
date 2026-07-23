import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const header = readFileSync(join(__dirname, "site-header.tsx"), "utf8");
const navigation = readFileSync(join(__dirname, "header-nav.tsx"), "utf8");

assert.match(
  header,
  /giq-site-header-frame[^\"]*overflow-visible/,
  "The public header frame must let desktop navigation menus escape",
);
assert.doesNotMatch(header, /giq-site-header-frame[^\"]*overflow-hidden/);
assert.match(
  header,
  /giq-header-nav hidden[^\"]*overflow-visible/,
  "The desktop navigation bar must not clip its dropdown",
);
assert.doesNotMatch(header, /giq-header-nav hidden[^\"]*overflow-[xy]-auto/);
assert.match(
  header,
  /<picture className="[^"]*overflow-hidden[^"]*rounded-\[inherit\]"/,
  "Banner artwork must remain clipped to the rounded header",
);
assert.match(
  navigation,
  /className="absolute [^"]*z-\[70\]/,
  "Dropdown content must remain an overlay above the header",
);

console.log("site header dropdown overflow contract passed");
