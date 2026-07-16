import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ADVERTISING_PLACEMENTS,
  ADVERTISING_USER_STORIES,
  MARKETPLACE_BOOST_PACKAGES,
} from "./advertising-product-contract";
import { DesignLabAdvertisingConsole } from "./design-lab-advertising-console";

const markup = renderToStaticMarkup(createElement(DesignLabAdvertisingConsole));

assert.match(markup, /data-design-lab-advertising-console/);
assert.match(markup, /Provisional public pricing/);
assert.match(markup, /GST included/);
assert.match(markup, /viewable CPM/);
assert.match(markup, /hard spend cap/);
assert.match(markup, /equal rotation/);
assert.match(markup, /not a live sales promise/);
assert.match(markup, /signed idempotent webhook/);
assert.match(markup, /Global delivery and load rules/);
assert.match(markup, /Privacy and data controls/);
assert.match(markup, /three modules per twenty organic Feed entries/);
assert.match(markup, /Do not retain raw IP addresses/);
assert.match(markup, /User stories<\/dt><dd[^>]*>8<\/dd>/);
assert.match(markup, /Scenarios<\/dt><dd[^>]*>16<\/dd>/);
assert.match(
  markup,
  /aria-label="Advertising placement specifications" data-ad-placement-specifications="true"/,
);
assert.equal(
  (markup.match(/data-ad-placement-spec=/g) ?? []).length,
  ADVERTISING_PLACEMENTS.length,
);
assert.doesNotMatch(markup, /<table(?:\s|>)/i);
assert.doesNotMatch(markup, /min-w-\[\d+px\]/);
assert.match(markup, /data-contract-status="proposed"/);
assert.match(markup, /lucide-circle-dashed/);
assert.doesNotMatch(markup, /lucide-circle-check/);
assert.doesNotMatch(markup, /text-emerald-300/);
assert.doesNotMatch(markup, /text-\[(?:9|10)px\]/);
assert.equal(
  (markup.match(/data-ad-placement=/g) ?? []).length,
  ADVERTISING_PLACEMENTS.length,
);
for (const boost of MARKETPLACE_BOOST_PACKAGES) {
  assert.match(markup, new RegExp(boost.id.replace(".", "\\.")));
}
for (const story of ADVERTISING_USER_STORIES) {
  assert.match(markup, new RegExp(story.id.replaceAll(".", "\\.")));
}

console.log("Design Lab advertising console tests passed");
