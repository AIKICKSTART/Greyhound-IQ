import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "[handle]", "page.tsx"), "utf8");
const actorMediaSource = readFileSync(
  join(__dirname, "..", "..", "components", "actor-media-image.tsx"),
  "utf8"
);

const guards = [
  'unoptimized={item.url.startsWith("/api/media/")}',
  'unoptimized={friend.avatarUrl.startsWith("/api/media/")}',
  'unoptimized={bannerUrl.startsWith("/api/media/")}',
  'unoptimized={media.logoUrl.startsWith("/api/media/")}',
  'unoptimized={media.cardUrl.startsWith("/api/media/")}',
  'unoptimized={url.startsWith("/api/media/")}',
  'unoptimized={img.startsWith("/api/media/")}',
];

for (const guard of guards) {
  assert.ok(
    source.includes(guard),
    `Profile media must bypass the unauthenticated optimizer: ${guard}`
  );
}

assert.ok(
  source.includes("<ActorMediaImage") &&
    actorMediaSource.includes('unoptimized: props.src.startsWith("/api/media/")'),
  "Personal actor media must use the authenticated shared renderer"
);

assert.equal(
  source.match(/unoptimized=\{avatarUrl\.startsWith\("\/api\/media\/"\)\}/g)
    ?.length,
  1,
  "Managed-page avatars must preserve viewer authentication"
);

assert.ok(
  source.includes('href="/account/profile#cover-image-editor"') &&
    source.includes('href="/account/profile#profile-picture-editor"'),
  "Personal profile owners must have separate cover and avatar edit controls"
);
assert.ok(
  source.includes(
    "href={`/account/pages/${page.id}#page-banner-editor`}"
  ) &&
    source.includes(
      "href={`/account/pages/${page.id}#page-avatar-editor`}"
    ),
  "Managed-page owners must have separate cover and avatar edit destinations"
);

assert.equal(
  source.match(/lg:h-\[300px\] lg:w-\[300px\]/g)?.length,
  2,
  "Personal and managed-page profile pictures must render at 300px on desktop"
);
assert.equal(
  source.match(/profile\.actor\.avatarFocalX \* 100/g)?.length,
  1,
  "Managed-page profile pictures must use their saved alignment"
);
assert.ok(
  source.includes("focalX={profile.actor.avatarFocalX}") &&
    source.includes("zoom={profile.actor.avatarZoom}") &&
    source.includes("rotation={profile.actor.avatarRotation}"),
  "Personal profile media must use all shared transforms"
);

console.log("profile media delivery tests passed");
