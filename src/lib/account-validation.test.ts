import assert from "node:assert/strict";

import {
  hasProfileMarketingFields,
  personalActorMediaUpdateSchema,
  profileUpdateSchema,
} from "@/lib/account-validation";

const basicProfile = profileUpdateSchema.parse({
  bio: "Form researcher",
  displayName: "Daniel",
  state: "NSW",
});

const marketingProfile = profileUpdateSchema.parse({
  displayName: "Daniel",
  kennelName: "Greyhounds IQ",
});

assert.equal(hasProfileMarketingFields(basicProfile), false);
assert.equal(hasProfileMarketingFields(marketingProfile), true);

const httpsWebsite = profileUpdateSchema.parse({
  displayName: "Daniel",
  website: "https://greyhoundsiq.com.au",
});
assert.equal(httpsWebsite.website, "https://greyhoundsiq.com.au");

assert.equal(
  profileUpdateSchema.safeParse({
    displayName: "Daniel",
    website: "javascript:alert(1)",
  }).success,
  false
);

const profileMedia = personalActorMediaUpdateSchema.parse({
  avatarMediaId: " avatar-media ",
  coverMediaId: "",
  avatarFocalX: "0.4",
  avatarFocalY: "0.6",
  coverFocalX: "0.25",
  coverFocalY: "0.75",
});
assert.equal(profileMedia.avatarMediaId, "avatar-media");
assert.equal(profileMedia.coverMediaId, null);
assert.equal(profileMedia.removeAvatar, false);
assert.equal(profileMedia.removeCover, false);
assert.equal(profileMedia.avatarFocalX, 0.4);
assert.equal(profileMedia.avatarFocalY, 0.6);
assert.equal(profileMedia.coverFocalX, 0.25);
assert.equal(profileMedia.coverFocalY, 0.75);
assert.equal(
  personalActorMediaUpdateSchema.parse({ removeAvatar: true }).removeAvatar,
  true,
);
assert.equal(
  personalActorMediaUpdateSchema.safeParse({ avatarFocalY: -0.01 }).success,
  false,
);
assert.equal(
  personalActorMediaUpdateSchema.safeParse({ coverFocalX: 1.01 }).success,
  false,
);

console.log("account validation tests passed");
