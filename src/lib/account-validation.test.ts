import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
  avatarZoom: "1.75",
  avatarRotation: "90",
  coverFocalX: "0.25",
  coverFocalY: "0.75",
  coverZoom: "2.5",
  coverRotation: "270",
});
assert.equal(profileMedia.avatarMediaId, "avatar-media");
assert.equal(profileMedia.coverMediaId, null);
assert.equal(profileMedia.removeAvatar, false);
assert.equal(profileMedia.removeCover, false);
assert.equal(profileMedia.avatarFocalX, 0.4);
assert.equal(profileMedia.avatarFocalY, 0.6);
assert.equal(profileMedia.avatarZoom, 1.75);
assert.equal(profileMedia.avatarRotation, 90);
assert.equal(profileMedia.coverFocalX, 0.25);
assert.equal(profileMedia.coverFocalY, 0.75);
assert.equal(profileMedia.coverZoom, 2.5);
assert.equal(profileMedia.coverRotation, 270);
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
assert.equal(
  personalActorMediaUpdateSchema.safeParse({ avatarZoom: 0.99 }).success,
  false,
);
assert.equal(
  personalActorMediaUpdateSchema.safeParse({ coverZoom: 3.01 }).success,
  false,
);
assert.equal(
  personalActorMediaUpdateSchema.safeParse({ avatarRotation: 45 }).success,
  false,
);
assert.equal(
  personalActorMediaUpdateSchema.safeParse({ coverRotation: 360 }).success,
  false,
);

assert.equal(
  readFileSync(join(__dirname, "auth-roles.ts"), "utf8").includes("isFounder"),
  false,
  "Founder metadata must not participate in authorization",
);

console.log("account validation tests passed");
