import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { normalizeRaceRunners } from "./sync";
import type { LiveRunner } from "./provider";

const dog = (sourceId: string) => ({
  sourceProvider: "watchdog",
  sourceId,
  name: `Dog ${sourceId}`,
});

const runner = (
  sourceId: string,
  boxNumber: number,
  overrides: Partial<LiveRunner> = {}
): LiveRunner => ({
  sourceProvider: "watchdog",
  sourceId: `participant-${sourceId}`,
  boxNumber,
  dog: dog(sourceId),
  scratched: false,
  ...overrides,
});

assert.deepEqual(
  normalizeRaceRunners([
    runner("same", 9),
    runner("same", 7),
    runner("different", 2),
  ]).map((item) => [item.dog.sourceId, item.boxNumber]),
  [
    ["same", 7],
    ["different", 2],
  ]
);

assert.equal(
  normalizeRaceRunners([
    runner("result", 3),
    runner("result", 10, { finishingPosition: 2 }),
  ])[0]?.boxNumber,
  10
);

assert.equal(
  normalizeRaceRunners([
    runner("scratching", 4, { scratched: true }),
    runner("scratching", 9),
  ])[0]?.boxNumber,
  9
);

const withoutIdentity = runner("missing", 1, {
  dog: { name: "Identity unavailable" },
});
assert.equal(normalizeRaceRunners([withoutIdentity, withoutIdentity]).length, 2);

const discarded: Array<[number, number]> = [];
normalizeRaceRunners(
  [runner("observed", 9), runner("observed", 4)],
  (loser, preferred) => discarded.push([loser.boxNumber, preferred.boxNumber]),
);
assert.deepEqual(discarded, [[9, 4]]);

const syncSource = readFileSync(new URL("./sync.ts", import.meta.url), "utf8");
const upsertSystemSource = sourceBetween(
  syncSource,
  "async function upsertSystemMeetings(",
  "async function setLiveSyncSystemContext(",
);
const quarantineWrite = upsertSystemSource.lastIndexOf(
  "await writeLiveFeedQuarantines(quarantineEvents);",
);
const detach = upsertSystemSource.indexOf(
  "await detachQuarantinedFormEntryRaceLinks(orphanedFormEntries);",
);
assert.ok(quarantineWrite >= 0 && detach > quarantineWrite);

const canonicalFailure = sourceBetween(
  upsertSystemSource,
  "} catch (error) {",
  "\n  }\n  await writeLiveFeedQuarantines(quarantineEvents);",
);
assert.match(canonicalFailure, /writeLiveFeedQuarantines\(quarantineEvents\)/);
assert.match(canonicalFailure, /throw error/);
assert.doesNotMatch(canonicalFailure, /detachQuarantinedFormEntryRaceLinks/);

const upsertMeetingsSource = sourceBetween(
  syncSource,
  "async function upsertMeetings(",
  "async function syncStage<T>(",
);
assert.ok(
  upsertMeetingsSource.indexOf('"collectOrphanedFormEntries"') >
    upsertMeetingsSource.indexOf('"ensureFormEntries"'),
);
assert.match(
  upsertMeetingsSource,
  /runnerItems\.filter\(\(item\) => dogIds\.has\(dogKey\(item\.runner\.dog\)\)\)/,
);

const orphanScanSource = sourceBetween(
  syncSource,
  "async function collectOrphanedFormEntries(",
  "async function detachQuarantinedFormEntryRaceLinks(",
);
assert.match(orphanScanSource, /FORM_ENTRY_ORPHAN_SCAN_LIMIT \+ 1/);
assert.match(orphanScanSource, /form_entry\."raceId" IN/);
assert.match(orphanScanSource, /runner\."raceId" = form_entry\."raceId"/);
assert.match(orphanScanSource, /runner\."dogId" = form_entry\."dogId"/);
assert.match(
  orphanScanSource,
  /reasonCode: "form_entry_runner_missing_after_live_sync"/,
);
assert.match(orphanScanSource, /throw new Error\("live\.form_entry_orphan_scan_limit_exceeded"\)/);

const detachSource = sourceBetween(
  syncSource,
  "async function detachQuarantinedFormEntryRaceLinks(",
  "function meetingDate(",
);
assert.match(detachSource, /UPDATE "FormEntry" AS form_entry/);
assert.match(detachSource, /SET "raceId" = NULL/);
assert.match(detachSource, /form_entry\."id" = captured\."id"/);
assert.match(detachSource, /form_entry\."dogId" = captured\."dogId"/);
assert.match(detachSource, /form_entry\."raceId" = captured\."raceId"/);
assert.match(detachSource, /runner\."raceId" = captured\."raceId"/);
assert.match(detachSource, /runner\."dogId" = captured\."dogId"/);
assert.doesNotMatch(detachSource, /DELETE\s+FROM\s+"FormEntry"/i);

function sourceBetween(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0 && endIndex > startIndex);
  return source.slice(startIndex, endIndex);
}

console.log("live runner identity normalization tests passed");
