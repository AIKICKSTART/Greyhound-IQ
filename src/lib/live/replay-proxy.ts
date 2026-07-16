import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

// Turns a provider stream URL into an authenticated encrypted same-origin
// capability. Runtime fetching still applies DNS-to-socket validation in
// replay-network.ts; secrecy of the URL is not an SSRF control by itself.
//
// Allowed provider hosts. Only these can be signed/proxied — anything else is
// rejected before signing and again at fetch time (SSRF guard).
const ALLOWED_STREAM_HOSTS = new Set([
  "d2w8yyjcswa0zt.cloudfront.net",
  "mediatdogs.skyracing.com.au",
  "mediarqs.skyracing.com.au",
  "tasracing-race-replays.s3.ap-southeast-2.amazonaws.com",
  "www.thedogs.com.au",
]);

export const REPLAY_TOKEN_TTL_SECONDS = 10 * 60;
export const MAX_REPLAY_TARGET_URL_BYTES = 4 * 1024;
export const REPLAY_PROXY_SECRET_MIN_BYTES = 32;
const REPLAY_TOKEN_CLOCK_SKEW_SECONDS = 30;
const REPLAY_CAPABILITY_VERSION = 1;
const REPLAY_CAPABILITY_IV_BYTES = 12;
const REPLAY_CAPABILITY_TAG_BYTES = 16;
const MAX_REPLAY_CAPABILITY_CHARS = 8 * 1024;
const REPLAY_CAPABILITY_AAD = Buffer.from(
  "greyhoundiq.replay-capability.v1",
  "utf8",
);

export function isAllowedStreamHost(hostname: string) {
  return ALLOWED_STREAM_HOSTS.has(hostname);
}

export function validateReplayTarget(
  value: string | URL,
): URL | null {
  const serialized = String(value);
  if (
    serialized.length === 0 ||
    Buffer.byteLength(serialized, "utf8") > MAX_REPLAY_TARGET_URL_BYTES
  ) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(serialized);
  } catch {
    return null;
  }

  if (
    parsed.protocol !== "https:" ||
    !isAllowedStreamHost(parsed.hostname) ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.port !== "" ||
    parsed.hash !== ""
  ) {
    return null;
  }

  return parsed;
}

function secret() {
  const value = process.env.REPLAY_PROXY_SECRET;
  if (!value) throw new Error("replay-proxy.secret_not_configured");
  if (Buffer.byteLength(value, "utf8") < REPLAY_PROXY_SECRET_MIN_BYTES) {
    throw new Error("replay-proxy.secret_too_short");
  }
  return value;
}

function capabilityKey() {
  return Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(secret(), "utf8"),
      Buffer.from("greyhoundiq.replay-capability.salt.v1", "utf8"),
      Buffer.from("greyhoundiq.replay-capability.key.v1", "utf8"),
      32,
    ),
  );
}

// Returns a same-origin path containing an authenticated encrypted capability,
// or null if the URL is not a proxiable provider stream. The capability is
// still a replayable bearer value until expiry, but it no longer exposes the
// provider URL or provider query credentials to routine request logs.
export function proxiedStreamPath(
  streamUrl: string | null | undefined,
  nowMs = Date.now()
): string | null {
  if (!streamUrl) return null;
  const parsed = validateReplayTarget(streamUrl);
  if (!parsed) return null;
  const expiresAt = Math.floor(nowMs / 1000) + REPLAY_TOKEN_TTL_SECONDS;
  const plaintext = Buffer.from(
    JSON.stringify({ expiresAt, target: parsed.toString() }),
    "utf8",
  );
  const iv = randomBytes(REPLAY_CAPABILITY_IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", capabilityKey(), iv);
  cipher.setAAD(REPLAY_CAPABILITY_AAD);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const token = Buffer.concat([
    Buffer.from([REPLAY_CAPABILITY_VERSION]),
    iv,
    cipher.getAuthTag(),
    encrypted,
  ]).toString("base64url");
  return `/api/replay/stream?t=${token}`;
}

// Authenticates and decrypts a replay capability, returning its provider URL
// only when the token, expiry and target authority all remain valid.
export function verifyStreamCapability(
  token: string,
  nowMs = Date.now()
): string | null {
  if (
    !token ||
    token.length > MAX_REPLAY_CAPABILITY_CHARS ||
    !/^[A-Za-z0-9_-]+$/.test(token)
  ) {
    return null;
  }

  try {
    const encoded = Buffer.from(token, "base64url");
    const minimumBytes = 1 + REPLAY_CAPABILITY_IV_BYTES +
      REPLAY_CAPABILITY_TAG_BYTES + 1;
    if (
      encoded.length < minimumBytes ||
      encoded[0] !== REPLAY_CAPABILITY_VERSION
    ) {
      return null;
    }

    const ivStart = 1;
    const tagStart = ivStart + REPLAY_CAPABILITY_IV_BYTES;
    const ciphertextStart = tagStart + REPLAY_CAPABILITY_TAG_BYTES;
    const iv = encoded.subarray(ivStart, tagStart);
    const tag = encoded.subarray(tagStart, ciphertextStart);
    const ciphertext = encoded.subarray(ciphertextStart);
    const decipher = createDecipheriv("aes-256-gcm", capabilityKey(), iv);
    decipher.setAAD(REPLAY_CAPABILITY_AAD);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
    const payload: unknown = JSON.parse(plaintext);
    if (
      !payload ||
      typeof payload !== "object" ||
      !("expiresAt" in payload) ||
      !("target" in payload)
    ) {
      return null;
    }
    const { expiresAt, target } = payload as {
      expiresAt: unknown;
      target: unknown;
    };
    const nowSeconds = Math.floor(nowMs / 1000);
    if (
      typeof expiresAt !== "number" ||
      !Number.isSafeInteger(expiresAt) ||
      expiresAt < nowSeconds - REPLAY_TOKEN_CLOCK_SKEW_SECONDS ||
      expiresAt > nowSeconds + REPLAY_TOKEN_TTL_SECONDS +
        REPLAY_TOKEN_CLOCK_SKEW_SECONDS ||
      typeof target !== "string"
    ) {
      return null;
    }
    const parsed = validateReplayTarget(target);
    if (!parsed) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
