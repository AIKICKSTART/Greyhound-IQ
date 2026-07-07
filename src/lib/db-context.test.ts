import assert from "node:assert/strict";

import {
  resolveDbContextUser,
  setDbRequestContext,
  setDbSystemContext,
} from "@/lib/db-context";

async function main() {
  const calls: unknown[][] = [];
  const tx = {
    $executeRaw(strings: TemplateStringsArray, ...values: unknown[]) {
      calls.push(values);
      assert.equal(strings[0], "SELECT set_config(");
      return Promise.resolve(1);
    },
  };

  const requestContext = resolveDbContextUser({
    dbUserId: "user-1",
    profileId: "profile-1",
    tier: "pro_plus",
    role: "admin",
  });

  assert.deepEqual(requestContext, {
    dbUserId: "user-1",
    profileId: "profile-1",
    tier: "pro_plus",
    profileRole: "admin",
  });
  assert.equal(resolveDbContextUser({ dbUserId: "user-1" }), null);

  await setDbRequestContext(tx as never, requestContext);
  await setDbSystemContext(tx as never);

  assert.deepEqual(calls, [
    ["app.current_user_id", "user-1"],
    ["app.current_profile_id", "profile-1"],
    ["app.current_tier", "pro_plus"],
    ["app.current_role", "admin"],
    ["app.system", "false"],
    ["app.system", "true"],
    ["app.current_tier", "system"],
    ["app.current_role", "system"],
  ]);

  console.log("db context tests passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
