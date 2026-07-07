import assert from "node:assert/strict";

import { setDbSystemContext } from "@/lib/db-context";

async function main() {
  const calls: unknown[][] = [];
  const tx = {
    $executeRaw(strings: TemplateStringsArray, ...values: unknown[]) {
      calls.push(values);
      assert.equal(strings[0], "SELECT set_config(");
      return Promise.resolve(1);
    },
  };

  await setDbSystemContext(tx as never);

  assert.deepEqual(calls, [
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
