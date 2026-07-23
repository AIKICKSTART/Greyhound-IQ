import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  acceptedMeetingKey,
  ensureTracks,
  normalizeAustralianTrackState,
} from "./sync";
import type { LiveMeeting } from "./provider";
import type { LiveFeedQuarantineInput } from "./quarantine";

void main();

async function main() {
  assert.equal(normalizeAustralianTrackState("ACT"), "ACT");
  assert.equal(normalizeAustralianTrackState("NSW"), "NSW");
  assert.equal(normalizeAustralianTrackState("NZ"), null);
  assert.equal(normalizeAustralianTrackState("nsw"), null);
  assert.equal(normalizeAustralianTrackState(undefined), null);

  await acceptsActWithoutDefaulting();
  await quarantinesMissingAndUnsupportedStates();
  await blocksSameBatchStateConflicts();
  await blocksExistingTrackStateMismatch();
  await blocksRejectedMeetingsFromBorrowingAcceptedRow();

  const source = readFileSync(new URL("./sync.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /state:\s*track\.state\s*\?\?\s*["']NSW["']/);
  assert.match(source, /ensureTracks\(db, meetings, quarantineEvents\)/);
  assert.match(source, /const acceptedMeetingInputs = meetings\.flatMap/);
  assert.match(source, /counts\.meetings = new Set\(/);
  assert.match(source, /const key = acceptedMeetingKey\(meeting, tracks\);/);
  console.log("live track jurisdiction tests passed");
}

async function acceptsActWithoutDefaulting() {
  const created: Array<{ name: string; state: string }> = [];
  const tracks = await ensureTracks(
    trackDb({ created }),
    [meeting("Canberra", "ACT")],
  );

  assert.equal(tracks.get("Canberra")?.state, "ACT");
  assert.deepEqual(created, [{ name: "Canberra", state: "ACT" }]);
}

async function quarantinesMissingAndUnsupportedStates() {
  const created: Array<{ name: string; state: string }> = [];
  const quarantineEvents: LiveFeedQuarantineInput[] = [];
  const tracks = await ensureTracks(
    trackDb({ created }),
    [meeting("Missing State"), meeting("Auckland", "NZ")],
    quarantineEvents,
  );

  assert.equal(tracks.size, 0);
  assert.deepEqual(created, []);
  assert.deepEqual(
    quarantineEvents.map((event) => [event.reasonCode, event.classification]),
    [
      ["missing_track_state", "incomplete"],
      ["unsupported_track_jurisdiction", "invalid"],
    ],
  );
}

async function blocksSameBatchStateConflicts() {
  const created: Array<{ name: string; state: string }> = [];
  const quarantineEvents: LiveFeedQuarantineInput[] = [];
  const tracks = await ensureTracks(
    trackDb({ created }),
    [meeting("State Conflict", "NSW"), meeting("State Conflict", "VIC")],
    quarantineEvents,
  );

  assert.equal(tracks.size, 0);
  assert.deepEqual(created, []);
  assert.equal(
    quarantineEvents.filter((event) => event.reasonCode === "conflicting_track_state").length,
    2,
  );
}

async function blocksExistingTrackStateMismatch() {
  const created: Array<{ name: string; state: string }> = [];
  const quarantineEvents: LiveFeedQuarantineInput[] = [];
  const tracks = await ensureTracks(
    trackDb({
      created,
      existing: [{ id: "existing", name: "Mismatch", state: "VIC" }],
    }),
    [meeting("Mismatch", "NSW")],
    quarantineEvents,
  );

  assert.equal(tracks.size, 0);
  assert.deepEqual(created, []);
  assert.deepEqual(
    quarantineEvents.map((event) => [event.reasonCode, event.classification]),
    [["track_state_mismatch", "conflict"]],
  );
}

async function blocksRejectedMeetingsFromBorrowingAcceptedRow() {
  const accepted = meeting("Shared Track", "NSW");
  const acceptedDuplicate = {
    ...meeting("Shared Track", "NSW"),
    sourceProvider: "thedogs",
    sourceId: "shared-au-duplicate",
  };
  const unsupported = {
    ...meeting("Shared Track", "NZ"),
    sourceProvider: "thedogs",
    sourceId: "shared-nz",
  };
  const missing = {
    ...meeting("Shared Track"),
    sourceProvider: "watchdog",
    sourceId: "shared-missing",
  };
  const meetings = [accepted, acceptedDuplicate, unsupported, missing];
  const quarantineEvents: LiveFeedQuarantineInput[] = [];
  const tracks = await ensureTracks(
    trackDb({ created: [] }),
    meetings,
    quarantineEvents,
  );

  const acceptedKey = acceptedMeetingKey(accepted, tracks);
  assert.ok(acceptedKey);
  assert.deepEqual(
    meetings.map((item) => acceptedMeetingKey(item, tracks)),
    [acceptedKey, acceptedKey, null, null],
  );
  assert.equal(
    new Set(
      meetings
        .map((item) => acceptedMeetingKey(item, tracks))
        .filter((key): key is string => Boolean(key)),
    ).size,
    1,
  );
  assert.deepEqual(
    quarantineEvents.map((event) => ({
      provider: event.provider,
      sourceId: event.sourceId,
      naturalIdentity: event.naturalIdentity,
      reasonCode: event.reasonCode,
    })),
    [
      {
        provider: "thedogs",
        sourceId: "shared-nz",
        naturalIdentity: "Shared Track",
        reasonCode: "unsupported_track_jurisdiction",
      },
      {
        provider: "watchdog",
        sourceId: "shared-missing",
        naturalIdentity: "Shared Track",
        reasonCode: "missing_track_state",
      },
    ],
  );
}

function trackDb({
  created,
  existing = [],
}: {
  created: Array<{ name: string; state: string }>;
  existing?: Array<{ id: string; name: string; state: string }>;
}) {
  return {
    track: {
      findMany: async () => existing,
      create: async ({ data }: { data: { name: string; state: string } }) => {
        created.push(data);
        return { id: `created-${created.length}`, ...data };
      },
    },
  } as never;
}

function meeting(trackName: string, state?: string): LiveMeeting {
  return {
    sourceProvider: "watchdog",
    sourceId: `${trackName}-2026-07-18`,
    trackName,
    state,
    meetingDate: "2026-07-18",
    races: [],
  };
}
