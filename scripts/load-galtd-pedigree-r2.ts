/**
 * Direct GALTD pedigree loader for the serving R2 database.
 *
 * The authoritative merge pipeline never completed, so R2 has the studbook
 * schema but no resolved parentage, and none of the non-racing breeding dogs.
 * This loads the already-transcribed GALTD studbook straight into R2 in two
 * phases:
 *
 *   Phase 1 — insert every named studbook dog that is NOT already an R2 dog
 *     (matched by normalizedName + whelp year-month) as a `galtd`-sourced Dog
 *     with no race history. This gives the breeding-only ancestors an identity
 *     so parentage can point at them.
 *   Phase 2 — resolve each studbook dog's sire/dam (by unique normalizedName
 *     across racing + breeding dogs) and set Dog.sireId / Dog.damId ONLY where
 *     currently NULL (additive; never overwrites existing links). Every
 *     ambiguity is skipped.
 *
 * This is the user-facing pedigree layer (what powers the breeding charts). The
 * full PedigreeAssertion/DogSourceIdentity evidence ledger is a separate
 * audit-grade artifact and is intentionally out of scope here; a
 * PedigreeImportRun row records provenance and makes the load reversible.
 *
 * Dry-run by default. Pass --apply to write.
 */
import "./load-import-env";

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";

import { prisma } from "../src/lib/db";

const EXPECTED_HOST = "10.240.116.2";
const EXPECTED_DATABASE = "giq_production_stage11_20260718_r2";
const PARSER_VERSION = "galtd-studbook-audit-v1";
const LOADER_VERSION = "giq-galtd-pedigree-r2-load/v2";
// Valid 64-hex artifact identity (the strict GALTD audit report SHA-256).
const GALTD_REPORT_SHA256 = "cc7654cdd0e2704601b322c5a903044f03ccab216fd238a700f8545148ea0253";
// GALTD studbooks are jurisdiction-authoritative; higher than scraped feeds.
const SOURCE_AUTHORITY = 100;

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

// Must match import-galtd-studbook.ts normalizeName exactly.
function normalizeName(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[’]/gu, "'")
    .replace(/\s*\((?:eire|old|imp)\)\s*$/iu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("en-AU");
}

function ymKey(normName: string, whelp: Date | null): string | null {
  if (!whelp || Number.isNaN(whelp.getTime())) return null;
  return `${normName}|${whelp.getUTCFullYear()}-${String(whelp.getUTCMonth() + 1).padStart(2, "0")}`;
}

type Observation = {
  sourceId: string;
  normalizedName: string;
  sourceName: string;
  whelpDate: Date | null;
  sex?: string;
  colour?: string;
};

type Assertion = {
  subjectSourceId: string;
  relationship: "sire" | "dam";
  parentNorm: string;
};

async function readJsonl<T>(path: string, pick: (row: any) => T | null): Promise<T[]> {
  const out: T[] = [];
  const rl = createInterface({ input: createReadStream(path, "utf8"), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const value = pick(JSON.parse(line));
    if (value) out.push(value);
  }
  return out;
}

function pushMap(map: Map<string, string[]>, key: string, id: string): void {
  const list = map.get(key);
  if (list) list.push(id);
  else map.set(key, [id]);
}

async function assertServingTarget(): Promise<void> {
  const [id] = await prisma.$queryRaw<Array<{ database: string; host: string }>>`
    SELECT current_database()::text AS database, host(inet_server_addr())::text AS host
  `;
  if (!id || id.database !== EXPECTED_DATABASE || id.host !== EXPECTED_HOST) {
    throw new Error(`galtd_load.target_mismatch observed=${JSON.stringify(id ?? null)}`);
  }
}

async function chunkedWrite<T>(rows: T[], size: number, run: (chunk: T[]) => Promise<number>): Promise<number> {
  let written = 0;
  for (let i = 0; i < rows.length; i += size) {
    written += await run(rows.slice(i, i + size));
  }
  return written;
}

const sqlStr = (v: string | null): string => (v === null ? "NULL" : `'${v.replace(/'/gu, "''")}'`);

async function main() {
  const apply = process.argv.includes("--apply");
  const observationsPath = arg("observations") ?? "/mnt/pedigree/staged/observations.jsonl";
  const assertionsPath = arg("assertions") ?? "/mnt/pedigree/staged/assertions.jsonl";

  await assertServingTarget();

  // Existing R2 dogs.
  const dogs = await prisma.$queryRaw<
    Array<{ id: string; name: string; whelpDate: Date | null; sireId: string | null; damId: string | null }>
  >`SELECT id, name, "whelpDate", "sireId", "damId" FROM "Dog"`;

  const byNameWhelp = new Map<string, string[]>();
  const byName = new Map<string, string[]>();
  const needsSire = new Set<string>();
  const needsDam = new Set<string>();
  for (const dog of dogs) {
    const norm = normalizeName(dog.name);
    pushMap(byName, norm, dog.id);
    const wk = ymKey(norm, dog.whelpDate);
    if (wk) pushMap(byNameWhelp, wk, dog.id);
    if (!dog.sireId) needsSire.add(dog.id);
    if (!dog.damId) needsDam.add(dog.id);
  }

  // Observations.
  const observations = await readJsonl<Observation>(observationsPath, (r) =>
    r.sourceId && r.normalizedName
      ? {
          sourceId: r.sourceId,
          normalizedName: r.normalizedName,
          sourceName: r.sourceName ?? r.normalizedName,
          whelpDate: r.whelpDate ? new Date(r.whelpDate) : null,
          sex: r.sex,
          colour: r.colour,
        }
      : null,
  );

  // Phase 1 classification: match to existing dog, insert as breeding dog, or skip ambiguous.
  const stats = {
    observations: observations.length,
    matchedExisting: 0,
    ambiguousExisting: 0,
    toInsertBreeding: 0,
    sireLinked: 0,
    damLinked: 0,
    parentUnresolved: 0,
    skippedSelfReference: 0,
  };
  // sourceId -> resolved dogId (existing or newly minted)
  const dogBySourceId = new Map<string, string>();
  const inserts: Array<{ id: string; sourceId: string; name: string; whelp: Date | null; sex: string | null; colour: string | null; norm: string }> = [];

  for (const obs of observations) {
    const wk = ymKey(obs.normalizedName, obs.whelpDate);
    const existing = wk ? byNameWhelp.get(wk) : byName.get(obs.normalizedName);
    if (existing && existing.length === 1) {
      dogBySourceId.set(obs.sourceId, existing[0]);
      stats.matchedExisting += 1;
      continue;
    }
    if (existing && existing.length > 1) {
      stats.ambiguousExisting += 1;
      continue;
    }
    // No existing racing dog: mint a breeding dog and index it so parents resolve.
    const id = randomUUID();
    inserts.push({ id, sourceId: obs.sourceId, name: obs.sourceName, whelp: obs.whelpDate, sex: obs.sex ?? null, colour: obs.colour ?? null, norm: obs.normalizedName });
    dogBySourceId.set(obs.sourceId, id);
    pushMap(byName, obs.normalizedName, id);
    if (wk) pushMap(byNameWhelp, wk, id);
    needsSire.add(id);
    needsDam.add(id);
    stats.toInsertBreeding += 1;
  }

  // Phase 2: resolve parentage against the complete (racing + breeding) set.
  const assertions = await readJsonl<Assertion>(assertionsPath, (r) =>
    r.subjectSourceId && (r.relationship === "sire" || r.relationship === "dam") && r.assertedParentNormalizedName
      ? { subjectSourceId: r.subjectSourceId, relationship: r.relationship, parentNorm: r.assertedParentNormalizedName }
      : null,
  );
  const uniqueByName = (norm: string): string | null => {
    const ids = byName.get(norm);
    return ids && ids.length === 1 ? ids[0] : null;
  };
  const sireUpdates: Array<[string, string]> = [];
  const damUpdates: Array<[string, string]> = [];
  for (const a of assertions) {
    const dogId = dogBySourceId.get(a.subjectSourceId);
    if (!dogId) continue;
    const needs = a.relationship === "sire" ? needsSire : needsDam;
    if (!needs.has(dogId)) continue;
    const parentId = uniqueByName(a.parentNorm);
    if (!parentId) {
      stats.parentUnresolved += 1;
      continue;
    }
    if (parentId === dogId) {
      stats.skippedSelfReference += 1;
      continue;
    }
    if (a.relationship === "sire") {
      sireUpdates.push([dogId, parentId]);
      stats.sireLinked += 1;
    } else {
      damUpdates.push([dogId, parentId]);
      stats.damLinked += 1;
    }
  }

  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", loaderVersion: LOADER_VERSION, stats }, null, 2));
  if (!apply) {
    console.log("DRY_RUN_COMPLETE — pass --apply to write");
    return;
  }

  // Apply: provenance row, insert breeding dogs, then link parentage.
  const importRunId = randomUUID();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SELECT set_config('app.system', 'true', true)");
    await tx.$executeRaw`
      INSERT INTO "PedigreeImportRun" (
        "id","sourceProvider","sourceAuthority","verificationStatus","status",
        "artifactUri","artifactSha256","artifactBytes","parserVersion",
        "recordsObserved","assertionsObserved","issuesObserved","completedAt","createdAt","updatedAt"
      ) VALUES (
        ${importRunId},'galtd',${SOURCE_AUTHORITY},'parsed','merged',
        ${"gs://giq-full-history/pedigree/galtd-studbooks-v66-v73"},${GALTD_REPORT_SHA256},${BigInt(0)},${PARSER_VERSION},
        ${stats.observations},${assertions.length},${5},NOW(),NOW(),NOW()
      )
    `;
  });

  const insertedDogs = await chunkedWrite(inserts, 1000, async (chunk) => {
    const values = chunk
      .map(
        (d) =>
          `('${d.id}',${sqlStr(d.name)},${sqlStr(d.sex)},${sqlStr(d.colour)},${d.whelp && !Number.isNaN(d.whelp.getTime()) ? `'${d.whelp.toISOString()}'` : "NULL"},'galtd',${sqlStr(d.sourceId)},NOW(),NOW())`,
      )
      .join(",");
    return prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SELECT set_config('app.system', 'true', true)");
      return tx.$executeRawUnsafe(
        `INSERT INTO "Dog" ("id","name","sex","colour","whelpDate","sourceProvider","sourceId","createdAt","updatedAt")
         VALUES ${values}
         ON CONFLICT ("sourceProvider","sourceId") DO NOTHING`,
      );
    });
  });

  const linkParent = async (col: "sireId" | "damId", pairs: Array<[string, string]>) =>
    chunkedWrite(pairs, 1000, async (chunk) => {
      const values = chunk.map((p) => `('${p[0]}','${p[1]}')`).join(",");
      return prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SELECT set_config('app.system', 'true', true)");
        return tx.$executeRawUnsafe(
          `UPDATE "Dog" AS d SET "${col}" = v.parent, "updatedAt" = NOW()
           FROM (VALUES ${values}) AS v(dog, parent)
           WHERE d.id = v.dog AND d."${col}" IS NULL`,
        );
      });
    });

  const sireWritten = await linkParent("sireId", sireUpdates);
  const damWritten = await linkParent("damId", damUpdates);
  console.log(JSON.stringify({ applied: true, importRunId, insertedDogs, sireWritten, damWritten }));
  console.log("GALTD_PEDIGREE_LOAD_COMPLETE");
}

main()
  .catch((error) => {
    console.error("[galtd-pedigree-load] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
