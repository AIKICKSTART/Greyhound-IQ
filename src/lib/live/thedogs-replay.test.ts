import assert from "node:assert/strict";

import { resolveTheDogsRaceReplay } from "./thedogs-replay";

void main();

async function main() {
  const originalApproval = process.env.THEDOGS_LICENSED_USE_APPROVED;
  let fetches = 0;
  const fetchImpl = async () => {
    fetches += 1;
    return new Response(JSON.stringify({
      meta: { status: 200, code: "ok" },
      video: { src: "https://d2w8yyjcswa0zt.cloudfront.net/replay.m3u8" },
    }), { headers: { "content-type": "application/json" } });
  };

  try {
    delete process.env.THEDOGS_LICENSED_USE_APPROVED;
    assert.equal(
      await resolveTheDogsRaceReplay(
        { sourceId: "123", replayUrl: "/videos/watch/races/123/replay" },
        fetchImpl,
      ),
      null,
    );
    assert.equal(fetches, 0);

    process.env.THEDOGS_LICENSED_USE_APPROVED = "true";
    const replay = await resolveTheDogsRaceReplay(
      { sourceId: "123", replayUrl: "/videos/watch/races/123/replay" },
      fetchImpl,
    );
    assert.equal(fetches, 1);
    assert.equal(replay?.sourceStatus, 200);
  } finally {
    if (originalApproval === undefined) {
      delete process.env.THEDOGS_LICENSED_USE_APPROVED;
    } else {
      process.env.THEDOGS_LICENSED_USE_APPROVED = originalApproval;
    }
  }

  console.log("TheDogs replay licence boundary checks passed");
}
