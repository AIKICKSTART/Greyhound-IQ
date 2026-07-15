import assert from "node:assert/strict";
import {
  readLiveKitDeploymentConfig,
  selectLiveKitConfig,
} from "./livekit-config";

assert.deepEqual(readLiveKitDeploymentConfig({}), { mode: "disabled" });

const single = readLiveKitDeploymentConfig({
  LIVEKIT_URL: "wss://calls.example.test",
  LIVEKIT_API_KEY: "single-key",
  LIVEKIT_API_SECRET: "single-secret",
  NEXT_PUBLIC_LIVEKIT_URL: "wss://calls.example.test",
});
assert.equal(selectLiveKitConfig(single).url, "wss://calls.example.test");
assert.equal(
  readLiveKitDeploymentConfig(
    {
      LIVEKIT_URL: "wss://calls.example.test",
      LIVEKIT_API_KEY: "single-key",
      LIVEKIT_API_SECRET: "single-secret",
    },
    true
  ).mode,
  "single"
);
assert.throws(
  () =>
    readLiveKitDeploymentConfig({
      LIVEKIT_URL: "wss://calls.example.test",
      LIVEKIT_API_KEY: "single-key",
    }),
  /call\.livekit_cell_incomplete:LIVEKIT/
);
assert.throws(
  () =>
    readLiveKitDeploymentConfig(
      {
        LIVEKIT_URL: "ws://calls.example.test",
        LIVEKIT_API_KEY: "single-key",
        LIVEKIT_API_SECRET: "single-secret",
        NEXT_PUBLIC_LIVEKIT_URL: "wss://calls.example.test",
      },
      true
    ),
  /call\.livekit_url_insecure:LIVEKIT_URL/
);
assert.throws(
  () =>
    readLiveKitDeploymentConfig({
      LIVEKIT_URL: "wss://calls.example.test",
      LIVEKIT_API_KEY: "single-key",
      LIVEKIT_API_SECRET: "single-secret",
      NEXT_PUBLIC_LIVEKIT_URL: "wss://other.example.test",
    }),
  /call\.livekit_public_origin_mismatch/
);

const regional = readLiveKitDeploymentConfig({
  LIVEKIT_TOPOLOGY: "regional",
  LIVEKIT_SYDNEY_URL: "wss://syd.calls.example.test",
  LIVEKIT_SYDNEY_API_KEY: "sydney-key",
  LIVEKIT_SYDNEY_API_SECRET: "sydney-secret",
  NEXT_PUBLIC_LIVEKIT_SYDNEY_URL: "wss://syd.calls.example.test",
  LIVEKIT_MELBOURNE_URL: "wss://mel.calls.example.test",
  LIVEKIT_MELBOURNE_API_KEY: "melbourne-key",
  LIVEKIT_MELBOURNE_API_SECRET: "melbourne-secret",
  NEXT_PUBLIC_LIVEKIT_MELBOURNE_URL: "wss://mel.calls.example.test",
});
assert.throws(() => selectLiveKitConfig(regional), /call\.room_home_required/);
assert.equal(
  selectLiveKitConfig(regional, "sydney").url,
  "wss://syd.calls.example.test"
);
assert.equal(
  selectLiveKitConfig(regional, "melbourne").url,
  "wss://mel.calls.example.test"
);
assert.throws(
  () =>
    readLiveKitDeploymentConfig({
      LIVEKIT_TOPOLOGY: "regional",
      LIVEKIT_SYDNEY_URL: "wss://syd.calls.example.test",
      LIVEKIT_SYDNEY_API_KEY: "sydney-key",
      LIVEKIT_SYDNEY_API_SECRET: "sydney-secret",
      NEXT_PUBLIC_LIVEKIT_SYDNEY_URL: "wss://syd.calls.example.test",
    }),
  /call\.livekit_cell_incomplete:LIVEKIT_MELBOURNE/
);
assert.throws(
  () =>
    readLiveKitDeploymentConfig({
      LIVEKIT_TOPOLOGY: "regional",
      LIVEKIT_SYDNEY_URL: "wss://calls.example.test",
      LIVEKIT_SYDNEY_API_KEY: "shared-key",
      LIVEKIT_SYDNEY_API_SECRET: "shared-secret",
      NEXT_PUBLIC_LIVEKIT_SYDNEY_URL: "wss://calls.example.test",
      LIVEKIT_MELBOURNE_URL: "wss://calls.example.test",
      LIVEKIT_MELBOURNE_API_KEY: "shared-key",
      LIVEKIT_MELBOURNE_API_SECRET: "shared-secret",
      NEXT_PUBLIC_LIVEKIT_MELBOURNE_URL: "wss://calls.example.test",
    }),
  /call\.livekit_regional_origin_shared/
);

console.log("PASS: LiveKit topology config fails closed and preserves single-cell compatibility");
