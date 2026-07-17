import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const service = readFileSync(join(__dirname, "social-actor-service.ts"), "utf8");
const profileSelect = service.slice(
  service.indexOf("const actorProfileSelect"),
  service.indexOf("satisfies Prisma.SocialActorSelect")
);
const migration = readFileSync(
  join(
    __dirname,
    "..",
    "..",
    "prisma",
    "migrations",
    "20260711165000_fix_public_actor_rls_user_join",
    "migration.sql"
  ),
  "utf8"
);
const proxy = readFileSync(join(__dirname, "..", "proxy.ts"), "utf8");
const profileRoute = readFileSync(
  join(__dirname, "..", "app", "p", "[handle]", "page.tsx"),
  "utf8",
);

assert.ok(
  !profileSelect.includes("user:"),
  "Public actor reads must not select the protected User relation"
);
assert.ok(
  migration.includes('account."isBanned" = false') &&
    migration.includes('account."deletionRequestedAt" IS NULL'),
  "The RLS visibility helper must hide inactive personal accounts"
);
assert.ok(
  proxy.includes("prisma.socialActor.count") &&
    proxy.includes('kind: "personal"') &&
    proxy.includes("personalActorCount + customPageCount === 0"),
  "The /p soft-404 guard must recognize public personal actors"
);

const accessGuard = service.slice(
  service.indexOf("const profileAudience"),
  service.indexOf("const contactAudience"),
);
for (const signal of [
  'actor.profileVisibility\n      : "only_me"',
  "canViewAudience(profileAudience",
  "if (!canViewProfile)",
  "avatarUrl: null",
  "coverUrl: null",
  "profile: null",
  "contact: null",
  "timeline: []",
  "gallery: []",
  "friends: []",
  "canViewProfile: false",
]) {
  assert.ok(accessGuard.includes(signal), `Missing private-profile guard: ${signal}`);
}
assert.ok(
  service.indexOf("if (!canViewProfile)") <
    service.indexOf("const timelineRows"),
  "Profile visibility must be enforced before timeline data is assembled",
);
assert.ok(
  profileRoute.includes("if (!profile.viewer.canViewProfile)") &&
    profileRoute.includes("<PrivateProfileView") &&
    profileRoute.includes('data-private-profile="true"') &&
    profileRoute.includes("Timeline posts, media, contact details, friends, and follower counts are hidden."),
  "The profile route must render the explicit non-leaking private state",
);
assert.ok(
  profileRoute.includes('robots: { index: false, follow: false }'),
  "Private profile metadata must be noindex",
);

console.log("social actor visibility tests passed");
