import assert from "node:assert/strict";

import {
  collectOfficialReplayRows,
  type ReplayCandidate,
} from "./replay-reconciliation";

void main();

async function main() {
  const requested: Array<{ url: URL; init?: RequestInit }> = [];
  const candidates: ReplayCandidate[] = [
    {
      raceId: "nsw-race-8",
      raceNumber: 8,
      raceName: "NSW race",
      meetingDate: "2026-07-23",
      trackName: "Wentworth Park",
      state: "NSW",
    },
    {
      raceId: "tas-race-1",
      raceNumber: 1,
      raceName: "TAS race",
      meetingDate: "2026-07-23",
      trackName: "Hobart",
      state: "TAS",
    },
    {
      raceId: "wa-race-1",
      raceNumber: 1,
      raceName: "WA race",
      meetingDate: "2026-07-23",
      trackName: "Mandurah",
      state: "WA",
    },
  ];

  const result = await collectOfficialReplayRows(candidates, {
    includeTheDogs: true,
    fetchImpl: (async (input, init) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
      );
      requested.push({ url, init });

      if (url.hostname === "www.thedogs.com.au") {
        return htmlResponse(`
          <a href="/videos/watch/races/1266031/replay">
            <div class="video-card__title">Wentworth Park Race 8</div>
          </a>
        `);
      }
      if (url.pathname.endsWith("/event_replay/list")) {
        return jsonResponse({
          videos: [
            {
              category: "Greyhounds",
              venue: "Hobart",
              meeting_code: "G_Hobart_20260723",
              meeting_date_format: "2026-07-23",
              trial: false,
            },
          ],
        });
      }
      if (url.pathname.endsWith("/race_replay/list")) {
        return jsonResponse({
          races: [
            {
              race_name: "Hobart Race 1",
              race_number: 1,
              angles: {
                side: {
                  name: "Side",
                  stream: "safe-stream-name",
                  login: false,
                },
              },
            },
          ],
        });
      }
      if (url.hostname === "vimeo.com") {
        return htmlResponse(
          '{"name":"20260723R01","embedUrl":"https://player.vimeo.com/video/123456789?h=abc123"}',
        );
      }
      throw new Error(`unexpected request ${url}`);
    }) as typeof fetch,
  });

  assert.equal(result.errors, 0);
  assert.deepEqual(result.failedSources, []);
  assert.equal(result.rows.length, 3);
  assert.deepEqual(
    result.rows.map((row) => ({
      raceId: row.raceId,
      provider: row.sourceProvider,
      embed: row.embedSourceType,
    })),
    [
      {
        raceId: "nsw-race-8",
        provider: "thedogs",
        embed: "race-replay",
      },
      {
        raceId: "tas-race-1",
        provider: "tasracing",
        embed: "tasracing-hls",
      },
      {
        raceId: "wa-race-1",
        provider: "greyhoundswa",
        embed: "vimeo",
      },
    ],
  );
  assert.match(
    result.rows.find((row) => row.sourceProvider === "tasracing")?.streamUrl ?? "",
    /^https:\/\/tasracing-race-replays\.s3\.ap-southeast-2\.amazonaws\.com\/safe-stream-name\/index\.m3u8$/,
  );
  assert.deepEqual(
    [...new Set(requested.map(({ url }) => url.origin))].sort(),
    [
      "https://test.tasracing.com.au",
      "https://vimeo.com",
      "https://www.thedogs.com.au",
    ],
  );
  assert.ok(requested.every(({ init }) => init?.redirect === "error"));
  assert.ok(requested.every(({ init }) => init?.signal instanceof AbortSignal));

  console.log("replay reconciliation tests passed");
}

function htmlResponse(body: string) {
  return new Response(body, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}
