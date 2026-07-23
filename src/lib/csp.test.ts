import assert from "node:assert/strict";
import { contentSecurityPolicy } from "./csp";

const previousProvider = process.env.OBJECT_STORAGE_PROVIDER;

try {
  process.env.OBJECT_STORAGE_PROVIDER = "gcs";
  const policy = contentSecurityPolicy("test-nonce");

  for (const directive of ["img-src", "media-src", "connect-src"]) {
    assert.match(
      policy,
      new RegExp(`${directive}[^;]*https://storage\\.googleapis\\.com`),
      `${directive} must permit the configured GCS browser origin`,
    );
  }
} finally {
  if (previousProvider === undefined) delete process.env.OBJECT_STORAGE_PROVIDER;
  else process.env.OBJECT_STORAGE_PROVIDER = previousProvider;
}

console.log("CSP object-storage tests passed");
