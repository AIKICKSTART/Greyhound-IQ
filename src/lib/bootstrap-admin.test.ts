import assert from "node:assert/strict";

import { parseAdminBootstrapArgs } from "../../scripts/bootstrap-admin";

const dryRun = parseAdminBootstrapArgs([]);
assert.equal(dryRun.apply, false);
assert.equal(dryRun.allowProduction, false);
assert.deepEqual(dryRun.emails, [
  "daniel.j.fleuren@gmail.com",
  "daniel.fleuren@verridian.ai",
]);

const applyRun = parseAdminBootstrapArgs([
  "--apply",
  "--email",
  "Daniel.J.Fleuren@Gmail.com",
  "--allow-production",
]);
assert.equal(applyRun.apply, true);
assert.equal(applyRun.allowProduction, true);
assert.deepEqual(applyRun.emails, ["daniel.j.fleuren@gmail.com"]);

assert.throws(
  () => parseAdminBootstrapArgs(["--email"]),
  /admin\.bootstrap\.email_required/
);
assert.throws(
  () => parseAdminBootstrapArgs(["--wat"]),
  /admin\.bootstrap\.unknown_arg:--wat/
);

console.log("admin bootstrap argument tests passed");
