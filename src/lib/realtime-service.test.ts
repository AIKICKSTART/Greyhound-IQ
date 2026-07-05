import assert from "node:assert/strict";
import { conversationRealtimeChannel } from "./realtime-service";

// Save and restore env — mirrors scripts/check-internal-auth.ts pattern.
const prevSecret = process.env.REALTIME_CHANNEL_SECRET;
const prevInternal = process.env.INTERNAL_API_SECRET;

try {
  // With REALTIME_CHANNEL_SECRET unset → returns null (fallback chain removed).
  delete process.env.REALTIME_CHANNEL_SECRET;
  process.env.INTERNAL_API_SECRET = "ci-internal-secret-for-test";
  assert.equal(
    conversationRealtimeChannel("conv-test"),
    null,
    "must return null when REALTIME_CHANNEL_SECRET is absent"
  );

  // With REALTIME_CHANNEL_SECRET set → deterministic "conversation:<48hex>".
  process.env.REALTIME_CHANNEL_SECRET = "test-realtime-secret-for-unit-test";
  const ch1 = conversationRealtimeChannel("conv-abc");
  assert.ok(ch1 !== null);
  assert.match(ch1!, /^conversation:[0-9a-f]{48}$/);

  // Same input → same output.
  const ch2 = conversationRealtimeChannel("conv-abc");
  assert.equal(ch1, ch2, "must be deterministic");

  // Different input → different channel.
  const ch3 = conversationRealtimeChannel("conv-xyz");
  assert.notEqual(ch1, ch3);

  // Placeholder values → rejected → null.
  process.env.REALTIME_CHANNEL_SECRET = "your_realtime_secret_here";
  assert.equal(
    conversationRealtimeChannel("conv-abc"),
    null,
    "placeholder secret must be rejected"
  );

  process.env.REALTIME_CHANNEL_SECRET = "your-secret";
  assert.equal(conversationRealtimeChannel("conv-abc"), null);
} finally {
  if (prevSecret === undefined) delete process.env.REALTIME_CHANNEL_SECRET;
  else process.env.REALTIME_CHANNEL_SECRET = prevSecret;

  if (prevInternal === undefined) delete process.env.INTERNAL_API_SECRET;
  else process.env.INTERNAL_API_SECRET = prevInternal;
}

console.log("realtime-service tests passed");
