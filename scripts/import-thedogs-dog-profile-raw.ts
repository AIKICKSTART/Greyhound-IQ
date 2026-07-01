/**
 * Replay archived The Dogs dog profile JSON files into the application database.
 *
 * Examples:
 *   npm run import:thedogs:dog-profiles:raw -- --dry-run --limit 10
 *   npm run import:thedogs:dog-profiles:raw -- --source-id 60626 --stop-on-db-error
 *   npm run import:thedogs:dog-profiles:raw -- --full --continue-on-error
 */
import "./load-import-env";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, appendFile, mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/db";

const DEFAULT_PROFILE_DIR = ".backfill/thedogs-dog-profiles-raw";
const DEFAULT_PROGRESS = ".backfill/thedogs-dog-profile-import-progress.jsonl";
const DB_UNAVAILABLE_EXIT_CODE = 75;
const DB_PREFLIGHT_TIMEOUT_MS = 30_000;

type Options = {
  sourceId?: string;
  profileDir: string;
  progressFile: string;
  full: boolean;
  limit: number;
  resume: boolean;
  dryRun: boolean;
  writeProgress: boolean;
  archiveOnly: boolean;
  skipExistingArchive: boolean;
  shardIndex?: number;
  shardCount?: number;
  skipDbPreflight: boolean;
  continueOnError: boolean;
  maxErrors: number;
  stopOnDbError: boolean;
  pauseMs: number;
  retryAttempts: number;
  retryDelayMs: number;
};

type ProfileCandidate = {
  sourceId: string;
  profilePath: string;
};

type ImportCounts = {
  profiles: number;
  formRows: number;
  skippedFormRows: number;
};

type ArchivedProfileFile = {
  source?: string;
  sourceId?: string;
  fetchedAt?: string;
  showMorePath?: string | null;
  profileHtml?: string;
  fullFormHtml?: string;
  candidate?: {
    sourceId?: string;
    name?: string;
    profilePath?: string;
    firstSeenDate?: string;
    lastSeenDate?: string;
    raceAppearances?: number;
  };
  parsed?: ArchivedProfile;
};

type ArchivedProfile = {
  sourceProvider?: string;
  sourceId?: string;
  profileUrl?: string;
  name?: string;
  trainerName?: string;
  ownerName?: string;
  sire?: ArchivedDogLink;
  dam?: ArchivedDogLink;
  colour?: string;
  sex?: string;
  whelpDate?: string;
  careerStarts?: number;
  careerWins?: number;
  careerSeconds?: number;
  careerThirds?: number;
  prizeMoney?: number;
  winPercentage?: number;
  placePercentage?: number;
  profileStatsJson?: string;
  bestTimesJson?: string;
  boxHistoryJson?: string;
  distanceHistoryJson?: string;
  profileSourceRawJson?: string;
  formRows?: ArchivedProfileForm[];
};

type ArchivedDogLink = {
  sourceId?: string;
  name?: string;
  url?: string;
};

type ArchivedProfileForm = {
  sourceId?: string;
  raceUrl?: string;
  date?: string;
  trackCode?: string;
  trackName?: string;
  raceName?: string;
  finishText?: string;
  finishingPosition?: number;
  starters?: number;
  boxNumber?: number;
  weight?: number;
  distance?: number;
  grade?: string;
  runningTime?: number;
  winnerTime?: number;
  bestOfNightTime?: number;
  firstSectional?: number;
  margin?: number;
  winnerDogName?: string;
  winnerDogSourceId?: string;
  inRunningPositions?: string;
  startingPrice?: number;
  hasVideo?: boolean;
  sourceRawJson?: string;
};

type NormalizedProfileForm = Omit<
  ArchivedProfileForm,
  "date" | "raceUrl" | "sourceId"
> & {
  sourceId: string;
  raceUrl: string;
  date: Date;
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const completed = options.resume
    ? await readImportedSourceIds(options.progressFile)
    : new Set<string>();
  const candidates = await findCandidates(options);
  const shardCandidates = filterShard(candidates, options);
  const progressPending = shardCandidates.filter(
    (candidate) => !completed.has(candidate.sourceId)
  );
  const pending = options.skipExistingArchive
    ? await filterExistingArchives(progressPending)
    : progressPending;
  const selected = options.full ? pending : pending.slice(0, options.limit);

  console.log(
    JSON.stringify(
      {
        profileDir: options.profileDir,
        progressFile: options.progressFile,
        sourceId: options.sourceId ?? null,
        dryRun: options.dryRun,
        resume: options.resume,
        writeProgress: options.writeProgress,
        archiveOnly: options.archiveOnly,
        skipExistingArchive: options.skipExistingArchive,
        shardIndex: options.shardIndex ?? null,
        shardCount: options.shardCount ?? null,
        skipDbPreflight: options.skipDbPreflight,
        full: options.full,
        limit: options.limit,
        discoveredProfiles: candidates.length,
        shardProfiles: shardCandidates.length,
        completedImports: completed.size,
        skippedExistingArchives: progressPending.length - pending.length,
        pendingProfiles: pending.length,
        selectedProfiles: selected.length,
        continueOnError: options.continueOnError,
        maxErrors: options.maxErrors,
        stopOnDbError: options.stopOnDbError,
        pauseMs: options.pauseMs,
        retryAttempts: options.retryAttempts,
        retryDelayMs: options.retryDelayMs,
      },
      null,
      2
    )
  );

  if (!options.full && pending.length > selected.length) {
    console.log(
      `[import:thedogs:dog-profiles:raw] Capped to ${selected.length} profile(s). Pass --full or raise --limit to import more.`
    );
  }

  if (!options.dryRun && selected.length > 0 && !options.skipDbPreflight) {
    const dbCheck = await preflightDatabaseWithRetries(options);
    if (!dbCheck.ok) {
      console.error(
        `[import:thedogs:dog-profiles:raw] database unavailable before replay after ${dbCheck.attempts} attempt(s): ${errorMessage(dbCheck.error)}`
      );
      process.exit(DB_UNAVAILABLE_EXIT_CODE);
    }
    console.log(
      `[import:thedogs:dog-profiles:raw] database preflight ok in ${dbCheck.durationMs}ms (attempt ${dbCheck.attempts})`
    );
  }

  let errorCount = 0;
  for (const candidate of selected) {
    const result = await importProfileCandidateWithRetries(candidate, options);
    if (!result.ok) {
      if (options.writeProgress) {
        await appendProgress(options.progressFile, {
          sourceId: candidate.sourceId,
          ok: false,
          imported: false,
          dryRun: options.dryRun,
          profilePath: candidate.profilePath,
          durationMs: result.durationMs,
          attempts: result.attempts,
          error: errorMessage(result.error),
        });
      }
      console.error(
        `[import:thedogs:dog-profiles:raw] ${candidate.sourceId} failed`,
        result.error
      );

      errorCount += 1;
      const dbUnavailable = isDatabaseConnectivityError(result.error);
      process.exitCode =
        options.stopOnDbError && dbUnavailable ? DB_UNAVAILABLE_EXIT_CODE : 1;
      if (
        (options.stopOnDbError && dbUnavailable) ||
        !options.continueOnError ||
        errorCount >= options.maxErrors
      ) {
        break;
      }
    }

    if (options.pauseMs > 0) await sleep(options.pauseMs);
  }
}

async function preflightDatabaseWithRetries(options: Options) {
  const maxAttempts = options.retryAttempts + 1;
  let lastFailure:
    | { ok: false; error: Error; durationMs: number; attempts?: number }
    | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const dbCheck = await preflightDatabase();
    if (dbCheck.ok) return { ...dbCheck, attempts: attempt };
    lastFailure = { ...dbCheck, attempts: attempt };
    if (attempt >= maxAttempts) break;
    console.warn(
      `[import:thedogs:dog-profiles:raw] database preflight attempt ${attempt}/${maxAttempts} failed; retrying in ${options.retryDelayMs}ms: ${errorMessage(dbCheck.error)}`
    );
    if (options.retryDelayMs > 0) await sleep(options.retryDelayMs);
  }

  return lastFailure ?? {
    ok: false as const,
    error: new Error("database preflight did not run"),
    durationMs: 0,
    attempts: 0,
  };
}

async function preflightDatabase() {
  const startedAt = Date.now();
  const tsxCli = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
  const preflightScript = path.join(process.cwd(), "scripts", "preflight-import-database.ts");
  const child = spawn(process.execPath, [tsxCli, preflightScript], {
    cwd: process.cwd(),
    env: process.env,
    windowsHide: true,
  });
  let stdout = "";
  let stderr = "";

  return new Promise<
    | { ok: true; durationMs: number }
    | { ok: false; error: Error; durationMs: number }
  >((resolve) => {
    let settled = false;
    const finish = (result: { ok: true } | { ok: false; error: Error }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ ...result, durationMs: Date.now() - startedAt });
    };
    const timeout = setTimeout(() => {
      killProcessTree(child.pid);
      finish({
        ok: false,
        error: new Error(
          `database preflight child timed out after ${DB_PREFLIGHT_TIMEOUT_MS}ms`
        ),
      });
    }, DB_PREFLIGHT_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => finish({ ok: false, error }));
    child.on("exit", (code, signal) => {
      if (code === 0) {
        finish({ ok: true });
        return;
      }
      finish({
        ok: false,
        error: new Error(
          `database preflight child exited with code ${String(code)} signal ${String(signal)}${preflightOutput(stdout, stderr)}`
        ),
      });
    });
  });
}

function killProcessTree(pid: number | undefined) {
  if (!pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // Process may already have exited.
  }
}

function preflightOutput(stdout: string, stderr: string) {
  const output = [stderr.trim(), stdout.trim()].filter(Boolean).join("\n");
  return output ? `: ${output.slice(-2_000)}` : "";
}

async function importProfileCandidateWithRetries(
  candidate: ProfileCandidate,
  options: Options
) {
  const startedAt = Date.now();
  const maxAttempts = options.retryAttempts + 1;
  let lastError: unknown;
  let attemptsUsed = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    attemptsUsed = attempt;
    try {
      const archive = await readProfileArchive(candidate);
      const counts = options.dryRun
        ? countsFromArchive(archive)
        : options.archiveOnly
          ? await saveProfileArchiveOnly(candidate.sourceId, archive)
          : await saveProfileArchive(candidate.sourceId, archive);
      if (options.writeProgress) {
        await appendProgress(options.progressFile, {
          sourceId: candidate.sourceId,
          name: archive.parsed?.name ?? archive.candidate?.name ?? candidate.sourceId,
          ok: true,
          imported: !options.dryRun && !options.archiveOnly,
          archived: !options.dryRun,
          dryRun: options.dryRun,
          archiveOnly: options.archiveOnly,
          profilePath: candidate.profilePath,
          durationMs: Date.now() - startedAt,
          attempts: attempt,
          ...counts,
        });
      }
      const mode = options.dryRun ? "dry-run" : options.archiveOnly ? "archive" : "import";
      console.log(
        `[import:thedogs:dog-profiles:raw] ${candidate.sourceId} ${mode} ok: ${counts.formRows} form rows (${counts.skippedFormRows} skipped) in ${Date.now() - startedAt}ms (attempt ${attempt}/${maxAttempts})`
      );
      return { ok: true as const };
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) break;
      console.warn(
        `[import:thedogs:dog-profiles:raw] ${candidate.sourceId} attempt ${attempt}/${maxAttempts} failed; retrying in ${options.retryDelayMs}ms`,
        error
      );
      if (options.retryDelayMs > 0) await sleep(options.retryDelayMs);
    }
  }

  return {
    ok: false as const,
    error: lastError,
    attempts: attemptsUsed,
    durationMs: Date.now() - startedAt,
  };
}

async function saveProfileArchiveOnly(
  fallbackSourceId: string,
  archive: ArchivedProfileFile
): Promise<ImportCounts> {
  const profile = archive.parsed;
  if (!profile) throw new Error("missing parsed profile");
  const sourceId = profile.sourceId ?? archive.sourceId ?? fallbackSourceId;
  const sourceProvider = profile.sourceProvider ?? "thedogs";
  const formRows = normalizedFormRows(profile.formRows ?? []);

  await prisma.$executeRaw`
    INSERT INTO "DogProfileArchive" (
      "id",
      "dogId",
      "sourceProvider",
      "sourceId",
      "profileUrl",
      "fetchedAt",
      "showMorePath",
      "candidateJson",
      "parsedJson",
      "profileHtml",
      "fullFormHtml",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      ${null},
      ${sourceProvider},
      ${sourceId},
      ${profile.profileUrl ?? null},
      ${dateOrUndefined(archive.fetchedAt) ?? null},
      ${archive.showMorePath ?? null},
      ${archive.candidate ? JSON.stringify(archive.candidate) : null},
      ${JSON.stringify(profile)},
      ${archive.profileHtml ?? null},
      ${archive.fullFormHtml ?? null},
      NOW(),
      NOW()
    )
    ON CONFLICT ("sourceProvider", "sourceId") DO UPDATE SET
      "profileUrl" = EXCLUDED."profileUrl",
      "fetchedAt" = EXCLUDED."fetchedAt",
      "showMorePath" = EXCLUDED."showMorePath",
      "candidateJson" = EXCLUDED."candidateJson",
      "parsedJson" = EXCLUDED."parsedJson",
      "profileHtml" = EXCLUDED."profileHtml",
      "fullFormHtml" = EXCLUDED."fullFormHtml",
      "updatedAt" = NOW()
  `;

  return {
    profiles: 1,
    formRows: formRows.valid.length,
    skippedFormRows: formRows.skipped,
  };
}

async function saveProfileArchive(
  fallbackSourceId: string,
  archive: ArchivedProfileFile
): Promise<ImportCounts> {
  const profile = archive.parsed;
  if (!profile) throw new Error("missing parsed profile");
  const sourceId = profile.sourceId ?? archive.sourceId ?? fallbackSourceId;
  const sourceProvider = profile.sourceProvider ?? "thedogs";
  const earBrand = `${sourceProvider}:${sourceId}`;
  const sireId = await ensureParentDog(profile.sire, sourceProvider);
  const damId = await ensureParentDog(profile.dam, sourceProvider);
  const trainerId = await ensureTrainer(profile.trainerName);
  const formRows = normalizedFormRows(profile.formRows ?? []);

  const dogData = {
    name: profile.name || archive.candidate?.name || sourceId,
    colour: profile.colour,
    sex: profile.sex,
    whelpDate: dateOrUndefined(profile.whelpDate),
    sireId,
    damId,
    trainerId,
    sourceProvider,
    sourceId,
    profileUrl: profile.profileUrl,
    ownerName: profile.ownerName,
    careerStarts: profile.careerStarts,
    careerWins: profile.careerWins,
    careerSeconds: profile.careerSeconds,
    careerThirds: profile.careerThirds,
    prizeMoney: profile.prizeMoney,
    winPercentage: profile.winPercentage,
    placePercentage: profile.placePercentage,
    profileStatsJson: profile.profileStatsJson,
    bestTimesJson: profile.bestTimesJson,
    boxHistoryJson: profile.boxHistoryJson,
    distanceHistoryJson: profile.distanceHistoryJson,
    profileSourceRawJson: profile.profileSourceRawJson,
    lastProfileSyncedAt: new Date(),
  };
  const dog = await upsertProfileDog(sourceProvider, sourceId, earBrand, dogData);

  const archiveRow = {
    id: randomUUID(),
    dogId: dog.id,
    sourceProvider,
    sourceId,
    profileUrl: profile.profileUrl ?? null,
    fetchedAt: dateOrUndefined(archive.fetchedAt) ?? null,
    showMorePath: archive.showMorePath ?? null,
    candidateJson: archive.candidate ? JSON.stringify(archive.candidate) : null,
    parsedJson: JSON.stringify(profile),
    profileHtml: archive.profileHtml ?? null,
    fullFormHtml: archive.fullFormHtml ?? null,
  };

  await prisma.$executeRaw`
    INSERT INTO "DogProfileArchive" (
      "id",
      "dogId",
      "sourceProvider",
      "sourceId",
      "profileUrl",
      "fetchedAt",
      "showMorePath",
      "candidateJson",
      "parsedJson",
      "profileHtml",
      "fullFormHtml",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${archiveRow.id},
      ${archiveRow.dogId},
      ${archiveRow.sourceProvider},
      ${archiveRow.sourceId},
      ${archiveRow.profileUrl},
      ${archiveRow.fetchedAt},
      ${archiveRow.showMorePath},
      ${archiveRow.candidateJson},
      ${archiveRow.parsedJson},
      ${archiveRow.profileHtml},
      ${archiveRow.fullFormHtml},
      NOW(),
      NOW()
    )
    ON CONFLICT ("sourceProvider", "sourceId") DO UPDATE SET
      "dogId" = EXCLUDED."dogId",
      "profileUrl" = EXCLUDED."profileUrl",
      "fetchedAt" = EXCLUDED."fetchedAt",
      "showMorePath" = EXCLUDED."showMorePath",
      "candidateJson" = EXCLUDED."candidateJson",
      "parsedJson" = EXCLUDED."parsedJson",
      "profileHtml" = EXCLUDED."profileHtml",
      "fullFormHtml" = EXCLUDED."fullFormHtml",
      "updatedAt" = NOW()
  `;

  await prisma.dogProfileForm.deleteMany({
    where: { dogId: dog.id, sourceProvider },
  });
  if (formRows.valid.length > 0) {
    await prisma.dogProfileForm.createMany({
      data: formRows.valid.map((row) => ({
        dogId: dog.id,
        sourceProvider,
        sourceId: row.sourceId,
        raceUrl: row.raceUrl,
        date: row.date,
        trackCode: row.trackCode,
        trackName: row.trackName,
        raceName: row.raceName,
        finishText: row.finishText,
        finishingPosition: row.finishingPosition,
        starters: row.starters,
        boxNumber: row.boxNumber,
        weight: row.weight,
        distance: row.distance,
        grade: row.grade,
        runningTime: row.runningTime,
        winnerTime: row.winnerTime,
        bestOfNightTime: row.bestOfNightTime,
        firstSectional: row.firstSectional,
        margin: row.margin,
        winnerDogName: row.winnerDogName,
        winnerDogSourceId: prefixedSourceId(row.winnerDogSourceId, sourceProvider),
        inRunningPositions: row.inRunningPositions,
        startingPrice: row.startingPrice,
        hasVideo: row.hasVideo ?? false,
        sourceRawJson: row.sourceRawJson,
      })),
    });
  }

  return {
    profiles: 1,
    formRows: formRows.valid.length,
    skippedFormRows: formRows.skipped,
  };
}

async function upsertProfileDog(
  sourceProvider: string,
  sourceId: string,
  earBrand: string,
  dogData: {
    name: string;
    colour?: string;
    sex?: string;
    whelpDate?: Date;
    sireId: string | null;
    damId: string | null;
    trainerId: string | null;
    sourceProvider: string;
    sourceId: string;
    profileUrl?: string;
    ownerName?: string;
    careerStarts?: number;
    careerWins?: number;
    careerSeconds?: number;
    careerThirds?: number;
    prizeMoney?: number;
    winPercentage?: number;
    placePercentage?: number;
    profileStatsJson?: string;
    bestTimesJson?: string;
    boxHistoryJson?: string;
    distanceHistoryJson?: string;
    profileSourceRawJson?: string;
    lastProfileSyncedAt: Date;
  }
) {
  const existing = await findProfileDog(sourceProvider, sourceId, earBrand);
  if (existing) {
    return prisma.dog.update({
      where: { id: existing.id },
      data: dogData,
      select: { id: true },
    });
  }

  try {
    return await prisma.dog.create({
      data: { ...dogData, earBrand },
      select: { id: true },
    });
  } catch (err) {
    if (!isUniqueConstraintError(err)) throw err;
    const conflict = await findProfileDog(sourceProvider, sourceId, earBrand);
    if (!conflict) throw err;
    return prisma.dog.update({
      where: { id: conflict.id },
      data: dogData,
      select: { id: true },
    });
  }
}

async function findProfileDog(sourceProvider: string, sourceId: string, earBrand: string) {
  return prisma.dog.findFirst({
    where: {
      OR: [
        { sourceProvider, sourceId },
        { earBrand },
      ],
    },
    select: { id: true },
  });
}

async function ensureParentDog(
  dog: ArchivedDogLink | undefined,
  sourceProvider: string
) {
  if (!dog?.sourceId) return null;
  const earBrand = `${sourceProvider}:${dog.sourceId}`;
  const row = await prisma.dog.upsert({
    where: { earBrand },
    create: {
      name: dog.name || dog.sourceId,
      earBrand,
      sourceProvider,
      sourceId: dog.sourceId,
      profileUrl: dog.url
        ? new URL(dog.url, "https://www.thedogs.com.au").toString()
        : undefined,
    },
    update: {
      sourceProvider,
      sourceId: dog.sourceId,
      profileUrl: dog.url
        ? new URL(dog.url, "https://www.thedogs.com.au").toString()
        : undefined,
    },
    select: { id: true },
  });
  return row.id;
}

async function ensureTrainer(name: string | undefined) {
  if (!name) return null;
  const existing = await prisma.trainer.findFirst({
    where: { name },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.trainer.create({
    data: { name },
    select: { id: true },
  });
  return created.id;
}

function countsFromArchive(archive: ArchivedProfileFile): ImportCounts {
  const formRows = normalizedFormRows(archive.parsed?.formRows ?? []);
  return {
    profiles: archive.parsed ? 1 : 0,
    formRows: formRows.valid.length,
    skippedFormRows: formRows.skipped,
  };
}

function normalizedFormRows(rows: ArchivedProfileForm[]) {
  const valid: NormalizedProfileForm[] = [];
  let skipped = 0;

  for (const row of rows) {
    const raceUrl = row.raceUrl ?? row.sourceId;
    const sourceId = row.sourceId ?? row.raceUrl;
    const date = dateOrUndefined(row.date);
    if (!raceUrl || !sourceId || !date) {
      skipped += 1;
      continue;
    }
    valid.push({ ...row, sourceId, raceUrl, date });
  }

  return { valid, skipped };
}

async function readProfileArchive(
  candidate: ProfileCandidate
): Promise<ArchivedProfileFile> {
  const archive = JSON.parse(
    await readFile(candidate.profilePath, "utf8")
  ) as ArchivedProfileFile;
  if (archive.source !== "thedogs") {
    throw new Error(
      `${candidate.profilePath} has unsupported source=${String(archive.source)}`
    );
  }
  if (!archive.parsed) throw new Error(`${candidate.profilePath} is missing parsed`);
  if (!Array.isArray(archive.parsed.formRows)) {
    throw new Error(`${candidate.profilePath} is missing parsed.formRows[]`);
  }
  return archive;
}

async function findCandidates(options: Options) {
  if (options.sourceId) {
    const profilePath = profilePathFor(options.profileDir, options.sourceId);
    await assertFileExists(
      profilePath,
      `No archived dog profile exists for ${options.sourceId}`
    );
    return [{ sourceId: options.sourceId, profilePath }];
  }

  const candidates = await scanProfileArchives(options.profileDir);
  if (candidates.length === 0) {
    throw new Error(`No dog profile archive files found under ${options.profileDir}`);
  }
  return candidates;
}

function filterShard(candidates: ProfileCandidate[], options: Options) {
  if (options.shardIndex == null || options.shardCount == null) return candidates;
  const offset = options.shardIndex - 1;
  const shardCount = options.shardCount;
  return candidates.filter((_, index) => index % shardCount === offset);
}

async function filterExistingArchives(candidates: ProfileCandidate[]) {
  if (candidates.length === 0) return candidates;
  const existing = new Set<string>();
  const chunkSize = 5_000;
  for (let index = 0; index < candidates.length; index += chunkSize) {
    const sourceIds = candidates
      .slice(index, index + chunkSize)
      .map((candidate) => candidate.sourceId);
    const rows = await prisma.dogProfileArchive.findMany({
      where: {
        sourceProvider: "thedogs",
        sourceId: { in: sourceIds },
      },
      select: { sourceId: true },
    });
    for (const row of rows) existing.add(row.sourceId);
  }
  return candidates.filter((candidate) => !existing.has(candidate.sourceId));
}

async function scanProfileArchives(profileDir: string) {
  const files: ProfileCandidate[] = [];
  await collectProfileArchives(profileDir, files);
  return files.sort((a, b) => a.sourceId.localeCompare(b.sourceId));
}

async function collectProfileArchives(
  currentDir: string,
  files: ProfileCandidate[]
) {
  let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
  try {
    entries = await readdir(currentDir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
    throw err;
  }

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await collectProfileArchives(fullPath, files);
      continue;
    }
    if (!entry.isFile() || !/^\d+\.json$/i.test(entry.name)) continue;
    files.push({
      sourceId: entry.name.replace(/\.json$/i, ""),
      profilePath: fullPath,
    });
  }
}

async function readImportedSourceIds(progressFile: string) {
  const completed = new Set<string>();
  try {
    const body = await readFile(progressFile, "utf8");
    for (const line of body.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const record = JSON.parse(line) as {
        sourceId?: string;
        ok?: boolean;
        imported?: boolean;
        archived?: boolean;
        dryRun?: boolean;
      };
      if (
        record.sourceId &&
        record.ok &&
        (record.imported || record.archived) &&
        !record.dryRun
      ) {
        completed.add(record.sourceId);
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  return completed;
}

async function appendProgress(progressFile: string, record: Record<string, unknown>) {
  await mkdir(path.dirname(progressFile), { recursive: true });
  await appendFile(
    progressFile,
    `${JSON.stringify({ ...record, loggedAt: new Date().toISOString() })}\n`
  );
}

function parseOptions(args: string[]): Options {
  const values = parseFlags(args);
  const shardIndex = optionalPositiveInt(stringOption(values, "shard-index"));
  const shardCount = optionalPositiveInt(stringOption(values, "shard-count"));
  if ((shardIndex == null) !== (shardCount == null)) {
    throw new Error("--shard-index and --shard-count must be provided together");
  }
  if (shardIndex != null && shardCount != null && shardIndex > shardCount) {
    throw new Error("--shard-index must be less than or equal to --shard-count");
  }
  return {
    sourceId: stringOption(values, "source-id"),
    profileDir: stringOption(values, "profile-dir") ?? DEFAULT_PROFILE_DIR,
    progressFile: stringOption(values, "progress-file") ?? DEFAULT_PROGRESS,
    full: values.has("full"),
    limit: positiveInt(stringOption(values, "limit"), 25),
    resume: !values.has("no-resume"),
    dryRun: values.has("dry-run"),
    writeProgress: !values.has("no-progress"),
    archiveOnly: values.has("archive-only"),
    skipExistingArchive: values.has("skip-existing-archive"),
    shardIndex,
    shardCount,
    skipDbPreflight: values.has("skip-db-preflight"),
    continueOnError: values.has("continue-on-error"),
    maxErrors: positiveInt(stringOption(values, "max-errors"), 50),
    stopOnDbError: values.has("stop-on-db-error"),
    pauseMs: nonNegativeInt(stringOption(values, "pause-ms"), 0),
    retryAttempts: nonNegativeInt(stringOption(values, "retry-attempts"), 0),
    retryDelayMs: nonNegativeInt(stringOption(values, "retry-delay-ms"), 10_000),
  };
}

function parseFlags(args: string[]) {
  const values = new Map<string, string | true>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const next = args[index + 1];
    if (inlineValue != null) {
      values.set(rawKey, inlineValue);
    } else if (next && !next.startsWith("--")) {
      values.set(rawKey, next);
      index += 1;
    } else {
      values.set(rawKey, true);
    }
  }
  return values;
}

function stringOption(values: Map<string, string | true>, key: string) {
  const value = values.get(key);
  return typeof value === "string" ? value : undefined;
}

async function assertFileExists(filePath: string, message: string) {
  try {
    await access(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") throw new Error(message);
    throw err;
  }
}

function profilePathFor(profileDir: string, sourceId: string) {
  const bucket = sourceId.padStart(2, "0").slice(-2);
  return path.join(profileDir, bucket, `${sourceId}.json`);
}

function prefixedSourceId(sourceId: string | undefined, sourceProvider: string) {
  if (!sourceId) return undefined;
  return sourceId.includes(":") ? sourceId : `${sourceProvider}:${sourceId}`;
}

function dateOrUndefined(value: string | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date;
}

function isDatabaseConnectivityError(err: unknown) {
  const message = errorMessage(err);
  const name =
    typeof err === "object" && err && "name" in err && typeof err.name === "string"
      ? err.name
      : "";
  const text = `${name}\n${message}\n${String(err)}`;
  return (
    /can't reach database server/i.test(text) ||
    /timed out fetching a new connection/i.test(text) ||
    /statement timeout/i.test(text) ||
    /Transaction already closed/i.test(text) ||
    /too many clients/i.test(text) ||
    /remaining connection slots/i.test(text) ||
    /\b57014\b/i.test(text) ||
    /\bP2028\b/i.test(text) ||
    /\bEMAXCONNSESSION\b/i.test(text) ||
    /\bP1001\b/i.test(text) ||
    /\bP1002\b/i.test(text) ||
    (/PrismaClientInitializationError/i.test(text) &&
      /database server|pooler\.supabase\.com/i.test(text))
  );
}

function isUniqueConstraintError(err: unknown) {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function optionalPositiveInt(value: string | undefined) {
  if (value == null) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function nonNegativeInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main()
  .catch((err) => {
    console.error("[import:thedogs:dog-profiles:raw] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      // Preserve the import error/exit code if the client never connected.
    }
  });
