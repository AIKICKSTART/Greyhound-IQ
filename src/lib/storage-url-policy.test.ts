import assert from "node:assert/strict";

import {
  assertTrustedSupabaseStorageUrl,
  shouldPinSupabaseStorageDns,
} from "./storage-url-policy";

const production = {
  NODE_ENV: "production",
  SUPABASE_URL: "https://project.supabase.co",
} as const;

assert.equal(
  assertTrustedSupabaseStorageUrl(
    "https://project.supabase.co/storage/v1/object/sign/private-user-media/a.png?token=signed",
    production,
  ).origin,
  "https://project.supabase.co",
);
assert.equal(
  shouldPinSupabaseStorageDns("https://project.supabase.co/storage/v1/object", production),
  true,
);

for (const value of [
  "http://project.supabase.co/storage/v1/object/sign/a?token=x",
  "https://attacker.example/storage/v1/object/sign/a?token=x",
  "https://project.supabase.co.evil.example/storage/v1/object/sign/a?token=x",
  "https://user:password@project.supabase.co/storage/v1/object/sign/a?token=x",
  "https://project.supabase.co/admin",
  "https://project.supabase.co/storage/v1/object/sign/a?token=x#fragment",
]) {
  assert.throws(
    () => assertTrustedSupabaseStorageUrl(value, production),
    /storage\.untrusted_provider_url|storage\.supabase_not_configured/,
  );
}

assert.doesNotThrow(() =>
  assertTrustedSupabaseStorageUrl(
    "http://127.0.0.1:54321/storage/v1/object/sign/a?token=x",
    {
      NODE_ENV: "development",
      SUPABASE_URL: "http://127.0.0.1:54321",
    },
  ),
);
assert.equal(
  shouldPinSupabaseStorageDns(
    "http://127.0.0.1:54321/storage/v1/object/sign/a?token=x",
    { NODE_ENV: "development" },
  ),
  false,
);
assert.throws(
  () =>
    assertTrustedSupabaseStorageUrl(
      "http://127.0.0.1:54321/storage/v1/object/sign/a?token=x",
      {
        NODE_ENV: "production",
        SUPABASE_URL: "http://127.0.0.1:54321",
      },
    ),
  /storage\.supabase_not_configured/,
);

console.log("supabase storage URL policy tests passed");
