import assert from "node:assert/strict";

import type { PedigreeNode } from "./pedigree";
import {
  analyzePedigreeOverlap,
  findCommonAncestors,
  pedigreeCompleteness,
  sharedAncestors,
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

console.log("pedigree-analysis passed");
