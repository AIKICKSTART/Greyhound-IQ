import assert from "node:assert/strict";

import {
  assertListingAcknowledgements,
  assertListingMediaPolicy,
} from "../src/lib/listing-policy";

assert.doesNotThrow(() =>
  assertListingAcknowledgements({
    type: "wanted",
    welfareAcknowledged: false,
    legalAcknowledged: false,
  })
);

assert.throws(
  () =>
    assertListingAcknowledgements({
      type: "dog_for_sale",
      welfareAcknowledged: true,
      legalAcknowledged: false,
    }),
  /listing\.disclaimer_required/
);

assert.doesNotThrow(() =>
  assertListingAcknowledgements({
    type: "stud_service",
    welfareAcknowledged: true,
    legalAcknowledged: true,
  })
);

assert.doesNotThrow(() =>
  assertListingMediaPolicy([
    ...Array.from({ length: 10 }, () => ({
      mimeType: "image/webp",
      storageBucket: "public-user-media",
    })),
    { mimeType: "video/mp4", storageBucket: "public-user-media" },
  ])
);

assert.throws(
  () =>
    assertListingMediaPolicy([
      { mimeType: "application/pdf", storageBucket: "public-user-media" },
    ]),
  /listing\.media_unsupported/
);

assert.throws(
  () =>
    assertListingMediaPolicy([
      { mimeType: "image/webp", storageBucket: "private-user-media" },
    ]),
  /listing\.media_must_be_public/
);

assert.throws(
  () =>
    assertListingMediaPolicy([
      { mimeType: "video/mp4", storageBucket: "public-user-media" },
      { mimeType: "video/webm", storageBucket: "public-user-media" },
    ]),
  /listing\.too_many_videos/
);

console.log("Marketplace safety checks passed");
