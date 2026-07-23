import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "scripts", "provider-rights-release.ts"),
  "utf8",
);

for (const required of [
  'argumentValue(args, "--attestation-sha256")',
  'argumentValue(args, "--source-database")',
  'argumentValue(args, "--database")',
  'argumentValue(args, "--dump-manifest")',
  'argumentValue(args, "--dump-checksum")',
  'cleanSourceCommitSha("release verification")',
  'cleanSourceCommitSha("attestation")',
  "canonicalProviderRightsJson(currentRegistry)",
  "canonicalProviderRightsJson(attestedRegistry)",
  '["rev-parse", "--verify", "HEAD"]',
  '["status", "--porcelain=v1", "--untracked-files=all"]',
  'flag: "wx"',
]) {
  assert.ok(source.includes(required), `release CLI is missing ${required}`);
}

for (const forbiddenCallerAssertion of [
  "--dump-manifest-sha256",
  "--dump-checksum-sha256",
  "--source-commit-sha",
]) {
  assert.equal(
    source.includes(forbiddenCallerAssertion),
    false,
    `release CLI must not trust ${forbiddenCallerAssertion}`,
  );
}

assert.match(source, /dumpManifest\.sha256 !== attestation\.release\.dumpManifestSha256/u);
assert.match(source, /dumpChecksumSha256 !== attestation\.release\.dumpChecksumSha256/u);
assert.match(source, /sourceCommitSha !== attestation\.review\.sourceCommitSha/u);
assert.match(source, /attestation\.release\.database !== expectedDatabase/u);

const createPosition = source.indexOf(
  "const attestation = createProviderRightsReleaseAttestation",
);
const outputPosition = source.indexOf(
  "const outputPath = writeNewJson",
  createPosition,
);
assert.ok(createPosition >= 0, "release validation call is missing");
assert.ok(
  outputPosition > createPosition,
  "attestation validation must finish before any output write",
);
assert.doesNotMatch(source, /process\.env/u);

console.log("provider rights release CLI contract passed");
