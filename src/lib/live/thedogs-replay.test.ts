import assert from "node:assert/strict";

import {
  parseYouTubeEmbed,
  resolveTheDogsRaceReplay,
} from "./thedogs-replay";

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

    let fallbackFetches = 0;
    const fallbackReplay = await resolveTheDogsRaceReplay(
      { sourceId: "124", replayUrl: "/videos/watch/races/124/replay" },
      async (input) => {
        fallbackFetches += 1;
        const url = new URL(input instanceof Request ? input.url : input.toString());
        if (url.pathname.startsWith("/api/videos/player/source/")) {
          return new Response(
            JSON.stringify({
              meta: { status: 500, code: "INTERNAL_SERVER_ERROR" },
            }),
            {
              status: 500,
              headers: { "content-type": "application/json" },
            },
          );
        }
        return new Response(
          '<iframe src="https://www.youtube.com/embed/hKdssZT51y4?autoplay=1"></iframe>',
          { headers: { "content-type": "text/html" } },
        );
      },
    );
    assert.equal(fallbackFetches, 2);
    assert.equal(
      fallbackReplay?.embedUrl,
      "https://www.youtube.com/embed/hKdssZT51y4",
    );
    assert.equal(fallbackReplay?.sourceStatus, 200);
    assert.equal(fallbackReplay?.sourceCode, "thedogs-page-youtube");

    assert.equal(
      parseYouTubeEmbed(`
        <iframe src="https://www.googletagmanager.com/ns.html?id=test"></iframe>
        <iframe src="https://www.youtube.com/embed/hKdssZT51y4?autoplay=1"></iframe>
      `),
      "https://www.youtube.com/embed/hKdssZT51y4",
    );
    assert.equal(
      parseYouTubeEmbed(
        '<iframe src="https://attacker.example/embed/hKdssZT51y4"></iframe>',
      ),
      null,
    );
  } finally {
    if (originalApproval === undefined) {
      delete process.env.THEDOGS_LICENSED_USE_APPROVED;
    } else {
      process.env.THEDOGS_LICENSED_USE_APPROVED = originalApproval;
    }
  }

  console.log("TheDogs replay licence boundary checks passed");
}
