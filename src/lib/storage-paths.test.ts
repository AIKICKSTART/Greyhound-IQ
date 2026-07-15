import assert from "node:assert/strict";

import { siteAssetObjectPath } from "./storage-paths";

assert.equal(
  siteAssetObjectPath("/images/feature-ai-predictions.webp"),
  "site/home/feature-ai-predictions.webp"
);
assert.equal(
  siteAssetObjectPath("/images/tracks/ballarat/master.webp"),
  "site/tracks/ballarat/master.webp"
);
assert.equal(
  siteAssetObjectPath("/images/tracks/warrnambool/master.webp"),
  "site/tracks/warrnambool/master.webp"
);
assert.notEqual(
  siteAssetObjectPath("/images/tracks/ballarat/master.webp"),
  siteAssetObjectPath("/images/tracks/warrnambool/master.webp")
);

console.log("site asset object-path contract passed");
