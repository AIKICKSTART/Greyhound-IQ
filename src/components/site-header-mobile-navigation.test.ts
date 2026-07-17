import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const header = readFileSync(join(__dirname, "site-header.tsx"), "utf8");
const dock = readFileSync(join(__dirname, "mobile-bottom-dock.tsx"), "utf8");
const closeHelpers = readFileSync(
  join(__dirname, "mobile-menu-close-link.tsx"),
  "utf8"
);

assert.equal(
  header.match(/href: "\/about"/g)?.length,
  2,
  "About must be present in both mobile and tablet/desktop header navigation"
);
assert.equal(
  header.match(/href: "\/contact"/g)?.length,
  2,
  "Contact must be present in both mobile and tablet/desktop header navigation"
);
assert.match(dock, /href: "\/about", label: "About"/);
assert.match(dock, /href: "\/contact", label: "Contact"/);

assert.match(header, /<MobileMenuViewportClose \/>/);
assert.match(closeHelpers, /matchMedia\("\(min-width: 768px\)"\)/);
assert.match(closeHelpers, /addEventListener\("change", closeOnDesktop\)/);
assert.match(closeHelpers, /removeEventListener\("change", closeOnDesktop\)/);
assert.match(closeHelpers, /closeContainingSheet\(markerRef\.current\)/);

console.log("site header mobile navigation contract passed");
