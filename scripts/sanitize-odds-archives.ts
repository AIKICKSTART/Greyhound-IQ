/**
 * Remove legacy price and wagering fields from local and database archives.
 * Dry-run is the default; pass --apply to rewrite, and --database to include DB rows.
 *
 * Examples:
 *   npx tsx scripts/sanitize-odds-archives.ts --limit 100
 *   npx tsx scripts/sanitize-odds-archives.ts --apply
 *   npx tsx scripts/sanitize-odds-archives.ts --database
 *   npx tsx scripts/sanitize-odds-archives.ts --database --apply
 */
import "./load-import-env";

import { createReadStream, createWriteStream } from "node:fs";
import { copyFile, opendir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { once } from "node:events";
import { createInterface } from "node:readline";

import { prisma } from "../src/lib/db";
import {
  sanitizeArchiveText,
  sanitizeProviderHtml,
  sanitizeRawJson,
} from "../src/lib/live/raw-sanitizer";

type Options = {
  apply: boolean;
  database: boolean;
  limit: number;
  root: string;
};

type Counts = {
  filesScanned: number;
  filesChanged: number;
  recordsChanged: number;
  databaseRowsScanned: number;
  databaseRowsChanged: number;
};

const counts: Counts = {
  filesScanned: 0,
  filesChanged: 0,
  recordsChanged: 0,
  databaseRowsScanned: 0,
  databaseRowsChanged: 0,
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  console.log(JSON.stringify({ mode: options.apply ? "apply" : "dry-run", ...options }, null, 2));

  for await (const file of archiveFiles(options.root)) {
    if (counts.filesScanned >= options.limit) break;
    await sanitizeFile(file, options.apply);
  }

  if (options.database) await sanitizeDatabase(options.apply, options.limit);
  console.log(JSON.stringify(counts, null, 2));
}

async function sanitizeFile(file: string, apply: boolean) {
  counts.filesScanned += 1;
  if (file.toLowerCase().endsWith(".jsonl")) {
    await sanitizeJsonLines(file, apply);
    return;
  }

  const before = await readFile(file, "utf8");
  const after = sanitizeArchiveText(before);
  if (after === before) return;
  counts.filesChanged += 1;
  counts.recordsChanged += 1;
  if (apply) await replaceFile(file, after);
}

async function sanitizeJsonLines(file: string, apply: boolean) {
  const temp = `${file}.sanitize-${process.pid}.tmp`;
  const writer = apply ? createWriteStream(temp, { encoding: "utf8" }) : null;
  let changed = 0;

  try {
    const lines = createInterface({
      input: createReadStream(file, { encoding: "utf8" }),
      crlfDelay: Infinity,
    });
    for await (const line of lines) {
      const sanitized = sanitizeArchiveText(line);
      if (sanitized !== line) changed += 1;
      if (writer && !writer.write(`${sanitized}\n`)) await once(writer, "drain");
    }
    if (writer) {
      writer.end();
      await once(writer, "finish");
    }
    if (changed === 0) {
      if (writer) await rm(temp, { force: true });
      return;
    }
    counts.filesChanged += 1;
    counts.recordsChanged += changed;
    if (apply) {
      await copyFile(temp, file);
      await rm(temp, { force: true });
    }
  } catch (error) {
    writer?.destroy();
    await rm(temp, { force: true });
    throw error;
  }
}

async function replaceFile(file: string, contents: string) {
  const temp = `${file}.sanitize-${process.pid}.tmp`;
  await writeFile(temp, contents, "utf8");
  try {
    await copyFile(temp, file);
  } finally {
    await rm(temp, { force: true });
  }
}

async function* archiveFiles(root: string): AsyncGenerator<string> {
  const directory = await opendir(path.resolve(root));
  for await (const entry of directory) {
    const fullPath = path.join(directory.path, entry.name);
    if (entry.isDirectory()) yield* archiveFiles(fullPath);
    else if (entry.isFile() && /\.(?:html?|jsonl?)$/i.test(entry.name)) yield fullPath;
  }
}

async function sanitizeDatabase(apply: boolean, limit: number) {
  const take = Math.min(100, Number.isFinite(limit) ? limit : 100);
  let remaining = limit;
  let cursor: string | undefined;

  while (remaining > 0) {
    const rows = await prisma.dogProfileArchive.findMany({
      orderBy: { id: "asc" },
      take: Math.min(take, remaining),
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        candidateJson: true,
        parsedJson: true,
        profileHtml: true,
        fullFormHtml: true,
      },
    });
    if (rows.length === 0) break;
    for (const row of rows) {
      counts.databaseRowsScanned += 1;
      const data = {
        candidateJson: sanitizeNullableJson(row.candidateJson),
        parsedJson: sanitizeNullableJson(row.parsedJson),
        profileHtml: sanitizeNullableHtml(row.profileHtml),
        fullFormHtml: sanitizeNullableHtml(row.fullFormHtml),
      };
      if (
        data.candidateJson === row.candidateJson &&
        data.parsedJson === row.parsedJson &&
        data.profileHtml === row.profileHtml &&
        data.fullFormHtml === row.fullFormHtml
      ) continue;
      counts.databaseRowsChanged += 1;
      if (apply) await prisma.dogProfileArchive.update({ where: { id: row.id }, data });
    }
    cursor = rows.at(-1)?.id;
    remaining -= rows.length;
  }

  remaining = limit;
  cursor = undefined;
  while (remaining > 0) {
    const rows: { id: string; rawJson: string }[] = await prisma.raceDayArchive.findMany({
      orderBy: { id: "asc" },
      take: Math.min(take, remaining),
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, rawJson: true },
    });
    if (rows.length === 0) break;
    for (const row of rows) {
      counts.databaseRowsScanned += 1;
      const rawJson = sanitizeRawJson(row.rawJson);
      if (rawJson === row.rawJson) continue;
      counts.databaseRowsChanged += 1;
      if (apply) await prisma.raceDayArchive.update({ where: { id: row.id }, data: { rawJson } });
    }
    cursor = rows.at(-1)?.id;
    remaining -= rows.length;
  }
}

function sanitizeNullableJson(value: string | null) {
  return value == null ? null : sanitizeRawJson(value);
}

function sanitizeNullableHtml(value: string | null) {
  return value == null ? null : sanitizeProviderHtml(value);
}

function parseOptions(args: string[]): Options {
  const value = (name: string) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const limitValue = Number(value("--limit") ?? Number.POSITIVE_INFINITY);
  if (!(limitValue > 0)) throw new Error("--limit must be a positive number");
  return {
    apply: args.includes("--apply"),
    database: args.includes("--database"),
    limit: Number.isFinite(limitValue) ? Math.trunc(limitValue) : limitValue,
    root: value("--root") ?? ".backfill",
  };
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
