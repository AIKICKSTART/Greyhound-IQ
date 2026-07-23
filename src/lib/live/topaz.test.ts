import assert from "node:assert/strict";

import { TopazProvider } from "./topaz";

void main();

async function main() {
  await acceptsAndNormalizesAllowlistedPayloads();
  await rejectsInvalidFieldTypes();
  await rejectsPlaceholderOrUnidentifiedDogs();
  await rejectsMalformedAndOversizedResponses();
  await rejectsUnboundedCollections();
  await retriesOnlyWithinTheBoundedPolicy();
  console.log("topaz provider tests passed");
}

async function acceptsAndNormalizesAllowlistedPayloads() {
  const provider = new TopazProvider(
    "test-key",
    (async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/meeting")) {
        return jsonResponse([
          {
            meetingId: 42,
            trackName: "Sandown Park",
            meetingDate: "2026-07-15",
            owningAuthorityCode: "VIC",
            unexpectedPrivilege: "administrator",
          },
        ]);
      }
      return jsonResponse({
        meetingId: 42,
        trackName: "Sandown Park",
        meetingDate: "2026-07-15",
        owningAuthorityCode: "VIC",
        providerSecret: "must-not-propagate",
        races: [
          {
            raceId: 4201,
            raceNumber: 1,
            raceStart: "2026-07-15T09:00:00.000Z",
            distance: 515,
            prizeMoney1: 10_000,
            injectedHtml: "<script>unsafe()</script>",
            runs: [
              {
                runId: 420101,
                dogId: 12345,
                dogName: "Safe Runner",
                sireId: 111,
                sireName: "Verified Sire",
                damId: 222,
                damName: "Verified Dam",
                dateWhelped: "2024-01-02",
                boxNumber: 1,
                place: 1,
                providerCredential: "must-not-propagate",
              },
            ],
          },
        ],
      });
    }) as typeof fetch,
  );

  const meetings = await provider.fetchUpcomingMeetings(1);
  assert.equal(meetings.length, 1);
  assert.equal(meetings[0]?.sourceId, "42");
  assert.equal(meetings[0]?.races[0]?.sourceId, "4201");
  const runner = meetings[0]?.races[0]?.runners[0];
  assert.equal(runner?.sourceProvider, "topaz");
  assert.equal(runner?.sourceId, "420101");
  assert.equal(runner?.dog.sourceProvider, "topaz");
  assert.equal(runner?.dog.sourceId, "12345");
  assert.equal(runner?.dog.name, "Safe Runner");
  assert.equal(runner?.dog.whelpDate, "2024-01-02");
  assert.deepEqual(runner?.dog.sire, {
    sourceProvider: "topaz",
    sourceId: "111",
    name: "Verified Sire",
  });
  assert.deepEqual(runner?.dog.dam, {
    sourceProvider: "topaz",
    sourceId: "222",
    name: "Verified Dam",
  });
  assert.equal(runner?.prizeMoneyWon, 10_000);
  const normalized = JSON.stringify(meetings);
  assert.ok(!normalized.includes("unexpectedPrivilege"));
  assert.ok(!normalized.includes("providerSecret"));
  assert.ok(!normalized.includes("providerCredential"));
  assert.ok(!normalized.includes("injectedHtml"));
}

async function rejectsInvalidFieldTypes() {
  const provider = providerReturning([
    {
      meetingId: "42",
      trackName: "Sandown Park",
      meetingDate: "2026-07-15",
    },
  ]);
  await assert.rejects(
    () => provider.fetchUpcomingMeetings(1),
    (error: unknown) =>
      error instanceof Error && error.message === "topaz.response_invalid",
  );

  const malformedResultProvider = providerReturning([
    {
      raceId: 7,
      trackName: "Sandown Park",
      raceNumber: 1,
      distance: 515,
      raceStart: "2026-07-15T09:00:00.000Z",
      runs: [{ dogId: 100, dogName: "Runner", boxNumber: "one" }],
    },
  ]);
  await assert.rejects(
    () => malformedResultProvider.fetchResults(1),
    (error: unknown) =>
      error instanceof Error && error.message === "topaz.response_invalid",
  );
}

async function rejectsPlaceholderOrUnidentifiedDogs() {
  for (const run of [
    { dogName: "Real Name", boxNumber: 1 },
    { dogId: 100, dogName: "Unknown runner", boxNumber: 1 },
    { dogId: 100, dogName: "Vacant Box", boxNumber: 1 },
  ]) {
    const provider = providerReturning([
      {
        raceId: 7,
        trackName: "Sandown Park",
        raceNumber: 1,
        distance: 515,
        raceStart: "2026-07-15T09:00:00.000Z",
        runs: [run],
      },
    ]);
    await assert.rejects(
      () => provider.fetchResults(1),
      (error: unknown) =>
        error instanceof Error && error.message === "topaz.response_invalid",
    );
  }
}

async function rejectsMalformedAndOversizedResponses() {
  const invalidJson = new TopazProvider(
    "test-key",
    (async () =>
      new Response("not-json", {
        headers: { "content-type": "application/json" },
      })) as typeof fetch,
  );
  await assert.rejects(
    () => invalidJson.fetchResults(1),
    /topaz\.response_invalid_json/,
  );

  const wrongContentType = new TopazProvider(
    "test-key",
    (async () =>
      new Response("[]", {
        headers: { "content-type": "text/plain" },
      })) as typeof fetch,
  );
  await assert.rejects(
    () => wrongContentType.fetchResults(1),
    /remote_response\.invalid_content_type/,
  );

  const oversized = new TopazProvider(
    "test-key",
    (async () =>
      new Response("[]", {
        headers: {
          "content-type": "application/json",
          "content-length": String(5 * 1024 * 1024 + 1),
        },
      })) as typeof fetch,
  );
  await assert.rejects(
    () => oversized.fetchResults(1),
    /remote_response\.too_large/,
  );
}

async function rejectsUnboundedCollections() {
  const result = {
    raceId: 7,
    trackName: "Sandown Park",
    raceNumber: 1,
    distance: 515,
    raceStart: "2026-07-15T09:00:00.000Z",
    runs: [],
  };
  const provider = providerReturning(Array.from({ length: 5_001 }, () => result));
  await assert.rejects(
    () => provider.fetchResults(1),
    (error: unknown) =>
      error instanceof Error && error.message === "topaz.response_invalid",
  );
}

async function retriesOnlyWithinTheBoundedPolicy() {
  let calls = 0;
  const provider = new TopazProvider(
    "test-key",
    (async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(null, {
          status: 503,
          headers: { "retry-after": "0" },
        });
      }
      return jsonResponse([]);
    }) as typeof fetch,
  );
  assert.deepEqual(await provider.fetchResults(1), []);
  assert.equal(calls, 2);
}

function providerReturning(value: unknown) {
  return new TopazProvider(
    "test-key",
    (async () => jsonResponse(value)) as typeof fetch,
  );
}

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
