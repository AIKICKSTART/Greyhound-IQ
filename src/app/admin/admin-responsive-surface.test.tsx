import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = { surface: "surface" };
};
const { AdminResponsiveSurface, labelsForHeaderRow } = require("./admin-responsive-surface") as typeof import("./admin-responsive-surface");

const source = readFileSync(resolve("src/app/admin/admin-responsive-surface.tsx"), "utf8");
const css = readFileSync(resolve("src/app/admin/admin-responsive-surface.module.css"), "utf8");

assert.deepEqual(
  labelsForHeaderRow([
    header("Account", 2),
    header("Actions", 1),
  ]),
  ["Account", "Account", "Actions"],
);
assert.deepEqual(labelsForHeaderRow([header("Ignored", 1, true)]), [""]);

assert.match(
  renderToStaticMarkup(
    <AdminResponsiveSurface><table><tbody><tr><td>value</td></tr></tbody></table></AdminResponsiveSurface>,
  ),
  /data-admin-responsive-surface/,
);
assert.match(source, /usePathname\(\)/);
assert.match(source, /\}, \[pathname\]\);/);
assert.match(source, /requestAnimationFrame\(refresh\)/);
assert.match(source, /new MutationObserver\(refresh\)/);
assert.match(source, /querySelectorAll<HTMLTableElement>\("table"\)/);
assert.match(source, /column \+= cell\.colSpan/);
assert.match(css, /@media \(max-width: 640px\)/);
assert.match(css, /overflow-x: clip/);
assert.match(css, /display: grid/);
assert.match(css, /data-admin-table-label/);
assert.match(css, /min-height: 44px/);
assert.doesNotMatch(css.slice(0, css.indexOf("@media")), /:global\(table\)|display:/);

console.log("Admin responsive surface labels, route refresh, and mobile card CSS passed.");

function header(label: string, colSpan: number, hidden = false) {
  return {
    colSpan,
    hidden,
    textContent: label,
    getAttribute(name: string) {
      return name === "aria-hidden" && hidden ? "true" : null;
    },
  };
}
