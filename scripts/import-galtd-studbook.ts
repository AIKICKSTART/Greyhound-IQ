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
import { readFileSync, readdirSync } from "node:fs";
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

function chunk<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const isCuid = (s: string): boolean => /^[a-z0-9]+$/i.test(s);

/**
 * Batched write over a remote pooler: createMany the dogs + referenced-parent stubs,
 * resolve slug->id, then bulk-link sire/dam via UPDATE ... FROM (VALUES ...).
 * skipDuplicates makes re-runs idempotent (existing rows keep their first-seen values).
 */
async function writeGraph(records: DogRecord[]): Promise<{ inserted: number; linked: number }> {
  // 1. Stubs for parents referenced by name but with no own entry.
  const bySlug = new Map(records.map((r) => [r.slug, r]));
  const stubs = new Map<string, { name: string; sex: "M" | "F" }>();
  for (const r of records) {
    if (r.sireName) {
      const s = slugify(r.sireName);
      if (s && !bySlug.has(s) && !stubs.has(s)) stubs.set(s, { name: r.sireName, sex: "M" });
    }
    if (r.damName) {
      const s = slugify(r.damName);
      if (s && !bySlug.has(s) && !stubs.has(s)) stubs.set(s, { name: r.damName, sex: "F" });
    }
  }

  // 2. Bulk insert dogs + stubs.
  const dogRows = records.map((r) => ({
    name: r.name,
    earBrand: `${SOURCE}:${r.slug}`,
    sourceProvider: SOURCE,
    sourceId: r.slug,
    sex: r.sex,
    colour: r.colour,
    whelpDate: r.whelpDate,
    ownerName: r.owner,
    profileSourceRawJson: JSON.stringify({ firstVol: r.firstVol, dna: r.dna }),
  }));
  const stubRows = [...stubs.entries()].map(([slug, s]) => ({
    name: s.name,
    earBrand: `${SOURCE}:${slug}`,
    sourceProvider: SOURCE,
    sourceId: slug,
    sex: s.sex,
  }));
  let inserted = 0;
  for (const c of chunk([...dogRows, ...stubRows], 1000)) {
    const res = await prisma.dog.createMany({ data: c, skipDuplicates: true });
    inserted += res.count;
    console.log(`  inserted ${inserted} (skipDuplicates)`);
  }

  // 3. slug -> id map.
  const allSlugs = [...new Set([...records.map((r) => r.slug), ...stubs.keys()])];
  const idMap = new Map<string, string>();
  for (const c of chunk(allSlugs, 1000)) {
    const rows = await prisma.dog.findMany({
      where: { earBrand: { in: c.map((s) => `${SOURCE}:${s}`) } },
      select: { earBrand: true, id: true },
    });
    for (const row of rows) idMap.set(row.earBrand!.slice(SOURCE.length + 1), row.id);
  }

  // 4. Bulk link sire/dam.
  const links: { id: string; sireId?: string; damId?: string }[] = [];
  for (const r of records) {
    if (!r.sireName && !r.damName) continue;
    const id = idMap.get(r.slug);
    if (!id || !isCuid(id)) continue;
    const sireId = r.sireName ? idMap.get(slugify(r.sireName)) : undefined;
    const damId = r.damName ? idMap.get(slugify(r.damName)) : undefined;
    if (sireId || damId) links.push({ id, sireId, damId });
  }

  let linked = 0;
  for (const c of chunk(links, 500)) {
    const tuples = c
      .map((l) => {
        const sid = l.sireId && isCuid(l.sireId) ? `'${l.sireId}'` : "''";
        const did = l.damId && isCuid(l.damId) ? `'${l.damId}'` : "''";
        return `('${l.id}',${sid},${did})`;
      })
      .join(",");
    // Values are cuids validated by isCuid ([a-z0-9]) — no injection surface.
    await prisma.$executeRawUnsafe(
      `UPDATE "Dog" AS d SET "sireId" = NULLIF(v.sid,''), "damId" = NULLIF(v.did,'') ` +
        `FROM (VALUES ${tuples}) AS v(id, sid, did) WHERE d.id = v.id`
    );
    linked += c.length;
    console.log(`  linked ${linked}/${links.length}`);
  }

  return { inserted, linked };
}

function resolveFiles(): string[] {
  const dir = arg("dir");
  if (dir) {
    return readdirSync(dir)
      .filter((f) => /\.(pdf|txt)$/i.test(f))
      .sort()
      .map((f) => join(dir, f));
  }
  const file = arg("file");
  if (!file) throw new Error("--file <path.pdf|.txt> or --dir <folder> is required");
  return [file];
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const limit = Number(arg("limit") ?? "0");
  const files = resolveFiles();

  // Parse + merge every volume into one graph (cross-volume dedup by slug).
  const dogs = new Map<string, DogRecord>();
  let namedLitters = 0;
  let unnamedLitters = 0;
  for (const f of files) {
    const parsed = parseStudBook(extractText(f));
    for (const rec of parsed.dogs.values()) mergeRecord(dogs, rec);
    namedLitters += parsed.namedLitters;
    unnamedLitters += parsed.unnamedLitters;
    console.log(`Parsed ${f}: +${parsed.dogs.size} dogs (running total ${dogs.size})`);
  }

  let records = [...dogs.values()];
  if (limit > 0) records = records.slice(0, limit);
  const withParents = records.filter((r) => r.sireName && r.damName).length;
  console.log(
    `Corpus: ${records.length} unique dogs, ${namedLitters} named pups, ` +
      `${unnamedLitters} unnamed litters, ${withParents} with sire+dam.`
  );

  if (dryRun) {
    for (const r of records.slice(0, 12)) {
      console.log(
        `  ${r.name} [${r.sex ?? "?"} ${r.colour ?? "?"} ${
          r.whelpDate?.toISOString().slice(0, 7) ?? "?"
        }] by ${r.sireName ?? "?"} / ${r.damName ?? "?"}`
      );
    }
    return;
  }

  const { inserted, linked } = await writeGraph(records);
  console.log(`Done: ${inserted} new dogs inserted, ${linked} linked to sire/dam.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
