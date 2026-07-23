import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const page = readFileSync(join(__dirname, "page.tsx"), "utf8");
const pedigree = readFileSync(
  join(__dirname, "../../../components/pedigree-chart.tsx"),
  "utf8",
);
const queries = readFileSync(join(__dirname, "../../../lib/queries.ts"), "utf8");

assert.ok(page.includes('label: "Prize Money"'));
assert.ok(page.includes("formatDogPrizeMoney(dog.prizeMoney).text"));
assert.ok(!page.includes('label: "Best Time"'));
assert.ok(!page.includes("Career winnings"));
assert.ok(!page.includes("getDogPrizeMoney"));

const headers = [
  "Date",
  "Track",
  "Dist",
  "Box",
  "Finish",
  "Time",
  "Grade",
  "Wgt",
  "1st Sec",
  "Mgn",
  "Winner / 2nd",
  "Race",
];
let previousHeader = -1;
for (const header of headers) {
  const index = page.indexOf(`"${header}"`, previousHeader + 1);
  assert.ok(index > previousHeader, `${header} must remain in the approved column order`);
  previousHeader = index;
}
assert.ok(page.includes("giq-recent-form-row-interactive"));
assert.ok(
  page.includes(
    "grid-cols-[minmax(60px,1fr)_32px_44px_48px_44px]",
  ),
);
assert.ok(page.includes("min-[390px]:grid-cols-"));
assert.ok(page.includes("min-h-11 min-w-11"));
assert.ok(page.includes('aria-label="Play race replay"'));
assert.ok(page.includes('"h-14 w-14"'));
assert.ok(page.includes('"h-6 w-6 fill-current"'));
assert.ok(!/2nd sectional|2nd sec|startingprice|\bodds\b|\br\/t\b/i.test(page));

assert.ok(queries.includes("profileForms: {"));
for (const field of [
  "firstSectional: true",
  "margin: true",
  "winnerDogName: true",
  "hasVideo: true",
]) {
  assert.ok(queries.includes(field), `${field} must be selected for Recent Form`);
}

assert.ok(pedigree.includes('generations = 5'));
assert.ok(pedigree.includes('lineage === "sire"'));
assert.ok(pedigree.includes('before:bg-[hsl(var(--secondary))]'));
assert.ok(pedigree.includes('before:bg-[hsl(var(--primary-bright))]'));
assert.ok(pedigree.includes('min-w-[448px]'));
assert.ok(pedigree.includes('lg:min-w-[1008px]'));
assert.ok(pedigree.includes('w-[84px] lg:w-[180px]'));
assert.ok(pedigree.includes('w-[96px] lg:w-[220px]'));
assert.ok(pedigree.includes('generation === 0'));
assert.ok(pedigree.includes('min-h-[64px]'));
assert.ok(pedigree.includes('min-h-[56px]'));
assert.ok(pedigree.includes('min-h-[52px]'));
assert.ok(pedigree.includes('min-h-[48px]'));
assert.ok(pedigree.includes('giq-pedigree-heading'));
assert.ok(pedigree.includes('var(--metal-silver)/0.35'));
assert.ok(pedigree.includes('overflow-x-auto'));

console.log("dog detail fix-record contract passed");
