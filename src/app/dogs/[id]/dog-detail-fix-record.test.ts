import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const page = readFileSync(join(__dirname, "page.tsx"), "utf8");
const pedigree = readFileSync(
  join(__dirname, "../../../components/pedigree-chart.tsx"),
  "utf8",
);
const tree = readFileSync(
  join(__dirname, "../../../components/pedigree-tree.tsx"),
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
assert.ok(pedigree.includes('PedigreeTree'));
assert.ok(pedigree.includes('giq-pedigree-heading'));
assert.ok(pedigree.includes('overflow-x-auto'));
// Interactive tree: lineage-tinted branches, mobile focus window, drill chips.
assert.ok(tree.includes('lineage === "sire"'));
assert.ok(tree.includes('hsl(var(--secondary) / 0.8)'));
assert.ok(tree.includes('hsl(var(--primary-bright) / 0.8)'));
assert.ok(tree.includes('DESKTOP_DEPTH = 5'));
assert.ok(tree.includes('MOBILE_DEPTH = 2'));
assert.ok(tree.includes('min-h-[64px]'));
assert.ok(tree.includes('w-[104px] lg:w-[220px]'));
assert.ok(tree.includes('min-width: 1024px'));
assert.ok(tree.includes('ResizeObserver'));
assert.ok(tree.includes('prefers-reduced-motion'));
assert.ok(tree.includes('Lineage trail'));

console.log("dog detail fix-record contract passed");
