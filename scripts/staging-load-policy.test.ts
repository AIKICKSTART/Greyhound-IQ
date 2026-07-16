import assert from "node:assert/strict";

import {
  resolveApprovedSignedUploadUrl,
  resolveStagingLoadBaseUrl,
  resolveStagingRedirectUrl,
  resolveStagingRequestUrl,
  resolveStagingSupabaseUrl,
} from "./staging-load-policy";

const accepted: Array<[string, string]> = [
  ["http://localhost:3000/path?ignored=true", "http://localhost:3000"],
  ["http://127.0.0.1:3000", "http://127.0.0.1:3000"],
  ["http://[::1]:3000", "http://[::1]:3000"],
  [
    "https://STAGING.GREYHOUNDSIQ.COM.AU.:443/path",
    "https://staging.greyhoundsiq.com.au",
  ],
  [
    "https://greyhoundiq-web-staging-5wsnl4feuq-ts.a.run.app",
    "https://greyhoundiq-web-staging-5wsnl4feuq-ts.a.run.app",
  ],
  [
    "https://candidate---greyhoundiq-web-staging-5wsnl4feuq-ts.a.run.app",
    "https://candidate---greyhoundiq-web-staging-5wsnl4feuq-ts.a.run.app",
  ],
];

for (const [value, expected] of accepted) {
  assert.equal(resolveStagingLoadBaseUrl(value), expected);
}

for (const value of [
  undefined,
  "",
  " ",
  "not-a-url",
  "ftp://localhost/load",
  "http://staging.greyhoundsiq.com.au",
  "https://greyhoundsiq.com.au",
  "https://www.greyhoundsiq.com.au",
  "https://WWW.GREYHOUNDSIQ.COM.AU.:443",
  "https://greyhoundiq.com.au",
  "https://www.greyhoundiq.com.au",
  "https://prod.greyhoundsiq.com.au",
  "https://greyhoundiq-web-prod-5wsnl4feuq-ts.a.run.app",
  "https://candidate---greyhoundiq-web-prod-5wsnl4feuq-ts.a.run.app",
  "https://greyhoundiq-web-staging-unapproved-project.a.run.app",
  "https://candidate---greyhoundiq-web-staging-unapproved-project.a.run.app",
  "https://example.com",
]) {
  assert.throws(() => resolveStagingLoadBaseUrl(value));
}

assert.equal(
  resolveStagingRequestUrl(
    "/api/health/ready?probe=true",
    "https://staging.greyhoundsiq.com.au"
  ).toString(),
  "https://staging.greyhoundsiq.com.au/api/health/ready?probe=true"
);
for (const path of [
  "api/health/ready",
  "//greyhoundsiq.com.au/api/health/ready",
  "/\\greyhoundsiq.com.au/api/health/ready",
  "https://greyhoundsiq.com.au/api/health/ready",
]) {
  assert.throws(() =>
    resolveStagingRequestUrl(path, "https://staging.greyhoundsiq.com.au")
  );
}

const redirectOrigin = "https://staging.greyhoundsiq.com.au";
const redirectSource = new URL(`${redirectOrigin}/legacy/path`);
assert.equal(
  resolveStagingRedirectUrl("/canonical", redirectSource, redirectOrigin).toString(),
  `${redirectOrigin}/canonical`
);
assert.equal(
  resolveStagingRedirectUrl("next", redirectSource, redirectOrigin).toString(),
  `${redirectOrigin}/legacy/next`
);
for (const location of [
  "https://greyhoundsiq.com.au/",
  "//greyhoundsiq.com.au/",
  "https://user:password@staging.greyhoundsiq.com.au/",
]) {
  assert.throws(() =>
    resolveStagingRedirectUrl(location, redirectSource, redirectOrigin)
  );
}

assert.equal(
  resolveStagingSupabaseUrl(
    "https://STAGING-PROJECT.SUPABASE.CO.:443",
    "staging-project.supabase.co."
  ),
  "https://staging-project.supabase.co"
);
assert.equal(
  resolveStagingSupabaseUrl("http://127.0.0.1:54321", "127.0.0.1"),
  "http://127.0.0.1:54321"
);

for (const [value, approvedHost] of [
  [undefined, "staging-project.supabase.co"],
  ["https://staging-project.supabase.co", undefined],
  ["https://production-project.supabase.co", "staging-project.supabase.co"],
  ["http://staging-project.supabase.co", "staging-project.supabase.co"],
  ["https://user:password@staging-project.supabase.co", "staging-project.supabase.co"],
  ["https://staging-project.supabase.co/storage/v1", "staging-project.supabase.co"],
  ["https://staging-project.supabase.co?redirect=production", "staging-project.supabase.co"],
  ["https://staging-project.supabase.co", "https://staging-project.supabase.co"],
] as const) {
  assert.throws(() => resolveStagingSupabaseUrl(value, approvedHost));
}

const approvedSupabaseOrigin = "https://staging-project.supabase.co";
assert.equal(
  resolveApprovedSignedUploadUrl(
    `${approvedSupabaseOrigin}/storage/v1/object/upload/sign/private-user-media/load-probe.png?token=test-token`,
    approvedSupabaseOrigin
  ),
  `${approvedSupabaseOrigin}/storage/v1/object/upload/sign/private-user-media/load-probe.png?token=test-token`
);

for (const value of [
  "not-a-url",
  "https://production-project.supabase.co/storage/v1/object/upload/sign/bucket/file?token=test-token",
  `${approvedSupabaseOrigin}/storage/v1/object/sign/bucket/file?token=test-token`,
  `${approvedSupabaseOrigin}/storage/v1/object/upload/sign/bucket/file`,
  `${approvedSupabaseOrigin}/storage/v1/object/upload/sign/bucket/file?token=`,
  `https://user:password@staging-project.supabase.co/storage/v1/object/upload/sign/bucket/file?token=test-token`,
]) {
  assert.throws(() =>
    resolveApprovedSignedUploadUrl(value, approvedSupabaseOrigin)
  );
}

console.log("staging load policy tests passed");
