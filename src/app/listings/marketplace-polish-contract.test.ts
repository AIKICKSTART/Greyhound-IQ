import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const indexSource = readFileSync(join(__dirname, "page.tsx"), "utf8");
const createSource = readFileSync(join(__dirname, "new", "page.tsx"), "utf8");
const detailSource = readFileSync(join(__dirname, "[id]", "page.tsx"), "utf8");
const actionsSource = readFileSync(join(__dirname, "..", "actions.ts"), "utf8");
const uploaderSource = readFileSync(
  join(__dirname, "..", "..", "components", "media-attachment-fields.tsx"),
  "utf8"
);

assert.ok(
  indexSource.includes(
    "{signedIn ? <MarketplaceMemberHeader /> : <MarketplaceMarketingHero />}"
  ),
  "Marketplace must keep distinct member and signed-out headers"
);
for (const marketingContract of [
  'image="/images/wentworth-gate-hero.webp"',
  "Verified context.",
  "Discuss in Groups",
  "Create marketplace item",
]) {
  assert.ok(
    indexSource.includes(marketingContract),
    `Signed-out marketplace hero must preserve: ${marketingContract}`
  );
}

assert.ok(
  createSource.includes("action={createListing}"),
  "Marketplace create form must retain its server action"
);
for (const field of [
  "type",
  "categoryId",
  "title",
  "dogId",
  "region",
  "suburb",
  "state",
  "contactPreference",
  "price",
  "condition",
  "negotiable",
  "description",
  "itemBrand",
  "itemModel",
  "attributeKey",
  "attributeValue",
  "welfareAcknowledged",
  "legalAcknowledged",
]) {
  assert.ok(
    createSource.includes(`name="${field}"`),
    `Marketplace create form must retain ${field}`
  );
}
for (const submittedField of [
  "type",
  "title",
  "description",
  "state",
  "region",
  "suburb",
  "contactPreference",
  "price",
  "condition",
  "negotiable",
  "welfareAcknowledged",
  "legalAcknowledged",
]) {
  assert.ok(
    actionsSource.includes(`field(formData, "${submittedField}")`),
    `Marketplace action must continue reading ${submittedField}`
  );
}
assert.ok(actionsSource.includes('fields(formData, "mediaIds")'));
assert.ok(createSource.includes('mediaContext="listings" maxFiles={11}'));
assert.ok(createSource.includes("Add up to ten clear photos and one video."));
assert.ok(
  uploaderSource.includes('mediaContext === "listings"') &&
    uploaderSource.includes(
      'type.startsWith("image/") || type.startsWith("video/")'
    ),
  "Listing uploader MIME types must match the image/video submission policy"
);

const rendererStart = detailSource.indexOf("function ListingAttachment");
const rendererEnd = detailSource.indexOf("\nfunction AttachmentStatus", rendererStart);
assert.ok(rendererStart >= 0 && rendererEnd > rendererStart);
const renderer = detailSource.slice(rendererStart, rendererEnd);

assert.ok(
  detailSource.includes(
    'import { ProcessedVideo } from "@/components/processed-video"'
  ),
  "Listing video must reuse the authorized shared player"
);
assert.ok(renderer.includes("const url = mediaDeliveryUrl(media)"));
assert.ok(renderer.includes("/api/media/${media.id}/blob"));
for (const variant of ["hls", "poster", "caption"]) {
  assert.ok(
    renderer.includes(`?variant=${variant}`),
    `Listing media must request authorized ${variant} delivery`
  );
}
assert.ok(
  renderer.indexOf("scanStatus") < renderer.indexOf("mediaDeliveryUrl(media)")
);
assert.ok(
  renderer.indexOf("processingStatus") < renderer.indexOf("mediaDeliveryUrl(media)")
);
assert.ok(
  renderer.includes('["pending", "scanning"].includes(media.scanStatus)'),
  "Active media scans must render as loading rather than failed"
);
assert.ok(
  !detailSource.includes("lg:overflow-y-auto"),
  "Sticky marketplace actions must not create a nested desktop scrollbar"
);

console.log("Marketplace polish contract tests passed");
