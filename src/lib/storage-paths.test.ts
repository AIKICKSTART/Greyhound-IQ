import assert from "node:assert/strict";

import {
  publicStorageUrl,
  SITE_ASSETS_BUCKET,
  siteAssetObjectPath,
} from "./storage-paths";

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

const providerBefore = process.env.OBJECT_STORAGE_PROVIDER;
const supabaseUrlBefore = process.env.SUPABASE_URL;
process.env.SUPABASE_URL = "https://project.supabase.co";
process.env.OBJECT_STORAGE_PROVIDER = "supabase";
assert.equal(
  publicStorageUrl(SITE_ASSETS_BUCKET, "site/brand/logo.webp"),
  "https://project.supabase.co/storage/v1/object/public/site-assets/site/brand/logo.webp",
);
process.env.OBJECT_STORAGE_PROVIDER = "gcs";
assert.equal(
  publicStorageUrl(SITE_ASSETS_BUCKET, "site/brand/logo.webp"),
  null,
  "private GCS buckets must never emit anonymous object URLs",
);
restoreEnv("OBJECT_STORAGE_PROVIDER", providerBefore);
restoreEnv("SUPABASE_URL", supabaseUrlBefore);

console.log("site asset object-path contract passed");

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
