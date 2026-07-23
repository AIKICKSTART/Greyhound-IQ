import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const controls = readFileSync(
  resolve("src/app/admin/form-controls.tsx"),
  "utf8",
);
const mutations = readFileSync(
  resolve("src/app/admin/mutations.ts"),
  "utf8",
);

assert.equal(
  (controls.match(/name="confirmation"/g) ?? []).length,
  2,
  "both account creation and access changes require visible confirmation",
);
assert.match(controls, /value="CONFIRM USER ACCESS"/);
assert.match(controls, /name="confirmation"[\s\S]{0,120}required/);
assert.equal(
  (mutations.match(/confirmation: z\.literal\("CONFIRM USER ACCESS"\)/g) ?? [])
    .length,
  2,
  "both server action schemas enforce the confirmation literal",
);
assert.equal(
  (mutations.match(/confirmation: field\(formData, "confirmation"\)/g) ?? [])
    .length,
  2,
  "both server actions parse the submitted confirmation",
);

console.log("Admin user access confirmation is enforced by UI and server schemas.");
