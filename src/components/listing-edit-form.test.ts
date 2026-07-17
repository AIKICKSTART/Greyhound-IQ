import assert from "node:assert/strict";

import { buildListingPatchPayload } from "./listing-edit-form";

const formData = new FormData();
formData.set("title", "  Updated racing listing  ");
formData.set(
  "description",
  "  Updated description with enough detail for a marketplace item.  ",
);
formData.set("categoryId", "category-1");
formData.set("state", "NSW");
formData.set("region", "Illawarra");
formData.set("suburb", "Dapto");
formData.set("postcode", "2530");
formData.set("condition", "Used");
formData.set("itemBrand", "Brand");
formData.set("itemModel", "Model");
formData.set("negotiable", "true");
formData.set("contactPreference", "message");
formData.set("price", "1250.50");
formData.append("attributeKey", "Size");
formData.append("attributeValue", "Large");
formData.append("attributeKey", "");
formData.append("attributeValue", "Ignored");

assert.deepEqual(buildListingPatchPayload(formData), {
  title: "Updated racing listing",
  description:
    "Updated description with enough detail for a marketplace item.",
  categoryId: "category-1",
  state: "NSW",
  region: "Illawarra",
  suburb: "Dapto",
  postcode: "2530",
  condition: "Used",
  itemBrand: "Brand",
  itemModel: "Model",
  negotiable: true,
  contactPreference: "message",
  price: 1250.5,
  attributes: [{ key: "Size", value: "Large" }],
});

formData.set("price", "not-a-number");
assert.throws(() => buildListingPatchPayload(formData), /price\.invalid/);

console.log(
  "Listing edit payload passed: trimmed bounded-shape fields, paired attributes, explicit booleans and safe price parsing produce the PATCH request body.",
);
