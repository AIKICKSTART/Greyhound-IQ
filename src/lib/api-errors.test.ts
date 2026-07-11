import assert from "node:assert/strict";

import { jsonError } from "./api-errors";

async function main() {
const storageUnavailable = jsonError(
  new Error("media.storage_unavailable"),
  "Could not finalize media"
);
assert.equal(storageUnavailable.status, 503);
assert.deepEqual(await storageUnavailable.json(), {
  error: {
    code: "media.storage_unavailable",
    message: "Could not finalize media",
  },
});

console.log("api error tests passed");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
