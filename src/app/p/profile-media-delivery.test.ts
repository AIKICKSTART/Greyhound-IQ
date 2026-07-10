import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "[handle]", "page.tsx"), "utf8");

const guards = [
  'unoptimized={profile.actor.coverUrl.startsWith("/api/media/")}',
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

assert.equal(
  source.match(/unoptimized=\{avatarUrl\.startsWith\("\/api\/media\/"\)\}/g)
    ?.length,
  2,
  "Personal and managed-page avatars must both preserve viewer authentication"
);

console.log("profile media delivery tests passed");
