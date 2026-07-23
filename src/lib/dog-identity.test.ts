import assert from "node:assert/strict";

import {
  clusterDogRows,
  mergeCluster,
  normalizeDogName,
  type DogIdentityRow,
} from "./dog-identity";

function row(overrides: Partial<DogIdentityRow> & { id: string; name: string }): DogIdentityRow {
  return {
    sex: null,
    colour: null,
    whelpDate: null,
    sourceProvider: null,
    sireId: null,
    damId: null,
    careerStarts: null,
    careerWins: null,
    prizeMoney: null,
    ...overrides,
  };
}

assert.equal(normalizeDogName("  Fernando   Bale "), "fernando bale");

// Racing row + studbook row for the same dog bridge into one cluster with the
// racing row as primary and fields coalesced across both.
{
  const racing = row({
    id: "racing",
    name: "Fernando Bale",
    sourceProvider: "thedogs",
    colour: "W & Dk Bdl",
    whelpDate: new Date("2013-03-12T00:00:00Z"),
    careerStarts: 44,
    careerWins: 35,
    prizeMoney: 1_300_000,
    sireId: "kelsos-racing",
  });
  const studbook = row({
    id: "studbook",
    name: "Fernando Bale",
    sourceProvider: "galtd",
    sex: "M",
    sireId: "kelsos-studbook",
    damId: "chloe-studbook",
  });
  const clusters = clusterDogRows([studbook, racing]);
  assert.equal(clusters.length, 1);
  const merged = mergeCluster(clusters[0]);
  assert.equal(merged.primaryId, "racing");
  assert.deepEqual(merged.ids, ["racing", "studbook"]);
  assert.equal(merged.sex, "M");
  assert.equal(merged.colour, "W & Dk Bdl");
  assert.equal(merged.careerStarts, 44);
  // Parent links prefer the primary row, falling back to the twin.
  assert.equal(merged.sireId, "kelsos-racing");
  assert.equal(merged.damId, "chloe-studbook");
}

// The Cumbria Jack shape: studbook row with no parent links + unsourced racing
// row that carries the pedigree link. Bridged, the merged identity has both
// the racing record and the sire link.
{
  const studbook = row({
    id: "sb",
    name: "Cumbria Jack",
    sourceProvider: "galtd",
    sex: "M",
    whelpDate: new Date("2023-07-01T00:00:00Z"),
  });
  const racing = row({ id: "rc", name: "Cumbria Jack", careerStarts: 36, sireId: "sire-1" });
  const merged = mergeCluster(clusterDogRows([studbook, racing])[0]);
  assert.equal(merged.primaryId, "rc");
  assert.equal(merged.careerStarts, 36);
  assert.equal(merged.sireId, "sire-1");
  assert.equal(merged.whelpDate?.getUTCFullYear(), 2023);
}

// Same provider twice = two real dogs; never merged.
{
  const a = row({ id: "a", name: "Black Magic", sourceProvider: "galtd" });
  const b = row({ id: "b", name: "Black Magic", sourceProvider: "galtd" });
  assert.equal(clusterDogRows([a, b]).length, 2);
}

// Whelp dates more than a year apart = different eras, never merged.
{
  const older = row({
    id: "old",
    name: "Star Dancer",
    sourceProvider: "galtd",
    whelpDate: new Date("2008-01-01T00:00:00Z"),
  });
  const newer = row({
    id: "new",
    name: "Star Dancer",
    sourceProvider: "thedogs",
    whelpDate: new Date("2019-01-01T00:00:00Z"),
  });
  assert.equal(clusterDogRows([older, newer]).length, 2);
}

// Ambiguity guard: a dateless unsourced row compatible with two same-name
// clusters stays solo instead of guessing.
{
  const eraOne = row({
    id: "e1",
    name: "Star Dancer",
    sourceProvider: "galtd",
    whelpDate: new Date("2008-01-01T00:00:00Z"),
  });
  const eraTwo = row({
    id: "e2",
    name: "Star Dancer",
    sourceProvider: "thedogs",
    whelpDate: new Date("2019-01-01T00:00:00Z"),
  });
  const dateless = row({ id: "loose", name: "Star Dancer", careerStarts: 12 });
  const clusters = clusterDogRows([eraOne, eraTwo, dateless]);
  assert.equal(clusters.length, 3);
}

// Sex never blocks a merge (studbook sex labels are noisy) — the racing row's
// value wins when present, otherwise the twin's value shows.
{
  const studbook = row({ id: "sb2", name: "Sweet It Is", sourceProvider: "galtd", sex: "M" });
  const racing = row({ id: "rc2", name: "Sweet It Is", careerStarts: 6 });
  const clusters = clusterDogRows([studbook, racing]);
  assert.equal(clusters.length, 1);
  assert.equal(mergeCluster(clusters[0]).sex, "M");
}

// Different names never cluster together.
{
  const clusters = clusterDogRows([
    row({ id: "x", name: "Aston Dee Bee" }),
    row({ id: "y", name: "Aston Rupee" }),
  ]);
  assert.equal(clusters.length, 2);
}

console.log("dog identity bridging tests passed");
