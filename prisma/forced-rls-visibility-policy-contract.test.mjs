import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "prisma/migrations/20260720113000_fix_forced_rls_visibility_recursion/migration.sql",
  "utf8",
);
const executable = migration.replace(/^--.*$/gmu, "");

for (const policy of ["giq_social_actor_select", "giq_feed_post_select"]) {
  assert.match(migration, new RegExp(`DROP POLICY IF EXISTS ${policy}`));
  assert.match(migration, new RegExp(`CREATE POLICY ${policy}`));
}

assert.doesNotMatch(
  executable,
  /giq_actor_visible\(id\)|giq_feed_post_visible\(id\)/,
  "forced-RLS table policies must not call helpers that query their own table",
);
for (const required of [
  'account."isBanned" = false',
  'account."deletionRequestedAt" IS NULL',
  "public.giq_profiles_blocked(",
  '"deletedAt" IS NULL',
  "FROM \"UserBlock\" block",
  "FROM \"ActorMute\" mute",
  "FROM \"Friendship\" friendship",
  "WHEN 'public' THEN true",
  "WHEN 'members' THEN public.giq_current_profile_id() IS NOT NULL",
  "WHEN 'connections' THEN",
  "WHEN 'only_me' THEN",
]) {
  assert.ok(migration.includes(required), `missing viewer boundary: ${required}`);
}
assert.doesNotMatch(
  executable,
  /ALTER (?:TABLE|FUNCTION).*OWNER|BYPASSRLS|DISABLE ROW LEVEL SECURITY|NO FORCE ROW LEVEL SECURITY/i,
  "recursion repair must not weaken ownership or forced-RLS boundaries",
);
assert.doesNotMatch(
  migration,
  /\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/i,
  "recursion repair must not mutate application rows",
);

console.log("Forced-RLS visibility policy contract passed");
