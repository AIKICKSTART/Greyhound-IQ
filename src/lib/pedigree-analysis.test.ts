import assert from "node:assert/strict";

import type { PedigreeNode } from "./pedigree";
import {
  analyzePedigreeOverlap,
  bloodQuota,
  findCommonAncestors,
  pedigreeCompleteness,
  sharedAncestors,
  wrightCoefficient,
} from "./pedigree-analysis";

function node(partial: Partial<PedigreeNode> & { name: string }): PedigreeNode {
  return {
    id: partial.id ?? null,
    name: partial.name,
    sex: partial.sex ?? null,
    colour: partial.colour ?? null,
    whelpYear: partial.whelpYear ?? null,
    careerStarts: partial.careerStarts ?? null,
    careerWins: partial.careerWins ?? null,
    prizeMoney: partial.prizeMoney ?? null,
    sire: partial.sire,
    dam: partial.dam,
  };
}

// id-matched ancestor on both sides -> one high-confidence line-breeding hit.
const shared = node({ id: "x", name: "Head Honcho" });
const lineBred = node({
  id: "root",
  name: "Subject",
  sire: node({ id: "s", name: "Sire", sire: shared }),
  dam: node({ id: "d", name: "Dam", sire: shared }),
});
const common = findCommonAncestors(lineBred);
assert.equal(common.length, 1);
assert.equal(common[0]?.key, "id:x");
assert.equal(common[0]?.occurrences, 2);
assert.equal(common[0]?.confidence, "linked");

// No overlap -> no common ancestors.
const outcross = node({
  id: "r2",
  name: "Subject2",
  sire: node({ id: "a", name: "A" }),
  dam: node({ id: "b", name: "B" }),
});
assert.equal(findCommonAncestors(outcross).length, 0);

// id-less studbook nodes match by normalized name at lower confidence.
const nameMatched = node({
  id: "r3",
  name: "Subject3",
  sire: node({ id: "s3", name: "S3", dam: node({ name: "Legend Chief" }) }),
  dam: node({ id: "d3", name: "D3", dam: node({ name: "legend  chief" }) }),
});
const nameCommon = findCommonAncestors(nameMatched);
assert.equal(nameCommon.length, 1);
assert.equal(nameCommon[0]?.confidence, "name");

// Unknown / unnamed placeholders never count as shared.
const withUnknown = node({
  id: "r4",
  name: "Subject4",
  sire: node({ name: "Unknown" }),
  dam: node({ name: "Unknown" }),
});
assert.equal(findCommonAncestors(withUnknown).length, 0);

// Completeness: 2-gen full tree = 6 slots; 4 filled -> 67%.
const compRoot = node({
  id: "c",
  name: "C",
  sire: node({ id: "cs", name: "CS", sire: node({ id: "css", name: "CSS" }) }),
  dam: node({ id: "cd", name: "CD", sire: node({ id: "cds", name: "CDS" }) }),
});
const comp = pedigreeCompleteness(compRoot, 2);
assert.equal(comp.total, 6);
assert.equal(comp.filled, 4);
assert.equal(comp.pct, 67);

// sharedAncestors intersects two independent parent trees.
const sireTree = node({ id: "st", name: "ST", sire: node({ id: "g", name: "G" }) });
const damTree = node({ id: "dt", name: "DT", dam: node({ id: "g", name: "G" }) });
assert.equal(
  sharedAncestors(sireTree, damTree).some((c) => c.key === "id:g"),
  true,
);

// A missing ancestor is missing evidence, not proof of an outcross.
assert.equal(analyzePedigreeOverlap(sireTree, damTree, 2).status, "shared");
assert.equal(analyzePedigreeOverlap(outcross.sire ?? null, outcross.dam ?? null, 2).status, "incomplete");

// A definitive outcross requires both requested trees to be complete.
const completeSire = node({
  id: "complete-sire",
  name: "Complete Sire",
  sire: node({ id: "complete-sire-sire", name: "Complete Sire Sire" }),
  dam: node({ id: "complete-sire-dam", name: "Complete Sire Dam" }),
});
const completeDam = node({
  id: "complete-dam",
  name: "Complete Dam",
  sire: node({ id: "complete-dam-sire", name: "Complete Dam Sire" }),
  dam: node({ id: "complete-dam-dam", name: "Complete Dam Dam" }),
});
assert.equal(analyzePedigreeOverlap(completeSire, completeDam, 1).status, "outcross");

// --- Wright's coefficient of inbreeding ------------------------------------

// Parent × offspring: the dam's sire IS the sire. F = 25%.
{
  const coi = wrightCoefficient(
    node({ name: "S" }),
    node({ name: "D", sire: node({ name: "S" }), dam: node({ name: "M" }) }),
    5,
  );
  assert.equal(coi.coiPct, 25);
  assert.equal(coi.contributions.length, 1);
  assert.equal(coi.contributions[0]?.name, "S");
  assert.equal(coi.contributions[0]?.contributionPct, 25);
  assert.equal(coi.contributions[0]?.sireOccurrences, 1);
  assert.equal(coi.contributions[0]?.damOccurrences, 1);
  // A lone dog with no mapped ancestry is far below the completeness floor.
  assert.equal(coi.incomplete, true);
}

// Full siblings' offspring: parents share both grandsire and granddam. F = 25%.
{
  const coi = wrightCoefficient(
    node({ name: "S", sire: node({ name: "SF" }), dam: node({ name: "SM" }) }),
    node({ name: "D", sire: node({ name: "SF" }), dam: node({ name: "SM" }) }),
    5,
  );
  assert.equal(coi.coiPct, 25);
  assert.equal(coi.contributions.length, 2);
  assert.deepEqual(coi.contributions.map((c) => c.contributionPct), [12.5, 12.5]);
}

// Half siblings' offspring: parents share one grandparent. F = 12.5%.
{
  const coi = wrightCoefficient(
    node({ name: "S", sire: node({ name: "SF" }), dam: node({ name: "SM" }) }),
    node({ name: "D", sire: node({ name: "SF" }), dam: node({ name: "DM" }) }),
    5,
  );
  assert.equal(coi.coiPct, 12.5);
  assert.equal(coi.contributions.length, 1);
  assert.equal(coi.contributions[0]?.name, "SF");
}

// First cousins' offspring: parents' sires are full brothers, sharing great-
// grandparents GG1 and GG2. F = 6.25%.
{
  const coi = wrightCoefficient(
    node({
      name: "S",
      sire: node({ name: "SF", sire: node({ name: "GG1" }), dam: node({ name: "GG2" }) }),
      dam: node({ name: "SM" }),
    }),
    node({
      name: "D",
      sire: node({ name: "DF", sire: node({ name: "GG1" }), dam: node({ name: "GG2" }) }),
      dam: node({ name: "DM" }),
    }),
    5,
  );
  assert.equal(coi.coiPct, 6.25);
  assert.equal(coi.contributions.length, 2);
  // Each shared great-grandparent contributes (1/2)^5 = 3.125% (displayed 3.13).
  assert.deepEqual(coi.contributions.map((c) => c.contributionPct), [3.13, 3.13]);
}

// Outcross: no shared ancestor anywhere. F = 0%.
{
  const coi = wrightCoefficient(
    node({ name: "S", sire: node({ name: "SF" }), dam: node({ name: "SM" }) }),
    node({ name: "D", sire: node({ name: "DF" }), dam: node({ name: "DM" }) }),
    5,
  );
  assert.equal(coi.coiPct, 0);
  assert.equal(coi.contributions.length, 0);
}

// Overlap guard: a nearer common ancestor must not double-count through its own
// parents. Parent × offspring stays exactly 25% even though the sire's parents
// also sit on the dam side (reached via the dam's sire).
{
  const coi = wrightCoefficient(
    node({ name: "S", sire: node({ name: "SF" }), dam: node({ name: "SM" }) }),
    node({
      name: "D",
      sire: node({ name: "S", sire: node({ name: "SF" }), dam: node({ name: "SM" }) }),
      dam: node({ name: "M" }),
    }),
    5,
  );
  assert.equal(coi.coiPct, 25);
}

// --- Blood quota of double ancestors ---------------------------------------

// The reference fixture: an ancestor that is the sire (gen 1, 50%) AND the
// dam's sire (gen 2 on the dam side, 25%). Total 75%, split 50% / 25%.
{
  const bq = bloodQuota(
    node({ name: "X" }),
    node({ name: "D", sire: node({ name: "X" }), dam: node({ name: "M" }) }),
    5,
  );
  assert.equal(bq.doubleAncestors.length, 1);
  const x = bq.doubleAncestors[0];
  assert.equal(x?.name, "X");
  assert.equal(x?.totalPct, 75);
  assert.equal(x?.sirePct, 50);
  assert.equal(x?.damPct, 25);
  // Split reconciles to the total.
  assert.equal((x?.sirePct ?? 0) + (x?.damPct ?? 0), x?.totalPct);
  assert.equal(x?.occurrences, 2);
  assert.deepEqual(x?.byGen[0], { gen: 1, sire: 1, dam: 0 });
  assert.deepEqual(x?.byGen[1], { gen: 2, sire: 0, dam: 1 });
  // Ancestor loss: positions X,D,X,M = 4; unique {X,D,M} = 3; 1 - 3/4 = 25%.
  assert.equal(bq.ancestorLoss.mappedPositions, 4);
  assert.equal(bq.ancestorLoss.uniqueAncestors, 3);
  assert.equal(bq.ancestorLoss.lossPct, 25);
}

// No duplication anywhere -> no double ancestors and 0% ancestor loss, by the
// 1 - unique/mapped convention (unique == mapped positions).
{
  const bq = bloodQuota(
    node({ name: "S", sire: node({ name: "SF" }), dam: node({ name: "SM" }) }),
    node({ name: "D", sire: node({ name: "DF" }), dam: node({ name: "DM" }) }),
    5,
  );
  assert.equal(bq.doubleAncestors.length, 0);
  assert.equal(bq.ancestorLoss.mappedPositions, 6);
  assert.equal(bq.ancestorLoss.uniqueAncestors, 6);
  assert.equal(bq.ancestorLoss.lossPct, 0);
}

// Line-breeding within ONE parent counts as a double ancestor: Y sits behind
// both of the sire's parents (gen 3, twice) — 2 × (1/2)^3 = 25% on the sire side.
{
  const bq = bloodQuota(
    node({
      name: "S",
      sire: node({ name: "SF", sire: node({ name: "Y" }) }),
      dam: node({ name: "SM", sire: node({ name: "Y" }) }),
    }),
    node({ name: "D", sire: node({ name: "DF" }), dam: node({ name: "DM" }) }),
    5,
  );
  const y = bq.doubleAncestors.find((a) => a.name === "Y");
  assert.ok(y);
  assert.equal(y?.occurrences, 2);
  assert.equal(y?.sirePct, 25);
  assert.equal(y?.damPct, 0);
  assert.equal(y?.totalPct, 25);
  assert.deepEqual(y?.byGen[2], { gen: 3, sire: 2, dam: 0 });
}

// Generation cap: a chain deeper than the window drops its out-of-window node.
{
  let chain = node({ name: "G6" });
  for (const name of ["G5", "G4", "G3", "G2", "G1"]) {
    chain = node({ name, sire: chain });
  }
  const bq = bloodQuota(chain, node({ name: "D" }), 5);
  // Sire chain G1..G5 (gen 1..5) counts; G6 is gen 6 and excluded. Plus D.
  assert.equal(bq.ancestorLoss.mappedPositions, 6);
}

console.log("pedigree-analysis passed");
