import assert from "node:assert/strict";

import { FastTrackPrototypeProvider, parseFastTrackMeeting } from "./fasttrack";
import {
  parseMeetingLinks,
  parseTheDogsRaceResult,
  TheDogsProvider,
} from "./thedogs";
import { mapWatchdogPayload, WatchdogProvider } from "./watchdog";
import { parseWatchdogPayload } from "./watchdog-response";

void main();

async function main() {
  await assertTransportBoundaries();
  await assertTheDogsFollowUpBoundaries();
  assertWatchdogSchema();
  assertHtmlParserBounds();
  console.log("live provider response-validation tests passed");
}

async function assertTheDogsFollowUpBoundaries() {
  const requestedUrls: URL[] = [];
  const provider = new TheDogsProvider(
    fetchInspectingRequest((input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      requestedUrls.push(url);

      if (url.pathname === "/racing" && url.searchParams.has("date")) {
        return htmlResponse(`
          <li class="list__row">
            <a href="/racing/wentworth-park/2026-07-15?trial=false"></a>
            <div class="meeting__info__name">Wentworth Park</div>
          </li>
        `);
      }
      if (url.searchParams.get("trial") === "false") {
        return htmlResponse(`
          <a class="race-header" href="https://attacker.example/racing/escape/2026-07-15/1/result">
            <div class="race-box--result">malicious absolute follow-up</div>
          </a>
          <a class="race-header" href="https://www.thedogs.com.au/admin/1/private">
            <div class="race-box--result">same-origin non-racing follow-up</div>
          </a>
          <a class="race-header" href="/racing/wentworth-park/2026-07-15/2/result">
            <div class="race-box--result">valid result</div>
          </a>
        `);
      }
      if (url.pathname === "/racing/wentworth-park/2026-07-15/2/result") {
        return new Response(`
          <div class="race-header__info__grade">Maiden 520m</div>
          <tr class="race-runner">
            <td><sprite-svg name="rug_2"></sprite-svg></td>
            <td><a href="/dogs/202/safe-dog"><div class="race-runners__name__dog">Safe Dog</div></a></td>
          </tr>
        `, { headers: { "content-type": "text/javascript" } });
      }
      throw new Error(`unexpected test request: ${url.toString()}`);
    }),
  );

  const meetings = await provider.fetchResultsForDate("2026-07-15");
  assert.equal(meetings.length, 1);
  assert.equal(meetings[0]?.races.length, 1);
  assert.equal(meetings[0]?.races[0]?.runners[0]?.dog.name, "Safe Dog");
  assert.equal(
    meetings[0]?.races[0]?.runners[0]?.dog.sourceProvider,
    "thedogs",
  );
  assert.equal(meetings[0]?.races[0]?.runners[0]?.dog.sourceId, "202");
  assert.equal(meetings[0]?.races[0]?.runners[0]?.dog.earBrand, undefined);
  assert.equal(requestedUrls.length, 3);
  assert.deepEqual(
    [...new Set(requestedUrls.map((url) => url.origin))],
    ["https://www.thedogs.com.au"],
  );
  assert.ok(requestedUrls.every((url) => !url.pathname.startsWith("/admin/")));
  assert.ok(
    meetings[0]?.races.every((race) =>
      race.sourceId?.startsWith("https://www.thedogs.com.au/"),
    ),
  );
}

async function assertTransportBoundaries() {
  await assert.rejects(
    () =>
      new TheDogsProvider(
        fetchReturning(
          new Response("<html></html>", {
            headers: { "content-type": "image/svg+xml" },
          }),
        ),
      ).fetchUpcomingMeetings(1),
    /remote_response\.invalid_content_type/,
  );
  await assert.rejects(
    () =>
      new TheDogsProvider(
        fetchReturning(
          new Response("x", {
            headers: {
              "content-type": "text/html",
              "content-length": String(5 * 1024 * 1024 + 1),
            },
          }),
        ),
      ).fetchUpcomingMeetings(1),
    /remote_response\.too_large/,
  );
  await assert.rejects(
    () =>
      new TheDogsProvider(
        fetchReturning(
          new Response("", {
            status: 502,
            statusText: "provider-secret",
            headers: { "content-type": "text/html" },
          }),
        ),
      ).fetchUpcomingMeetings(1),
    exactMessage("thedogs.request_failed:502"),
  );

  let theDogsSignal: AbortSignal | null | undefined;
  let theDogsRedirect: RequestRedirect | undefined;
  const theDogs = await new TheDogsProvider(
    fetchInspecting((init) => {
      theDogsSignal = init?.signal;
      theDogsRedirect = init?.redirect;
      return htmlResponse("");
    }),
  ).fetchUpcomingMeetings(1);
  assert.deepEqual(theDogs, []);
  assert.ok(theDogsSignal instanceof AbortSignal);
  assert.equal(theDogsRedirect, "error");

  await assert.rejects(
    () =>
      new FastTrackPrototypeProvider(
        fetchReturning(
          new Response("<html></html>", {
            headers: { "content-type": "application/json" },
          }),
        ),
      ).fetchUpcomingMeetings(1),
    /remote_response\.invalid_content_type/,
  );
  await assert.rejects(
    () =>
      new FastTrackPrototypeProvider(
        fetchReturning(
          new Response("x", {
            headers: {
              "content-type": "text/html",
              "content-length": String(5 * 1024 * 1024 + 1),
            },
          }),
        ),
      ).fetchUpcomingMeetings(1),
    /remote_response\.too_large/,
  );
  let fastTrackSignal: AbortSignal | null | undefined;
  let fastTrackRedirect: RequestRedirect | undefined;
  const fastTrack = await new FastTrackPrototypeProvider(
    fetchInspecting((init) => {
      fastTrackSignal = init?.signal;
      fastTrackRedirect = init?.redirect;
      return htmlResponse("");
    }),
  ).fetchUpcomingMeetings(1);
  assert.deepEqual(fastTrack, []);
  assert.ok(fastTrackSignal instanceof AbortSignal);
  assert.equal(fastTrackRedirect, "error");

  await assert.rejects(
    () =>
      new WatchdogProvider(
        fetchReturning(
          new Response("{}", { headers: { "content-type": "text/html" } }),
        ),
      ).fetchUpcomingMeetings(1),
    /remote_response\.invalid_content_type/,
  );
  await assert.rejects(
    () =>
      new WatchdogProvider(fetchReturning(jsonResponse("not-json"))).fetchResults(1),
    /watchdog\.response_invalid_json/,
  );
  await assert.rejects(
    () =>
      new WatchdogProvider(
        fetchReturning(
          new Response("{}", {
            headers: {
              "content-type": "application/json",
              "content-length": String(5 * 1024 * 1024 + 1),
            },
          }),
        ),
      ).fetchResults(1),
    /remote_response\.too_large/,
  );
  let watchdogSignal: AbortSignal | null | undefined;
  let watchdogRedirect: RequestRedirect | undefined;
  const watchdog = await new WatchdogProvider(
    fetchInspecting((init) => {
      watchdogSignal = init?.signal;
      watchdogRedirect = init?.redirect;
      return jsonResponse(JSON.stringify({ meetings: [] }));
    }),
  ).fetchUpcomingMeetings(1);
  assert.deepEqual(watchdog, []);
  assert.ok(watchdogSignal instanceof AbortSignal);
  assert.equal(watchdogRedirect, "error");
}

function assertWatchdogSchema() {
  const currentSignedIdentifiers = parseWatchdogPayload({
    meetings: [
      {
        id: 1_303_026_371,
        meetingDate: "2026-07-16T00:00:00.000Z",
      },
    ],
    races: [
      {
        id: -2_092_194_025,
        meetingId: 1_303_026_371,
        number: 1,
        videoId: "VkYs8pUf-tk",
        photoFinishUrl:
          "https://grvaueprdfasttrackstr03.blob.core.windows.net/photos/current.jpg",
      },
    ],
    participants: [
      {
        id: "-20921940258",
        raceId: -2_092_194_025,
        dogId: 12_345,
        dogName: "Current Watchdog Runner",
        last5: " ",
        resultPlace: "F",
      },
    ],
  });
  assert.equal(currentSignedIdentifiers.races?.[0]?.id, -2_092_194_025);
  assert.equal(
    currentSignedIdentifiers.participants?.[0]?.id,
    "-20921940258",
  );
  assert.equal(currentSignedIdentifiers.participants?.[0]?.last5, null);
  assert.equal(currentSignedIdentifiers.participants?.[0]?.resultPlace, "F");
  assert.equal(
    currentSignedIdentifiers.races?.[0]?.photoFinishUrl,
    "https://grvaueprdfasttrackstr03.blob.core.windows.net/photos/current.jpg",
  );

  const parsed = parseWatchdogPayload({
    meetings: [
      {
        id: 1,
        trackName: " Sandown Park ",
        startTime: "2026-07-15T09:00:00.000Z",
        ignoredProviderField: "discard me",
      },
    ],
    ignoredEnvelopeField: "discard me",
  });
  assert.deepEqual(Object.keys(parsed), ["meetings"]);
  assert.deepEqual(Object.keys(parsed.meetings?.[0] ?? {}).toSorted(), [
    "id",
    "startTime",
    "trackName",
  ]);
  assert.equal(parsed.meetings?.[0]?.trackName, "Sandown Park");

  for (const invalid of [
    {},
    { meetings: [{ trackName: "Missing id", startTime: "2026-07-15" }] },
    { meetings: [{ id: "../escape", startTime: "2026-07-15" }] },
    { meetings: [{ id: 1, startTime: "not-a-date" }] },
    { meetings: [{ id: 1, startTime: "2026-02-31" }] },
    {
      meetings: [
        { id: 1, startTime: "2026-07-15" },
        { id: 1, startTime: "2026-07-16" },
      ],
    },
    {
      meetings: [
        {
          id: 1,
          startTime: "2026-07-15",
          statusCode: "posted<script>",
        },
      ],
    },
    {
      races: [
        {
          id: 2,
          number: 1,
          firstPrize: 100_000_001,
        },
      ],
    },
    {
      races: [
        {
          id: 2,
          number: 1,
          photoFinishUrl: "https://attacker.example/photo.jpg",
        },
      ],
    },
    {
      races: [
        {
          id: 2,
          number: 1,
          photoFinishUrl:
            "https://user:secret@watchdog.grv.org.au/photo.jpg",
        },
      ],
    },
    {
      meetings: Array.from({ length: 129 }, (_, index) => ({
        id: index + 1,
        startTime: "2026-07-15T09:00:00.000Z",
      })),
    },
  ]) {
    assert.throws(() => parseWatchdogPayload(invalid), /watchdog\.response_invalid/);
  }

  const normalized = parseWatchdogPayload({
    races: [
      {
        id: "race-1",
        raceNumber: "1",
        distance: "515",
        firstPrize: "2000",
        photoFinishUrl: "/photos/race-1.jpg",
      },
    ],
  });
  assert.equal(normalized.races?.[0]?.raceNumber, 1);
  assert.equal(normalized.races?.[0]?.distance, 515);
  assert.equal(normalized.races?.[0]?.firstPrize, 2_000);
  assert.equal(
    normalized.races?.[0]?.photoFinishUrl,
    "https://watchdog.grv.org.au/photos/race-1.jpg",
  );

  const participants = parseWatchdogPayload({
    participants: [
      { id: "valid", raceId: "race-1", dogId: "dog-1", dogName: "Valid" },
      { id: "incomplete", raceId: "race-1", dogName: "Missing dog identifier" },
      { id: "unnamed", raceId: "race-1", dogId: "dog-2" },
      { id: "blank-name", raceId: "race-1", dogId: "dog-3", dogName: "   " },
      { id: "blank-id", raceId: "race-1", dogId: "   ", dogName: "No ID" },
    ],
  });
  assert.equal(participants.participants?.length, 1);
  assert.equal(participants.participants?.[0]?.dogId, "dog-1");

  const [watchdogMeeting] = mapWatchdogPayload(
    parseWatchdogPayload({
      meetings: [
        {
          id: "meeting-1",
          trackName: "Sandown Park",
          meetingDate: "2026-07-16",
        },
      ],
      races: [
        {
          id: "race-1",
          meetingId: "meeting-1",
          raceNumber: 1,
          distance: 515,
          startTime: "2026-07-16T09:00:00.000Z",
        },
      ],
      participants: [
        {
          id: "runner-1",
          raceId: "race-1",
          dogId: "dog-1",
          dogName: "Verified Watchdog Dog",
          box: 1,
          sireId: "sire-1",
          sireName: "Verified Sire",
          damId: "dam-1",
          damName: "Verified Dam",
          whelpedDate: "2024-01-02",
        },
        {
          id: "runner-2",
          raceId: "race-1",
          dogId: "dog-2",
          dogName: "Unknown runner",
          box: 2,
        },
      ],
    }),
  );
  const watchdogRunner = watchdogMeeting?.races[0]?.runners[0];
  assert.equal(watchdogMeeting?.races[0]?.runners.length, 1);
  assert.equal(watchdogRunner?.sourceProvider, "watchdog");
  assert.equal(watchdogRunner?.dog.sourceProvider, "watchdog");
  assert.equal(watchdogRunner?.dog.sourceId, "dog-1");
  assert.equal(watchdogRunner?.dog.earBrand, undefined);
  assert.equal(watchdogRunner?.dog.whelpDate, "2024-01-02");
  assert.equal(watchdogRunner?.dog.sire?.sourceId, "sire-1");
  assert.equal(watchdogRunner?.dog.dam?.sourceId, "dam-1");
}

function assertHtmlParserBounds() {
  const links = parseMeetingLinks(`
    <li class="list__row">
      <a href="/racing/wentworth-park/2026-07-15?trial=false"></a>
      <div class="meeting__info__name">${"A".repeat(2_000)}</div>
    </li>
    <li class="list__row">
      <a href="/racing/wentworth-park/2026-07-15?trial=false"></a>
      <div class="meeting__info__name">Duplicate</div>
    </li>
    <li class="list__row">
      <a href="/racing/wentworth-park/2026-02-31?trial=false"></a>
      <div class="meeting__info__name">Invalid date</div>
    </li>
  `);
  assert.equal(links.length, 1);
  assert.equal(links[0]?.name.length, 500);

  const race = parseTheDogsRaceResult(
    `
      <div class="race-header__info__grade">Maiden 520m</div>
      <a data-turbolinks-action="video" href="https://user:secret@www.thedogs.com.au/replay"></a>
      <a class="race-header__media__item--photo" href="https://attacker.example/photo"></a>
      <tr class="race-runner">
        <td><sprite-svg name="rug_1"></sprite-svg></td>
        <td><a href="/dogs/101/fast-one"><div class="race-runners__name__dog">Fast One</div></a></td>
      </tr>
    `,
    {
      href: "/racing/wentworth-park/2026-07-15/1/test",
      raceNumber: 1,
    },
    "2026-07-15",
  );
  assert.equal(race?.replayUrl, undefined);
  assert.equal(race?.photoFinishUrl, undefined);

  assert.throws(
    () => parseFastTrackMeeting("", "Missing date"),
    /fasttrack\.response_invalid/,
  );
  const fastTrack = parseFastTrackMeeting(
    "",
    `${"X".repeat(2_000)} - 15/07`,
  );
  assert.equal(fastTrack.trackName.length, 500);

  const boundedFastTrackRace = parseFastTrackMeeting(`
    <title>Sandown Park 15/07/2026</title>
    <div class="race-detail clear-both">
      <div class="race-number">1</div>
      <div class="race-time">7:30 pm</div>
      <div>${"padding ".repeat(200)}</div>
      <div>515 metres</div>
      <div>Stakemoney Of $2,000</div>
      <table class="raceResultsTable"><tbody><tr>
        <td>1</td><td>Unidentified Runner [M]</td><td>Trainer</td>
        <td>1</td><td>1</td><td>30</td><td></td><td></td><td>29.5</td><td>0</td>
      </tr></tbody></table>
    </div>
  `);
  assert.equal(boundedFastTrackRace.races[0]?.distance, 515);
  assert.equal(boundedFastTrackRace.races[0]?.prizeMoney, 2_000);
  assert.equal(boundedFastTrackRace.races[0]?.runners.length, 0);

  const identifiedFastTrackRace = parseFastTrackMeeting(`
    <title>Sandown Park 15/07/2026</title>
    <div class="race-detail clear-both">
      <div class="race-number">1</div>
      <div class="race-time">7:30 pm</div>
      <div>515 metres</div>
      <table class="raceResultsTable"><tbody><tr>
        <td>1</td><td><a data-dog-id="12345">Identified Runner [M]</a></td><td>Trainer</td>
        <td>1</td><td>1</td><td>30</td><td></td><td></td><td>29.5</td><td>0</td>
      </tr></tbody></table>
    </div>
  `);
  const fastTrackRunner = identifiedFastTrackRace.races[0]?.runners[0];
  assert.equal(fastTrackRunner?.dog.sourceProvider, "fasttrack-prototype");
  assert.equal(fastTrackRunner?.dog.sourceId, "12345");
  assert.equal(fastTrackRunner?.dog.name, "Identified Runner");
}

function fetchReturning(response: Response): typeof fetch {
  return (async () => response) as typeof fetch;
}

function fetchInspecting(
  handler: (init?: RequestInit) => Response,
): typeof fetch {
  return (async (_input: URL | RequestInfo, init?: RequestInit) =>
    handler(init)) as typeof fetch;
}

function fetchInspectingRequest(
  handler: (input: URL | RequestInfo, init?: RequestInit) => Response,
): typeof fetch {
  return (async (input: URL | RequestInfo, init?: RequestInit) =>
    handler(input, init)) as typeof fetch;
}

function htmlResponse(body: string) {
  return new Response(body, { headers: { "content-type": "text/html" } });
}

function jsonResponse(body: string) {
  return new Response(body, {
    headers: { "content-type": "application/json" },
  });
}

function exactMessage(expected: string) {
  return (error: unknown) => error instanceof Error && error.message === expected;
}
