import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const syncSource = readFileSync(new URL("./sync.ts", import.meta.url), "utf8");

function functionSource(name: string, nextName: string) {
  const start = syncSource.indexOf(`async function ${name}`);
  const end = syncSource.indexOf(`async function ${nextName}`, start);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${nextName} must follow ${name}`);
  return syncSource.slice(start, end);
}

function assertFillOnly(
  source: string,
  table: "Race" | "RaceVideo",
  fields: readonly string[],
) {
  for (const field of fields) {
    assert.ok(
      source.includes(
        `"${field}" = COALESCE("${table}"."${field}", EXCLUDED."${field}")`,
      ),
      `${table}.${field} must fill a null gap without replacing an existing value`,
    );
  }
}

const raceVideoUpsert = functionSource(
  "bulkUpsertRaceVideos",
  "bulkUpsertMeetings",
);
assertFillOnly(raceVideoUpsert, "RaceVideo", [
  "sourceId",
  "pageUrl",
  "embedSourceType",
  "sourceStatus",
  "sourceCode",
  "streamUrl",
  "streamContentType",
  "title",
  "description",
  "sourceRawJson",
  "fetchedAt",
]);
assert.ok(
  raceVideoUpsert.includes(`"lastSyncedAt" = EXCLUDED."lastSyncedAt"`),
  "RaceVideo.lastSyncedAt must still advance on every conflict",
);

const raceUpsert = functionSource("bulkUpsertRaceChunkSet", "loadExactDogIdentityClaims");
assertFillOnly(raceUpsert, "Race", ["replayUrl", "photoFinishUrl"]);
assert.ok(
  raceUpsert.includes(`"lastSyncedAt" = EXCLUDED."lastSyncedAt"`),
  "Race.lastSyncedAt must still advance on every conflict",
);

console.log("forward-only replay upsert regression tests passed");
