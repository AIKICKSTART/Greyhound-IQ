import assert from "node:assert/strict";
import { requireInternalRequest } from "../src/lib/internal-auth";

const previous = process.env.INTERNAL_API_SECRET;

try {
  process.env.INTERNAL_API_SECRET = "internal-check-secret\n";

  requireInternalRequest(
    new Request("https://greyhoundsiq.test/internal", {
      headers: { "x-internal-secret": "internal-check-secret" },
    })
  );
  requireInternalRequest(
    new Request("https://greyhoundsiq.test/internal", {
      headers: { authorization: "Bearer internal-check-secret" },
    })
  );

  assert.throws(
    () =>
      requireInternalRequest(
        new Request("https://greyhoundsiq.test/internal", {
          headers: { "x-internal-secret": "wrong" },
        })
      ),
    /auth\.forbidden/
  );

  console.log("Internal auth check passed");
} finally {
  if (previous === undefined) {
    delete process.env.INTERNAL_API_SECRET;
  } else {
    process.env.INTERNAL_API_SECRET = previous;
  }
}
