import assert from "node:assert/strict";

import "./load-env";
import { createLiveKitCallToken } from "../src/lib/call-token";

const url = requiredEnv("LIVEKIT_URL");
const apiKey = requiredEnv("LIVEKIT_API_KEY");
const apiSecret = requiredEnv("LIVEKIT_API_SECRET");
const validateUrl = new URL("/rtc/validate", liveKitHttpUrl(url));

main().catch((err) => {
  console.error("LiveKit connectivity check failed:");
  console.error(String(err));
  process.exit(1);
});

async function main() {
  const unauth = await fetch(validateUrl, {
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(unauth.status, 401);

  const roomName = `connectivity-probe-${Date.now()}`;
  const signed = createLiveKitCallToken(
    {
      profileId: "connectivity-probe",
      displayName: "Connectivity Probe",
    },
    roomName,
    { url, apiKey, apiSecret }
  );

  const authenticated = await fetch(validateUrl, {
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
    headers: { authorization: `Bearer ${signed.token}` },
  });
  const body = await authenticated.text();

  assert.equal(authenticated.status, 200);
  assert.equal(body.trim(), "success");
  console.log("LiveKit connectivity check passed");
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function liveKitHttpUrl(value: string) {
  if (value.startsWith("wss://")) return value.replace(/^wss:\/\//, "https://");
  if (value.startsWith("ws://")) return value.replace(/^ws:\/\//, "http://");
  return value;
}
