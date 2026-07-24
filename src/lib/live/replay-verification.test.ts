import assert from "node:assert/strict";

import { verifyReplaySource } from "./replay-verification";

async function main() {
  let checkedUrl = "";
  const verified = await verifyReplaySource(
    {
      id: "video-1",
      raceId: "race-1",
      sourceProvider: "watchdog",
      sourceId: "youtube-1",
      pageUrl: "https://www.youtube.com/watch?v=abcDEF12345",
    },
    async (input) => {
      checkedUrl = input instanceof Request ? input.url : input.toString();
      return new Response(
        JSON.stringify({
          type: "video",
          provider_name: "YouTube",
          html: '<iframe src="https://www.youtube.com/embed/abcDEF12345"></iframe>',
        }),
        {
        status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    },
  );
  assert.equal(verified.outcome, "verified");
  assert.match(checkedUrl, /^https:\/\/www\.youtube\.com\/oembed\?/);
  assert.match(verified.evidenceSha256, /^[0-9a-f]{64}$/);

  const rateLimited = await verifyReplaySource(
    {
      id: "video-rate-limited",
      raceId: "race-rate-limited",
      sourceProvider: "watchdog",
      sourceId: "youtube-rate-limited",
      pageUrl: "https://www.youtube.com/watch?v=abcDEF12345",
    },
    async () => new Response("rate limited", { status: 403 }),
  );
  assert.equal(rateLimited.outcome, "pending");

  const pending = await verifyReplaySource({
    id: "video-2",
    raceId: "race-2",
    sourceProvider: "unknown-provider",
    sourceId: "missing",
    pageUrl: "https://attacker.example/replay",
    sourceStatus: null,
  });
  assert.equal(pending.outcome, "pending");

  console.log("replay verification tests passed");
}

void main();
