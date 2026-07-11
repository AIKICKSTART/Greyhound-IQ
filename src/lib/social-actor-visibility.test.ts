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

assert.ok(
  !profileSelect.includes("user:"),
  "Public actor reads must not select the protected User relation"
);
assert.ok(
  migration.includes('account."isBanned" = false') &&
    migration.includes('account."deletionRequestedAt" IS NULL'),
  "The RLS visibility helper must hide inactive personal accounts"
);

console.log("social actor visibility tests passed");
