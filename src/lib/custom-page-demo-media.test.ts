import assert from "node:assert/strict";

import {
  resolveCustomPageMedia,
  resolvePageAvatarUrls,
} from "./custom-page-service";

const expectedControlRoomMedia = {
  avatarUrl: "/images/logo-mark-purple-gold.webp",
  bannerUrl: "/images/site-header-gate-burst-landscape.webp",
  logoUrl: "/images/logo-wordmark-purple-gold.webp",
  cardUrl: null,
  galleryUrls: [
    "/images/feature-advanced-stats-green.webp",
    "/images/feature-breeding-analytics-gold.webp",
    "/images/feature-ai-predictions-blue.webp",
  ],
};

void main();

async function main() {
  process.env.APP_ENV = "demo";
  process.env.DEMO_AUTH_MODE = "full-access";

  assert.deepEqual(
    await resolveCustomPageMedia(null, "demo-social-actor-control-room"),
    expectedControlRoomMedia
  );
  assert.equal(
    (
      await resolvePageAvatarUrls([
        { id: "demo-custom-page-control-room", contentJson: null },
      ])
    ).get("demo-custom-page-control-room"),
    expectedControlRoomMedia.avatarUrl
  );
  assert.deepEqual(await resolveCustomPageMedia(null, "other-actor"), {
    avatarUrl: null,
    bannerUrl: null,
    logoUrl: null,
    cardUrl: null,
    galleryUrls: [],
  });

  process.env.APP_ENV = "production";

  assert.deepEqual(
    await resolveCustomPageMedia(null, "demo-social-actor-control-room"),
    {
      avatarUrl: null,
      bannerUrl: null,
      logoUrl: null,
      cardUrl: null,
      galleryUrls: [],
    }
  );
  assert.equal(
    (
      await resolvePageAvatarUrls([
        { id: "demo-custom-page-control-room", contentJson: null },
      ])
    ).get("demo-custom-page-control-room"),
    null
  );

  console.log("custom-page demo media fallback tests passed");
}
