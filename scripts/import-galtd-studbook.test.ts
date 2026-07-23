import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  findConflictingObservations,
  parseStudBook,
  verifyVolumeSet,
  type DogObservation,
} from "./import-galtd-studbook";

const indexPage = Array.from(
  { length: 25 },
  (_, index) => `Index Dog ${index + 1}, ${120 + index}`,
).join("\n");

const source = [
  "112\nENTRIES RECEIVED BETWEEN\nJanuary 1 and December 31",
  [
    "113",
    "A",
    "DODGEM BY DESIGN (DNA) (USASB) RF, Jan 2000 (Owner) by Gable Dodge-Cruzin By Design",
    "     Greys Excursion (66) RBD, Jul 1995 (Owner) by Ej's Douglas-Greys Jasmine",
    "          Blazin Alma bd b, Jun 2002; Owner",
    "     By The Gallon (DNA) (63) BK, Jul 2013 (Owner)",
    "             by Glen Gallon-Velocity Thunder",
    "          By Your Side bk b, Feb 2017; Owner",
    "     Jd Elegant (Imp) (DNA) (US2019) WRBD, Oct 2018 (Owner)",
    "             by Jd Titanium-Jd Bombshell",
    "          Audit Puppy bk d, Dec 2024; Owner",
    "JACKSLITTLETHING (DNA) (ie 2019) BK, Jan 1 (Owner) by Droopys Sydney-Limini",
    "     Idria Bale (DNA) (67) RBD, Mar 2017 (Owner) by Barcia Bale-Dyna Willow",
    "          Paw Audit bk d, Feb 2023; Owner",
    "NESTED TOKEN (US GSB NGA (2016)) BK, Jan 2016 (Owner) by Sire One-Dam One",
    "     Post Registry (IE GSB ICC 100) (Imp) (DNA) BK, Feb 2017 (Owner) by Sire Two-Dam Two",
    "NO REGISTRY (DNA) WBE, Mar 2009 (Owner) by Sire Three-Dam Three",
    "UNKNOWN SIRE (MIG)",
    "     Ruthless Ruth (DNA) (68) BK, Mar 2019 (Owner) by Sh Avatar-Schmickeydoo",
    "          Fit In Five bk b, Oct 2020; Owner",
  ].join("\n"),
  indexPage,
].join("\f");

const parsed = parseStudBook(source, 73);
assert.deepEqual(parsed.issues, []);
assert.equal(parsed.namedPuppies, 5);
assert.equal(parsed.importedEntries, 2);

const dodgem = parsed.observations.find(
  (observation) => observation.sourceName === "DODGEM BY DESIGN",
);
assert.equal(dodgem?.sireName, "Gable Dodge");
assert.equal(dodgem?.damName, "Cruzin By Design");

const imported = parsed.observations.find(
  (observation) => observation.sourceName === "Jd Elegant",
);
assert.equal(imported?.imported, true);
assert.equal(imported?.registryToken, "US2019");
assert.equal(imported?.sourcePage, 113);
assert.ok(imported?.sourceLine);
assert.match(imported?.evidenceSha256 ?? "", /^[0-9a-f]{64}$/u);
assert.equal(imported?.sireEvidence?.sourceLine, (imported?.sourceLine ?? 0) + 1);
assert.equal(imported?.damEvidence?.sourceLine, (imported?.sourceLine ?? 0) + 1);

const nestedRegistry = parsed.observations.find(
  (observation) => observation.sourceName === "NESTED TOKEN",
);
assert.equal(nestedRegistry?.registryToken, "US GSB NGA (2016)");

const postRegistryImported = parsed.observations.find(
  (observation) => observation.sourceName === "Post Registry",
);
assert.equal(postRegistryImported?.registryToken, "IE GSB ICC 100");
assert.equal(postRegistryImported?.imported, true);
assert.equal(postRegistryImported?.dna, true);

const noRegistry = parsed.observations.find(
  (observation) => observation.sourceName === "NO REGISTRY",
);
assert.equal(noRegistry?.registryToken, undefined);
assert.equal(noRegistry?.dna, true);

const incompleteDate = parsed.observations.find(
  (observation) => observation.sourceName === "JACKSLITTLETHING",
);
assert.equal(incompleteDate?.whelpDate, undefined);

const unknownSirePuppy = parsed.observations.find(
  (observation) => observation.sourceName === "Fit In Five",
);
assert.equal(unknownSirePuppy?.sireName, undefined);
assert.equal(unknownSirePuppy?.damName, "Ruthless Ruth");
assert.equal(unknownSirePuppy?.damEvidence?.sourceLine, unknownSirePuppy?.sourceLine);

const ambiguous = parseStudBook(
  source.replace("Gable Dodge-Cruzin By Design", "Gable-Dodge-Cruzin"),
  73,
);
assert.ok(
  ambiguous.issues.some(
    (issue) => issue.code === "ambiguous_inline_parent_clause",
  ),
);

const staleContext = parseStudBook(
  source.replace(
    "          Blazin Alma bd b, Jun 2002; Owner",
    "B\n          Blazin Alma bd b, Jun 2002; Owner",
  ),
  73,
);
assert.ok(
  staleContext.issues.some(
    (issue) => issue.code === "puppy_without_current_litter",
  ),
);

const conflictBase: DogObservation = {
  sourceId: "galtd:test:1",
  sourceName: "Audit Dog",
  normalizedName: "audit dog",
  imported: false,
  dna: true,
  sex: "F",
  whelpDate: new Date("2020-01-01T00:00:00.000Z"),
  sireName: "Sire One",
  damName: "Dam One",
  artifactOffsetLine: 1,
  evidenceSha256: "a".repeat(64),
};
const conflicts = findConflictingObservations([
    conflictBase,
    {
      ...conflictBase,
      sourceId: "galtd:test:2",
      sireName: "Sire Two",
      artifactOffsetLine: 2,
    },
  ]);
assert.equal(conflicts.length, 1);
assert.deepEqual(conflicts[0].relatedSourceIds, [
  "galtd:test:1",
  "galtd:test:2",
]);

assert.doesNotThrow(() => verifyVolumeSet([66, 67, 68], [66, 67, 68]));
assert.throws(() => verifyVolumeSet([66, 66], [66, 67]), /duplicate/u);
assert.throws(() => verifyVolumeSet([66, 68], [66, 67]), /expected volumes/u);

const root = process.cwd();
const schema = readFileSync(join(root, "prisma", "schema.prisma"), "utf8");
const migration = readFileSync(
  join(
    root,
    "prisma",
    "migrations",
    "20260716154500_add_pedigree_provenance_foundation",
    "migration.sql",
  ),
  "utf8",
);
const parserSource = readFileSync(
  join(root, "scripts", "import-galtd-studbook.ts"),
  "utf8",
);

for (const model of [
  "PedigreeImportRun",
  "DogSourceIdentity",
  "PedigreeAssertion",
  "PedigreeMergeLedger",
]) {
  assert.ok(schema.includes(`model ${model} {`));
  assert.ok(
    migration.includes(`ALTER TABLE "${model}" ENABLE ROW LEVEL SECURITY`),
  );
  assert.ok(
    migration.includes(`ALTER TABLE "${model}" FORCE ROW LEVEL SECURITY`),
  );
}
for (const required of [
  "artifactSha256",
  "sourceAuthority",
  "verificationStatus",
  "artifactOffsetLine",
  "evidenceSha256",
  "public.giq_guard_pedigree_evidence()",
  "public.giq_is_system()",
  "public.giq_is_admin()",
  "giq_pedigree_merge_ledger_system_insert",
  'FOREIGN KEY ("subjectIdentityId", "importRunId", "sourceProvider", "artifactSha256")',
  'FOREIGN KEY ("assertionId", "importRunId", "sourceProvider", "artifactSha256")',
  'subject_identity."verificationStatus" = \'verified\'',
  'parent_identity."verificationStatus" = \'verified\'',
]) {
  assert.ok(migration.includes(required), `migration is missing ${required}`);
}
assert.doesNotMatch(migration, /giq_pedigree[^\n]*giq_is_moderator/u);
assert.doesNotMatch(parserSource, /src\/lib\/db|createMany|\$executeRaw/u);

console.log("GALTD parse-only and pedigree provenance checks passed");
