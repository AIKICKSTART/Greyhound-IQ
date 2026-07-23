import assert from "node:assert/strict";

import {
  MAX_REPLAY_TARGET_URL_BYTES,
  proxiedStreamPath,
  REPLAY_PROXY_SECRET_MIN_BYTES,
  validateReplayTarget,
  verifyStreamCapability,
} from "./replay-proxy";

process.env.REPLAY_PROXY_SECRET ||= "test-secret-for-replay-proxy-validation";
const originalTheDogsApproval = process.env.THEDOGS_LICENSED_USE_APPROVED;
process.env.THEDOGS_LICENSED_USE_APPROVED = "true";

const NOW_MS = Date.UTC(2026, 6, 14, 0, 0, 0);
const HOST = "d2w8yyjcswa0zt.cloudfront.net";

const canonical = validateReplayTarget(`https://${HOST}:443/replay.m3u8?token=abc`);
assert.equal(canonical?.toString(), `https://${HOST}/replay.m3u8?token=abc`);

for (const rejected of [
  `http://${HOST}/replay.m3u8`,
  "https://attacker.example/replay.m3u8",
  `https://user:secret@${HOST}/replay.m3u8`,
  `https://${HOST}:8443/replay.m3u8`,
  `https://${HOST}/replay.m3u8#fragment`,
  `https://${HOST}/${"a".repeat(MAX_REPLAY_TARGET_URL_BYTES)}`,
]) {
  assert.equal(validateReplayTarget(rejected), null, rejected.slice(0, 100));
  assert.equal(proxiedStreamPath(rejected, NOW_MS), null);
}

const target = `https://${HOST}/replay.m3u8?provider-secret=abc`;
const signed = proxiedStreamPath(target, NOW_MS);
const secondSigned = proxiedStreamPath(target, NOW_MS);
assert.ok(signed && secondSigned);
assert.notEqual(signed, secondSigned);
assert.equal(signed.includes(HOST), false);
assert.equal(signed.includes("provider-secret"), false);
const params = new URL(signed, "http://localhost").searchParams;
const token = params.get("t") ?? "";
assert.ok(token);
assert.equal(params.has("u"), false);
assert.equal(params.has("e"), false);
assert.equal(params.has("s"), false);
assert.equal(Buffer.from(token, "base64url").includes(Buffer.from(HOST)), false);
assert.equal(
  verifyStreamCapability(token, NOW_MS),
  target,
);

delete process.env.THEDOGS_LICENSED_USE_APPROVED;
for (const deniedHost of [
  HOST,
  "mediatdogs.skyracing.com.au",
  "www.thedogs.com.au",
]) {
  const deniedTarget = `https://${deniedHost}/replay.m3u8`;
  assert.equal(validateReplayTarget(deniedTarget), null);
  assert.equal(proxiedStreamPath(deniedTarget, NOW_MS), null);
}
assert.equal(
  verifyStreamCapability(token, NOW_MS),
  null,
  "an unexpired TheDogs token cannot outlive licence approval",
);

const otherTarget = "https://mediarqs.skyracing.com.au/replay.mp4";
const otherSigned = proxiedStreamPath(otherTarget, NOW_MS);
assert.ok(otherSigned);
assert.equal(
  verifyStreamCapability(
    new URL(otherSigned, "http://localhost").searchParams.get("t") ?? "",
    NOW_MS,
  ),
  otherTarget,
);
process.env.THEDOGS_LICENSED_USE_APPROVED = "true";
const tamperIndex = Math.floor(token.length / 2);
const tampered = `${token.slice(0, tamperIndex)}${
  token[tamperIndex] === "A" ? "B" : "A"
}${token.slice(tamperIndex + 1)}`;
assert.equal(verifyStreamCapability(tampered, NOW_MS), null);
assert.equal(
  verifyStreamCapability(token, NOW_MS + 11 * 60 * 1000),
  null,
);
assert.equal(
  verifyStreamCapability("a".repeat(10_000), NOW_MS),
  null,
);

const acceptedSecret = process.env.REPLAY_PROXY_SECRET;
process.env.REPLAY_PROXY_SECRET = "x".repeat(REPLAY_PROXY_SECRET_MIN_BYTES - 1);
assert.throws(
  () => proxiedStreamPath(target, NOW_MS),
  /replay-proxy\.secret_too_short/,
);
process.env.REPLAY_PROXY_SECRET = acceptedSecret;

if (originalTheDogsApproval === undefined) {
  delete process.env.THEDOGS_LICENSED_USE_APPROVED;
} else {
  process.env.THEDOGS_LICENSED_USE_APPROVED = originalTheDogsApproval;
}

console.log("replay target authority validation tests passed");
