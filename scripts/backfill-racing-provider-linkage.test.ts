import assert from "node:assert/strict";

import {
  addCandidate,
  addTrainerCandidate,
  type IdentityCandidate,
  type TrainerIdentityCandidate,
  parseRunnerProviderEvidence,
} from "./backfill-racing-provider-linkage";

const theDogs = parseRunnerProviderEvidence(
  "thedogs",
  JSON.stringify({
    dogId: "123",
    dogProfileUrl: "https://www.thedogs.com.au/dogs/123",
    trainerId: "456",
    trainerName: "Exact Trainer",
    trainerProfileUrl: "https://www.thedogs.com.au/trainers/456",
    weight: 31.4,
  }),
);
assert.equal(theDogs.dogSourceId, "123");
assert.equal(theDogs.trainerSourceId, "456");
assert.equal(theDogs.trainerName, "Exact Trainer");
assert.equal(theDogs.officialWeight, 31.4);

const watchdog = parseRunnerProviderEvidence(
  "watchdog",
  JSON.stringify({
    dogId: 9,
    trainerId: 10,
    trainer: "Official API Trainer",
    resultWeight: "28.7",
  }),
);
assert.equal(watchdog.dogSourceId, "9");
assert.equal(watchdog.trainerSourceId, "10");
assert.equal(watchdog.officialWeight, 28.7);

assert.deepEqual(
  parseRunnerProviderEvidence("unknown", JSON.stringify({ dogId: "1" })),
  {
    dogSourceId: null,
    dogProfileUrl: null,
    trainerSourceId: null,
    trainerName: null,
    trainerProfileUrl: null,
    officialWeight: null,
  },
);

const candidates = new Map<string, IdentityCandidate>();
const conflicts = new Set<string>();
const firstSeenAt = new Date("2026-07-20T00:00:00Z");
const lastSeenAt = new Date("2026-07-22T00:00:00Z");
addCandidate(candidates, conflicts, "thedogs\u00001", {
  canonicalId: "dog-1",
  sourceProvider: "thedogs",
  sourceId: "1",
  profileUrl: null,
  firstSeenAt: lastSeenAt,
  lastSeenAt,
  evidenceSha256: "evidence",
});
addCandidate(candidates, conflicts, "thedogs\u00001", {
  canonicalId: "dog-1",
  sourceProvider: "thedogs",
  sourceId: "1",
  profileUrl: "https://www.thedogs.com.au/dogs/1",
  firstSeenAt,
  lastSeenAt,
  evidenceSha256: "evidence",
});
assert.equal(candidates.get("thedogs\u00001")?.firstSeenAt, firstSeenAt);
assert.equal(
  candidates.get("thedogs\u00001")?.profileUrl,
  "https://www.thedogs.com.au/dogs/1",
);
assert.equal(conflicts.size, 0);

const trainerCandidates = new Map<string, TrainerIdentityCandidate>();
const trainerConflicts = new Set<string>();
addTrainerCandidate(trainerCandidates, trainerConflicts, "watchdog\u00002", {
  canonicalId: "temporary-trainer",
  historicalCanonical: false,
  sourceProvider: "watchdog",
  sourceId: "2",
  name: "Exact Trainer",
  profileUrl: null,
  firstSeenAt: lastSeenAt,
  lastSeenAt,
  evidenceSha256: "",
});
addTrainerCandidate(trainerCandidates, trainerConflicts, "watchdog\u00002", {
  canonicalId: "historical-trainer",
  historicalCanonical: true,
  sourceProvider: "watchdog",
  sourceId: "2",
  name: "Exact Trainer",
  profileUrl: null,
  firstSeenAt,
  lastSeenAt,
  evidenceSha256: "",
});
assert.equal(
  trainerCandidates.get("watchdog\u00002")?.canonicalId,
  "historical-trainer",
);
assert.equal(trainerConflicts.size, 0);

console.log("backfill racing provider linkage tests passed");
