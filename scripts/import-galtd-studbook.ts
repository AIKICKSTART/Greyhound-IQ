/**
 * Import the Greyhounds Australasia (GALTD) Stud Book into the Dog pedigree graph.
 *
 * Source: free public PDFs at https://galtd.org.au/participant-services/studbook/studbook-download/
 * Each volume lists one year of registrations in a hierarchical sire -> dam -> progeny layout,
 * and every named dog carries a `by Sire-Dam` clause. Parsing that gives us the pedigree links.
 *
 * Usage:
 *   npx tsx scripts/import-galtd-studbook.ts --file <vol.pdf|vol.txt> --vol 73 --dry-run
 *   npx tsx scripts/import-galtd-studbook.ts --file <vol.pdf> --vol 73
 *
 * .pdf input requires poppler's `pdftotext` on PATH (operator/backfill machine). Pass a
 * pre-extracted `.txt` (from `pdftotext -layout`) to skip that dependency.
 *
 * ponytail: identity is name-slug within the `galtd` namespace. Greyhound names are unique
 * within a long window under GA rules, so name-collision across eras is rare and accepted here.
 * Reconciling galtd dogs against existing `thedogs` dogs (by name + whelp year) is a separate pass.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import "./load-import-env";
import { prisma } from "../src/lib/db";

const SOURCE = "galtd";

const MONTHS: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

interface DogRecord {
  slug: string;
  name: string;
  sex?: "M" | "F";
  colour?: string;
  whelpDate?: Date;
  owner?: string;
  firstVol?: number;
  dna?: boolean;
  sireName?: string;
  damName?: string;
  raw: string;
}

interface ParseResult {
  dogs: Map<string, DogRecord>;
  namedLitters: number;
  unnamedLitters: number;
  linkedParents: number;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toWhelpDate(mon: string, year: string): Date | undefined {
  const m = MONTHS[mon];
  if (!m) return undefined;
  return new Date(Date.UTC(Number(year), m - 1, 1));
}

/** Pull `by Sire-Dam` from a tail/continuation string. Splits on the first hyphen. */
function parseParents(text: string): { sireName?: string; damName?: string } {
  const m = text.match(/\bby\s+(.+?)-(.+?)\s*$/);
  if (!m) return {};
  const sireName = m[1].trim();
  const damName = m[2].replace(/\s*\(.*$/, "").trim(); // drop trailing group flags etc.
  if (!sireName || !damName) return {};
  return { sireName, damName };
}

/** First balanced parenthetical after the whelp year is the owner. */
function parseOwner(tail: string): string | undefined {
  const m = tail.match(/\(([^()]*(?:\([^()]*\)[^()]*)*)\)/);
  if (!m) return undefined;
  const owner = m[1].trim();
  if (!owner || /^DNA$/i.test(owner) || /^\d+$/.test(owner)) return undefined;
  return owner;
}

// A sire/dam entry: `Name (DNA)? (vol) COLOUR, Mon Year ...tail`
const ENTRY_RE =
  /^(\s*)(\S.*?)\s+(?:\(DNA\)\s+)?\((\d+)\)\s+([A-Z]+),\s+([A-Z][a-z]{2})\s+(\d{4})(.*)$/;
// A named puppy: `Name colour d|b, Mon Year; Owner`
const PUPPY_RE =
  /^(\s{6,})(\S.*?)\s+([a-z]{1,6})\s+([db]),\s+([A-Z][a-z]{2})\s+(\d{4});\s*(.*)$/;
// An unnamed litter summary: `N dogs(...) M bitches(...), Mon Year`
const UNNAMED_RE = /^\s{6,}\d+\s+dogs?\(/i;
// A continuation line carrying `by Sire-Dam`
const BY_CONT_RE = /^\s+by\s+\S.*-\S.*$/;

function mergeRecord(map: Map<string, DogRecord>, rec: DogRecord): DogRecord {
  const existing = map.get(rec.slug);
  if (!existing) {
    map.set(rec.slug, rec);
    return rec;
  }
  // Prefer non-empty fields; keep earliest firstVol.
  existing.sex ??= rec.sex;
  existing.colour ??= rec.colour;
  existing.whelpDate ??= rec.whelpDate;
  existing.owner ??= rec.owner;
  existing.dna ||= rec.dna;
  existing.sireName ??= rec.sireName;
  existing.damName ??= rec.damName;
  if (rec.firstVol && (!existing.firstVol || rec.firstVol < existing.firstVol)) {
    existing.firstVol = rec.firstVol;
  }
  return existing;
}

function parseStudBook(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  const dogs = new Map<string, DogRecord>();
  let namedLitters = 0;
  let unnamedLitters = 0;

  let currentSire: DogRecord | undefined;
  let currentDam: DogRecord | undefined;
  let lastEntry: DogRecord | undefined; // for `by` continuation lines

  for (const line of lines) {
    if (!line.trim()) continue;

    // Continuation `by Sire-Dam` for the previous entry.
    if (lastEntry && !lastEntry.sireName && BY_CONT_RE.test(line)) {
      const parents = parseParents(line);
      if (parents.sireName) {
        lastEntry.sireName = parents.sireName;
        lastEntry.damName = parents.damName;
      }
      lastEntry = undefined;
      continue;
    }

    const puppy = line.match(PUPPY_RE);
    if (puppy && currentSire && currentDam) {
      const [, , rawName, colour, sexCode, mon, year, owner] = puppy;
      const name = rawName.trim();
      const rec: DogRecord = {
        slug: slugify(name),
        name,
        sex: sexCode === "d" ? "M" : "F",
        colour: colour.toUpperCase(),
        whelpDate: toWhelpDate(mon, year),
        owner: owner.trim() || undefined,
        sireName: currentSire.name,
        damName: currentDam.name,
        raw: line.trim(),
      };
      if (rec.slug) mergeRecord(dogs, rec);
      namedLitters++;
      lastEntry = undefined;
      continue;
    }

    if (UNNAMED_RE.test(line)) {
      unnamedLitters++;
      lastEntry = undefined;
      continue;
    }

    const entry = line.match(ENTRY_RE);
    if (entry) {
      const [, indent, rawName, vol, colour, mon, year, tail] = entry;
      const name = rawName.trim();
      const slug = slugify(name);
      if (!slug) continue;
      const isSire = indent.length === 0;
      const parents = parseParents(tail);
      const rec: DogRecord = {
        slug,
        name,
        sex: isSire ? "M" : "F",
        colour: colour.toUpperCase(),
        whelpDate: toWhelpDate(mon, year),
        owner: parseOwner(tail),
        firstVol: Number(vol),
        dna: /\(DNA\)/.test(line),
        sireName: parents.sireName,
        damName: parents.damName,
        raw: line.trim(),
      };
      const merged = mergeRecord(dogs, rec);
      if (isSire) {
        currentSire = merged;
        currentDam = undefined;
      } else {
        currentDam = merged;
      }
      lastEntry = merged;
      continue;
    }

    lastEntry = undefined;
  }

  return { dogs, namedLitters, unnamedLitters, linkedParents: 0 };
}

function extractText(file: string): string {
  if (file.toLowerCase().endsWith(".txt")) return readFileSync(file, "utf8");
  const out = join(tmpdir(), `galtd-${Date.now()}.txt`);
  const res = spawnSync("pdftotext", ["-layout", file, out], { encoding: "utf8" });
  if (res.status !== 0) {
    throw new Error(`pdftotext failed (is poppler installed?): ${res.stderr || res.error}`);
  }
  return readFileSync(out, "utf8");
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function upsertDog(rec: DogRecord, vol: number): Promise<string> {
  const earBrand = `${SOURCE}:${rec.slug}`;
  const data = {
    name: rec.name,
    sex: rec.sex,
    colour: rec.colour,
    whelpDate: rec.whelpDate,
    ownerName: rec.owner,
    sourceProvider: SOURCE,
    sourceId: rec.slug,
    profileSourceRawJson: JSON.stringify({ firstVol: rec.firstVol ?? vol, dna: rec.dna, raw: rec.raw }),
    lastProfileSyncedAt: new Date(),
  };
  const row = await prisma.dog.upsert({
    where: { earBrand },
    create: { earBrand, ...data },
    update: data,
    select: { id: true },
  });
  return row.id;
}

/** Ensure a parent referenced only by name exists as at least a stub. */
async function ensureStub(name: string, sex: "M" | "F", cache: Map<string, string>): Promise<string> {
  const slug = slugify(name);
  const cached = cache.get(slug);
  if (cached) return cached;
  const earBrand = `${SOURCE}:${slug}`;
  const row = await prisma.dog.upsert({
    where: { earBrand },
    create: { earBrand, name, sex, sourceProvider: SOURCE, sourceId: slug },
    update: {},
    select: { id: true },
  });
  cache.set(slug, row.id);
  return row.id;
}

async function main(): Promise<void> {
  const file = arg("file");
  const vol = Number(arg("vol") ?? "0");
  const dryRun = process.argv.includes("--dry-run");
  const limit = Number(arg("limit") ?? "0");
  if (!file) throw new Error("--file <path.pdf|.txt> is required");

  const text = extractText(file);
  const { dogs, namedLitters, unnamedLitters } = parseStudBook(text);

  const records = [...dogs.values()];
  const withParents = records.filter((r) => r.sireName && r.damName).length;
  console.log(
    `Parsed vol ${vol}: ${records.length} unique dogs, ${namedLitters} named pups, ` +
      `${unnamedLitters} unnamed litters, ${withParents} with sire+dam.`
  );

  if (dryRun) {
    const sampleFile = join(tmpdir(), `galtd-sample-${vol}.json`);
    writeFileSync(sampleFile, JSON.stringify(records.slice(0, 30), null, 2));
    console.log("Sample of 30 records:");
    for (const r of records.slice(0, 12)) {
      console.log(
        `  ${r.name} [${r.sex ?? "?"} ${r.colour ?? "?"} ${
          r.whelpDate?.toISOString().slice(0, 7) ?? "?"
        }] by ${r.sireName ?? "?"} / ${r.damName ?? "?"}`
      );
    }
    console.log(`Full sample written to ${sampleFile}`);
    return;
  }

  const idCache = new Map<string, string>();
  let done = 0;
  const target = limit > 0 ? records.slice(0, limit) : records;

  for (const rec of target) {
    const id = await upsertDog(rec, vol);
    idCache.set(rec.slug, id);
    if (++done % 500 === 0) console.log(`  upserted ${done}/${target.length}`);
  }

  let linked = 0;
  for (const rec of target) {
    if (!rec.sireName && !rec.damName) continue;
    const sireId = rec.sireName ? await ensureStub(rec.sireName, "M", idCache) : null;
    const damId = rec.damName ? await ensureStub(rec.damName, "F", idCache) : null;
    await prisma.dog.update({
      where: { earBrand: `${SOURCE}:${rec.slug}` },
      data: { sireId, damId },
    });
    if (++linked % 500 === 0) console.log(`  linked ${linked}`);
  }

  console.log(`Done vol ${vol}: ${done} dogs upserted, ${linked} linked to sire/dam.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
