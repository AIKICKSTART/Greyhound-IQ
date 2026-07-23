import assert from "node:assert/strict";

import { tryStartReplayPlayback } from "./race-replay-player";

let playCalls = 0;

async function main() {
  assert.equal(
    await tryStartReplayPlayback({
      play: async () => {
        playCalls += 1;
      },
    }),
    true,
    "successful playback should be reported as started"
  );

  assert.equal(
    await tryStartReplayPlayback({
      play: async () => {
        playCalls += 1;
        throw new Error("Autoplay is not allowed");
      },
    }),
    false,
    "a browser autoplay rejection should not escape as a stream setup failure"
  );

  assert.equal(playCalls, 2, "each playback request should make one play attempt");

  console.log("race replay playback regression checks passed");
}

void main();
