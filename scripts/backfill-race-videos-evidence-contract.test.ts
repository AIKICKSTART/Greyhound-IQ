import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

type StatusPartition = {
  count: number;
  setSha256: string;
  providerVideoIds: string[];
};

type EvidenceContract = {
  schemaVersion: number;
  privacy: Record<string, boolean>;
  sourceInventory: {
    standalone: { files: number; bytes: number; fileNameSetSha256: string };
    normalizedRaceMedia: {
      files: number;
      bytes: number;
      rows: number;
      artifactSha256: string;
    };
  };
  standaloneEvidence: {
    records: number;
    invalidJsonRecords: number;
    recordsMissingRaceId: number;
    recordsMissingProviderVideoId: number;
    dryRunRecords: number;
    uniqueRaceIds: number;
    uniqueProviderVideoIds: number;
    uniqueRaceProviderVideoPairs: number;
    raceIdsWithMultipleProviderVideoIds: number;
    providerVideoIdsWithMultipleInternalRaceIds: number;
    crossDatabaseIdentityOnlyConflicts: number;
    recordsByStatus: Record<string, number>;
    uniqueProviderVideoEvidence: Record<string, number>;
  };
  normalizedRaceMedia: {
    invalidJsonRecords: number;
    recordsMissingRequiredIdentity: number;
    mediaRaceNaturalKeysMissingFromNormalizedRaces: number;
    exactRaceReplay: {
      rows: number;
      uniqueRaceNaturalKeys: number;
      uniqueProviderVideoIds: number;
      providerVideoIdSetSha256: string;
      raceNaturalKeysWithMultipleProviderVideoIds: number;
    };
  };
  providerVideoIdComparison: {
    normalizedAndStandalone: { count: number; setSha256: string };
    normalizedOnly: { count: number; setSha256: string };
    standaloneOnly: { count: number; setSha256: string };
  };
  standaloneOnlyProviderIdsByLastEvidenceStatus: Record<
    "200" | "500",
    StatusPartition
  >;
  trueProviderIdCollisions: {
    count: number;
    rows: number;
    setSha256: string;
    requiredDisposition: string;
    providerVideoIds: string[];
  };
  requiredHistoricalDispositions: Record<string, string>;
  candidateReconciliation: {
    standaloneLogAuthority: string;
    importFromStandaloneLogAllowed: boolean;
    standaloneOnlyIdsRequiringDisposition: number;
    permittedFinalDispositions: string[];
  };
};

const contractPath = "scripts/backfill-race-videos-evidence-contract.json";
const rawContract = readFileSync(contractPath, "utf8");
const contract = JSON.parse(rawContract) as EvidenceContract;
const backfillSource = readFileSync("scripts/backfill-race-videos.ts", "utf8");

function setSha256(values: string[]) {
  return createHash("sha256")
    .update([...values].sort().join("\n"))
    .digest("hex");
}

function assertPartition(partition: StatusPartition) {
  assert.equal(partition.providerVideoIds.length, partition.count);
  assert.equal(new Set(partition.providerVideoIds).size, partition.count);
  assert.ok(
    partition.providerVideoIds.every((value) => /^\d+$/.test(value)),
    "provider video identities must remain numeric"
  );
  assert.deepEqual(
    partition.providerVideoIds,
    [...partition.providerVideoIds].sort((left, right) => Number(left) - Number(right)),
    "provider video identities must remain numerically sorted"
  );
  assert.equal(setSha256(partition.providerVideoIds), partition.setSha256);
}

assert.equal(contract.schemaVersion, 1);
assert.deepEqual(Object.values(contract.privacy), [false, false, false]);
assert.doesNotMatch(rawContract, /https?:\/\//i);
assert.doesNotMatch(rawContract, /(?:x-goog-|signature=|credential=|token=)/i);
assert.doesNotMatch(rawContract, /"(?:streamUrl|pageUrl|host)"\s*:/i);

assert.deepEqual(contract.sourceInventory.standalone, {
  files: 71,
  bytes: 69_016_290,
  fileNameSetSha256:
    "60b642e380e0f26188b07668c59947e3bbee0bf46672573204a8d59547c7e66e",
});
assert.deepEqual(contract.sourceInventory.normalizedRaceMedia, {
  files: 64,
  bytes: 323_029_819,
  rows: 538_849,
  artifactSha256:
    "89b90198d3197238a2476381c0917108f21d2e209c02ca066e8ec90c1e8385b1",
  sourceCutoff: "2026-07-01T02:49:36.504Z",
});

assert.equal(contract.standaloneEvidence.records, 309_008);
assert.equal(contract.standaloneEvidence.invalidJsonRecords, 0);
assert.equal(contract.standaloneEvidence.recordsMissingRaceId, 0);
assert.equal(contract.standaloneEvidence.recordsMissingProviderVideoId, 0);
assert.equal(contract.standaloneEvidence.dryRunRecords, 0);
assert.equal(contract.standaloneEvidence.uniqueRaceIds, 307_199);
assert.equal(contract.standaloneEvidence.uniqueProviderVideoIds, 289_852);
assert.equal(contract.standaloneEvidence.uniqueRaceProviderVideoPairs, 307_199);
assert.equal(contract.standaloneEvidence.raceIdsWithMultipleProviderVideoIds, 0);
assert.equal(
  contract.standaloneEvidence.providerVideoIdsWithMultipleInternalRaceIds,
  17_345
);
assert.equal(contract.standaloneEvidence.crossDatabaseIdentityOnlyConflicts, 17_334);
assert.deepEqual(contract.standaloneEvidence.recordsByStatus, {
  "200": 150_631,
  "500": 158_371,
  null: 6,
});
assert.deepEqual(contract.standaloneEvidence.uniqueProviderVideoEvidence, {
  playable200: 141_299,
  provider500Only: 148_547,
  provider500AndThrownError: 6,
});

assert.equal(contract.normalizedRaceMedia.invalidJsonRecords, 0);
assert.equal(contract.normalizedRaceMedia.recordsMissingRequiredIdentity, 0);
assert.equal(contract.normalizedRaceMedia.mediaRaceNaturalKeysMissingFromNormalizedRaces, 0);
assert.deepEqual(contract.normalizedRaceMedia.exactRaceReplay, {
  rows: 289_718,
  uniqueRaceNaturalKeys: 289_718,
  uniqueProviderVideoIds: 289_707,
  providerVideoIdSetSha256:
    "50a47a829072faf4c9d2bab90e915ea5d41836d8c7be4fd95d2d8550c40de95d",
  raceNaturalKeysWithMultipleProviderVideoIds: 0,
});
assert.deepEqual(contract.providerVideoIdComparison.normalizedAndStandalone, {
  count: 289_707,
  setSha256: "50a47a829072faf4c9d2bab90e915ea5d41836d8c7be4fd95d2d8550c40de95d",
});
assert.deepEqual(contract.providerVideoIdComparison.normalizedOnly, {
  count: 0,
  setSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
});

const status200 = contract.standaloneOnlyProviderIdsByLastEvidenceStatus["200"];
const status500 = contract.standaloneOnlyProviderIdsByLastEvidenceStatus["500"];
assertPartition(status200);
assertPartition(status500);
const standaloneOnlyIds = [...status200.providerVideoIds, ...status500.providerVideoIds];
assert.equal(new Set(standaloneOnlyIds).size, 145);
assert.equal(
  setSha256(standaloneOnlyIds),
  contract.providerVideoIdComparison.standaloneOnly.setSha256
);
assert.equal(contract.providerVideoIdComparison.standaloneOnly.count, 145);

const expectedCollisionIds = [
  "916604",
  "932547",
  "1049479",
  "1061579",
  "1068695",
  "1069289",
  "1069295",
  "1090391",
  "1090576",
  "1105870",
  "1185271",
];
assert.deepEqual(contract.trueProviderIdCollisions.providerVideoIds, expectedCollisionIds);
assert.equal(contract.trueProviderIdCollisions.count, 11);
assert.equal(contract.trueProviderIdCollisions.rows, 22);
assert.equal(
  setSha256(expectedCollisionIds),
  contract.trueProviderIdCollisions.setSha256
);
assert.equal(
  contract.trueProviderIdCollisions.requiredDisposition,
  "quarantined-provider-id-race-conflict"
);
assert.ok(
  expectedCollisionIds.every((id) => backfillSource.includes(`"${id}"`)),
  "the candidate guard must contain every true provider collision identity"
);
for (const disposition of Object.values(contract.requiredHistoricalDispositions)) {
  assert.ok(
    backfillSource.includes(disposition),
    `candidate guard is missing required disposition ${disposition}`
  );
}

assert.equal(contract.candidateReconciliation.standaloneLogAuthority, "audit-evidence-only");
assert.equal(contract.candidateReconciliation.importFromStandaloneLogAllowed, false);
assert.equal(contract.candidateReconciliation.standaloneOnlyIdsRequiringDisposition, 145);
assert.deepEqual(contract.candidateReconciliation.permittedFinalDispositions, [
  "present_in_cloned_race_video",
  "explicitly_missing",
  "quarantined",
]);

console.log("race replay offline evidence contract checks passed");
