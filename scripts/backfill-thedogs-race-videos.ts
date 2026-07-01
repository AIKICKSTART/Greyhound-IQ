/**
 * Audit and backfill The Dogs race replay video source metadata.
 *
 * Examples:
 *   npm run audit:thedogs:race-videos
 *   npm run backfill:thedogs:race-videos -- --limit 25
 *   npm run backfill:thedogs:race-videos -- --full --concurrency 4 --pause-ms 100
 */
import "./load-import-env";

import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";

import { prisma } from "../src/lib/db";

const THEDOGS_BASE = process.env.THEDOGS_BASE_URL ?? "https://www.thedogs.com.au";
const THEDOGS_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const DEFAULT_PROGRESS = ".backfill/thedogs-race-video-progress.jsonl";
const DEFAULT_KIND = "replay";
const DEFAULT_SOURCE_TYPE = "race-replay";
const SUPPORTED_RACE_REPLAY_PATH_PATTERN = "/videos/watch/races/[0-9]+/replay";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type Options = {
  from: string;
  to: string;
  sourceProvider: string;
  kind: string;
  embedSourceType: string;
  limit: number;
  full: boolean;
  auditOnly: boolean;
  dryRun: boolean;
  onlyMissing: boolean;
  resume: boolean;
  progressFile: string;
  concurrency: number;
  pauseMs: number;
  timeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
  continueOnError: boolean;
  maxErrors: number;
  compact: boolean;
  shardIndex?: number;
  shardCount?: number;
};

type RaceCandidate = {
  id: string;
  sourceId: string | null;
  replayUrl: string | null;
  raceTime: Date;
  raceNumber: number;
  name: string | null;
  trackName: string;
  state: string;
};

type VideoCandidate = RaceCandidate & {
  videoSourceId: string;
  pageUrl: string;
};

type VideoSourceResponse = {
  meta?: {
    status?: number;
    code?: string;
    message?: string;
  };
  video?: {
    src?: string;
    title?: string;
    description?: string;
    preroll?: unknown;
  };
};

type ProgressRecord = {
  raceId?: string;
  videoSourceId?: string;
  ok?: boolean;
  dryRun?: boolean;
  skipped?: boolean;
  streamUrl?: string | null;
  status?: number | null;
  code?: string | null;
  loggedAt?: string;
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const audit = await auditRaceVideos(options);

  if (options.auditOnly) {
    console.log(json(audit, options.compact));
    return;
  }

  const candidates = await findVideoCandidates(options);
  const completed = options.resume
    ? await readCompletedVideoKeys(options.progressFile)
    : new Set<string>();
  const selected = candidates.filter(
    (candidate) => !completed.has(progressKey(candidate))
  );

  const summary = {
    ...audit,
    backfill: {
      progressFile: options.progressFile,
      dryRun: options.dryRun,
      onlyMissing: options.onlyMissing,
      full: options.full,
      limit: options.limit,
      concurrency: options.concurrency,
      pauseMs: options.pauseMs,
      retryAttempts: options.retryAttempts,
      selectedCandidates: selected.length,
      skippedFromProgress: candidates.length - selected.length,
      shardIndex: options.shardIndex ?? null,
      shardCount: options.shardCount ?? null,
    },
  };
  console.log(json(summary, options.compact));

  const result = await processCandidates(selected, options);
  console.log(json({ finishedAt: new Date().toISOString(), ...result }, options.compact));
  if (result.failed > 0) process.exitCode = 1;
}

async function auditRaceVideos(options: Options) {
  const [totals] = await queryTotalStats(options);
  const [sampleMissingReplay, sampleMissingVideoSource, sampleUnsupportedReplayUrl, yearly] =
    await Promise.all([
      querySampleRaces(options, "missing-replay"),
      querySampleRaces(options, "missing-video-source"),
      querySampleRaces(options, "unsupported-replay-url"),
      queryYearlyStats(options),
    ]);
  const totalRaces = Number(totals?.races ?? 0);
  const racesWithReplay = Number(totals?.withReplay ?? 0);
  const supportedRaceReplayRows = Number(totals?.supportedRaceReplayRows ?? 0);
  const unsupportedReplayRows = Number(totals?.unsupportedReplayRows ?? 0);
  const existingVideoRows = Number(totals?.videoRows ?? 0);
  const videosWithStream = Number(totals?.withStream ?? 0);
  const missingVideoSourceRows = Number(totals?.missingVideoSourceRows ?? 0);
  const missingSupportedVideoSourceRows = Number(
    totals?.missingSupportedVideoSourceRows ?? 0
  );

  return {
    generatedAt: new Date().toISOString(),
    rangeFrom: options.from,
    rangeTo: options.to,
    sourceProvider: options.sourceProvider,
    kind: options.kind,
    races: totalRaces,
    racesWithReplay,
    racesWithoutReplay: Math.max(totalRaces - racesWithReplay, 0),
    supportedRaceReplayRows,
    unsupportedReplayRows,
    videoRows: existingVideoRows,
    videosWithStream,
    missingVideoSourceRows,
    missingSupportedVideoSourceRows,
    rates: {
      replay: ratio(racesWithReplay, totalRaces),
      videoSource: ratio(existingVideoRows, racesWithReplay),
      supportedVideoSource: ratio(existingVideoRows, supportedRaceReplayRows),
      stream: ratio(videosWithStream, racesWithReplay),
      supportedStream: ratio(videosWithStream, supportedRaceReplayRows),
    },
    yearly,
    sampleMissingReplay: sampleMissingReplay.map(summarizeRace),
    sampleMissingVideoSource: sampleMissingVideoSource.map(summarizeRace),
    sampleUnsupportedReplayUrl: sampleUnsupportedReplayUrl.map(summarizeRace),
  };
}

async function findVideoCandidates(options: Options): Promise<VideoCandidate[]> {
  const queryLimit =
    options.full || options.shardIndex != null
      ? Prisma.empty
      : Prisma.sql`LIMIT ${options.limit}`;
  const missingFilter = options.onlyMissing
    ? Prisma.sql`AND v."id" IS NULL`
    : Prisma.empty;
  const races = await prisma.$queryRaw<RaceCandidate[]>`
    SELECT
      r."id",
      r."sourceId",
      r."replayUrl",
      r."raceTime",
      r."raceNumber",
      r."name",
      t."name" AS "trackName",
      t."state"
    FROM "Race" r
    JOIN "Meeting" m ON m."id" = r."meetingId"
    JOIN "Track" t ON t."id" = m."trackId"
    LEFT JOIN "RaceVideo" v
      ON v."raceId" = r."id"
      AND v."sourceProvider" = ${options.sourceProvider}
      AND v."kind" = ${options.kind}
    WHERE r."sourceProvider" = ${options.sourceProvider}
      AND r."raceTime" >= ${startOfDay(options.from)}
      AND r."raceTime" <= ${endOfDay(options.to)}
      AND r."replayUrl" IS NOT NULL
      AND r."replayUrl" ~ ${SUPPORTED_RACE_REPLAY_PATH_PATTERN}
      ${missingFilter}
    ORDER BY r."raceTime" ASC, r."raceNumber" ASC
    ${queryLimit}
  `;

  const candidates = races
    .filter((race) => belongsToShard(race.id, options))
    .map((race) => {
      const videoSourceId = extractVideoSourceId(race.replayUrl ?? "");
      if (!videoSourceId) return null;
      return {
        ...race,
        videoSourceId,
        pageUrl: absoluteUrl(race.replayUrl ?? ""),
      };
    })
    .filter((race): race is VideoCandidate => race != null);

  return options.full ? candidates : candidates.slice(0, options.limit);
}

async function processCandidates(candidates: VideoCandidate[], options: Options) {
  const counts = {
    selected: candidates.length,
    ok: 0,
    withStream: 0,
    withoutStream: 0,
    failed: 0,
  };
  let nextIndex = 0;
  let shouldStop = false;

  const workers = Array.from(
    { length: Math.max(1, options.concurrency) },
    async () => {
      for (;;) {
        if (shouldStop) return;
        const index = nextIndex;
        nextIndex += 1;
        if (index >= candidates.length) return;
        const candidate = candidates[index];
        try {
          const source = await fetchVideoSourceWithRetries(candidate, options);
          if (!options.dryRun) await upsertRaceVideo(candidate, source, options);

          counts.ok += 1;
          if (source.video?.src) counts.withStream += 1;
          else counts.withoutStream += 1;

          await appendProgress(options.progressFile, {
            raceId: candidate.id,
            videoSourceId: candidate.videoSourceId,
            ok: true,
            dryRun: options.dryRun,
            streamUrl: source.video?.src ?? null,
            status: source.meta?.status ?? null,
            code: source.meta?.code ?? null,
          });
        } catch (err) {
          counts.failed += 1;
          await appendProgress(options.progressFile, {
            raceId: candidate.id,
            videoSourceId: candidate.videoSourceId,
            ok: false,
            dryRun: options.dryRun,
            status: null,
            code: null,
            error: errorMessage(err),
          });
          console.error(
            `[race-videos] ${candidate.videoSourceId} failed: ${errorMessage(err)}`
          );
          if (!options.continueOnError || counts.failed >= options.maxErrors) {
            shouldStop = true;
          }
        }

        if (options.pauseMs > 0) await sleep(options.pauseMs);
      }
    }
  );

  await Promise.all(workers);
  return counts;
}

async function fetchVideoSourceWithRetries(
  candidate: VideoCandidate,
  options: Options
) {
  const maxAttempts = options.retryAttempts + 1;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fetchVideoSource(candidate, options);
    } catch (err) {
      lastError = err;
      if (attempt >= maxAttempts) break;
      if (options.retryDelayMs > 0) await sleep(options.retryDelayMs);
    }
  }
  throw lastError;
}

async function fetchVideoSource(candidate: VideoCandidate, options: Options) {
  const apiUrl = new URL(
    `/api/videos/player/source/${options.embedSourceType}/${candidate.videoSourceId}`,
    THEDOGS_BASE
  );
  const response = await fetch(apiUrl, {
    signal: AbortSignal.timeout(options.timeoutMs),
    headers: {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.9",
      origin: THEDOGS_BASE,
      referer: candidate.pageUrl,
      "user-agent": THEDOGS_USER_AGENT,
      "x-requested-with": "XMLHttpRequest",
    },
  });
  const body = await response.text();
  const parsed = parseJson<VideoSourceResponse>(body);
  if (!parsed) {
    throw new Error(`Non-JSON response ${response.status}: ${body.slice(0, 200)}`);
  }
  return {
    ...parsed,
    meta: {
      ...parsed.meta,
      status: parsed.meta?.status ?? response.status,
    },
  };
}

async function upsertRaceVideo(
  candidate: VideoCandidate,
  source: VideoSourceResponse,
  options: Options
) {
  const now = new Date();
  const streamUrl = source.video?.src ?? null;
  const data = {
    raceId: candidate.id,
    pageUrl: candidate.pageUrl,
    embedSourceType: options.embedSourceType,
    sourceStatus: source.meta?.status ?? null,
    sourceCode: source.meta?.code ?? null,
    streamUrl,
    streamContentType: streamContentType(streamUrl),
    title: cleanHtml(source.video?.title),
    description: cleanHtml(source.video?.description),
    sourceRawJson: JSON.stringify(source),
    fetchedAt: now,
    lastSyncedAt: now,
  };

  await prisma.$executeRaw`
    INSERT INTO "RaceVideo" (
      "id",
      "raceId",
      "sourceProvider",
      "sourceId",
      "kind",
      "pageUrl",
      "embedSourceType",
      "sourceStatus",
      "sourceCode",
      "streamUrl",
      "streamContentType",
      "title",
      "description",
      "sourceRawJson",
      "fetchedAt",
      "lastSyncedAt",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      ${data.raceId},
      ${options.sourceProvider},
      ${candidate.videoSourceId},
      ${options.kind},
      ${data.pageUrl},
      ${data.embedSourceType},
      ${data.sourceStatus},
      ${data.sourceCode},
      ${data.streamUrl},
      ${data.streamContentType},
      ${data.title},
      ${data.description},
      ${data.sourceRawJson},
      ${data.fetchedAt},
      ${data.lastSyncedAt},
      NOW(),
      NOW()
    )
    ON CONFLICT ("raceId", "sourceProvider", "kind") DO UPDATE SET
      "sourceId" = EXCLUDED."sourceId",
      "pageUrl" = EXCLUDED."pageUrl",
      "embedSourceType" = EXCLUDED."embedSourceType",
      "sourceStatus" = EXCLUDED."sourceStatus",
      "sourceCode" = EXCLUDED."sourceCode",
      "streamUrl" = EXCLUDED."streamUrl",
      "streamContentType" = EXCLUDED."streamContentType",
      "title" = EXCLUDED."title",
      "description" = EXCLUDED."description",
      "sourceRawJson" = EXCLUDED."sourceRawJson",
      "fetchedAt" = EXCLUDED."fetchedAt",
      "lastSyncedAt" = EXCLUDED."lastSyncedAt",
      "updatedAt" = NOW()
  `;
}

async function queryTotalStats(options: Options) {
  return prisma.$queryRaw<
    Array<{
      races: bigint;
      withReplay: bigint;
      supportedRaceReplayRows: bigint;
      unsupportedReplayRows: bigint;
      videoRows: bigint;
      withStream: bigint;
      missingVideoSourceRows: bigint;
      missingSupportedVideoSourceRows: bigint;
    }>
  >`
    SELECT
      COUNT(*)::bigint AS "races",
      COUNT(*) FILTER (WHERE r."replayUrl" IS NOT NULL)::bigint AS "withReplay",
      COUNT(*) FILTER (
        WHERE r."replayUrl" ~ ${SUPPORTED_RACE_REPLAY_PATH_PATTERN}
      )::bigint AS "supportedRaceReplayRows",
      COUNT(*) FILTER (
        WHERE r."replayUrl" IS NOT NULL
          AND r."replayUrl" !~ ${SUPPORTED_RACE_REPLAY_PATH_PATTERN}
      )::bigint AS "unsupportedReplayRows",
      COUNT(v."id")::bigint AS "videoRows",
      COUNT(v."id") FILTER (WHERE v."streamUrl" IS NOT NULL)::bigint AS "withStream",
      COUNT(*) FILTER (WHERE r."replayUrl" IS NOT NULL AND v."id" IS NULL)::bigint
        AS "missingVideoSourceRows",
      COUNT(*) FILTER (
        WHERE r."replayUrl" ~ ${SUPPORTED_RACE_REPLAY_PATH_PATTERN}
          AND v."id" IS NULL
      )::bigint AS "missingSupportedVideoSourceRows"
    FROM "Race" r
    LEFT JOIN "RaceVideo" v
      ON v."raceId" = r."id"
      AND v."sourceProvider" = ${options.sourceProvider}
      AND v."kind" = ${options.kind}
    WHERE r."sourceProvider" = ${options.sourceProvider}
      AND r."raceTime" >= ${startOfDay(options.from)}
      AND r."raceTime" <= ${endOfDay(options.to)}
  `;
}

async function querySampleRaces(
  options: Options,
  sampleKind: "missing-replay" | "missing-video-source" | "unsupported-replay-url"
) {
  const filter =
    sampleKind === "missing-replay"
      ? Prisma.sql`AND r."replayUrl" IS NULL`
      : sampleKind === "missing-video-source"
        ? Prisma.sql`
          AND r."replayUrl" ~ ${SUPPORTED_RACE_REPLAY_PATH_PATTERN}
          AND v."id" IS NULL
        `
        : Prisma.sql`
          AND r."replayUrl" IS NOT NULL
          AND r."replayUrl" !~ ${SUPPORTED_RACE_REPLAY_PATH_PATTERN}
        `;

  return prisma.$queryRaw<RaceCandidate[]>`
    SELECT
      r."id",
      r."sourceId",
      r."replayUrl",
      r."raceTime",
      r."raceNumber",
      r."name",
      t."name" AS "trackName",
      t."state"
    FROM "Race" r
    JOIN "Meeting" m ON m."id" = r."meetingId"
    JOIN "Track" t ON t."id" = m."trackId"
    LEFT JOIN "RaceVideo" v
      ON v."raceId" = r."id"
      AND v."sourceProvider" = ${options.sourceProvider}
      AND v."kind" = ${options.kind}
    WHERE r."sourceProvider" = ${options.sourceProvider}
      AND r."raceTime" >= ${startOfDay(options.from)}
      AND r."raceTime" <= ${endOfDay(options.to)}
      ${filter}
    ORDER BY r."raceTime" DESC, r."raceNumber" DESC
    LIMIT 10
  `;
}

async function queryYearlyStats(options: Options) {
  const fromDate = startOfDay(options.from);
  const toDate = endOfDay(options.to);
  const rows = await prisma.$queryRaw<
    Array<{
      year: number;
      races: bigint;
      withReplay: bigint;
      supportedRaceReplayRows: bigint;
      unsupportedReplayRows: bigint;
      videoRows: bigint;
      withStream: bigint;
      missingSupportedVideoSourceRows: bigint;
    }>
  >`
    SELECT
      EXTRACT(YEAR FROM r."raceTime")::int AS "year",
      COUNT(*)::bigint AS "races",
      COUNT(*) FILTER (WHERE r."replayUrl" IS NOT NULL)::bigint AS "withReplay",
      COUNT(*) FILTER (
        WHERE r."replayUrl" ~ ${SUPPORTED_RACE_REPLAY_PATH_PATTERN}
      )::bigint AS "supportedRaceReplayRows",
      COUNT(*) FILTER (
        WHERE r."replayUrl" IS NOT NULL
          AND r."replayUrl" !~ ${SUPPORTED_RACE_REPLAY_PATH_PATTERN}
      )::bigint AS "unsupportedReplayRows",
      COUNT(v."id")::bigint AS "videoRows",
      COUNT(v."id") FILTER (WHERE v."streamUrl" IS NOT NULL)::bigint AS "withStream",
      COUNT(*) FILTER (
        WHERE r."replayUrl" ~ ${SUPPORTED_RACE_REPLAY_PATH_PATTERN}
          AND v."id" IS NULL
      )::bigint AS "missingSupportedVideoSourceRows"
    FROM "Race" r
    LEFT JOIN "RaceVideo" v
      ON v."raceId" = r."id"
      AND v."sourceProvider" = ${options.sourceProvider}
      AND v."kind" = ${options.kind}
    WHERE r."sourceProvider" = ${options.sourceProvider}
      AND r."raceTime" >= ${fromDate}
      AND r."raceTime" <= ${toDate}
    GROUP BY 1
    ORDER BY 1
  `;

  return rows.map((row) => ({
    year: row.year,
    races: Number(row.races),
    withReplay: Number(row.withReplay),
    supportedRaceReplayRows: Number(row.supportedRaceReplayRows),
    unsupportedReplayRows: Number(row.unsupportedReplayRows),
    videoRows: Number(row.videoRows),
    withStream: Number(row.withStream),
    missingSupportedVideoSourceRows: Number(row.missingSupportedVideoSourceRows),
    rates: {
      replay: ratio(Number(row.withReplay), Number(row.races)),
      videoSource: ratio(Number(row.videoRows), Number(row.withReplay)),
      supportedVideoSource: ratio(
        Number(row.videoRows),
        Number(row.supportedRaceReplayRows)
      ),
      stream: ratio(Number(row.withStream), Number(row.withReplay)),
      supportedStream: ratio(
        Number(row.withStream),
        Number(row.supportedRaceReplayRows)
      ),
    },
  }));
}

function parseOptions(args: string[]): Options {
  const values = parseFlags(args);
  const from = stringOption(values, "from") ?? defaultFromDate();
  const to = stringOption(values, "to") ?? formatSydneyDate(new Date());
  assertDate(from, "--from");
  assertDate(to, "--to");
  if (dayValue(from) > dayValue(to)) {
    throw new Error("--from must be before or equal to --to");
  }

  const shardIndex = optionalPositiveInt(stringOption(values, "shard-index"));
  const shardCount = optionalPositiveInt(stringOption(values, "shard-count"));
  if ((shardIndex == null) !== (shardCount == null)) {
    throw new Error("--shard-index and --shard-count must be provided together");
  }
  if (shardIndex != null && shardCount != null && shardIndex > shardCount) {
    throw new Error("--shard-index must be less than or equal to --shard-count");
  }

  return {
    from,
    to,
    sourceProvider: stringOption(values, "source-provider") ?? "thedogs",
    kind: stringOption(values, "kind") ?? DEFAULT_KIND,
    embedSourceType: stringOption(values, "embed-source-type") ?? DEFAULT_SOURCE_TYPE,
    limit: positiveInt(stringOption(values, "limit"), 100),
    full: values.has("full"),
    auditOnly: values.has("audit-only"),
    dryRun: values.has("dry-run"),
    onlyMissing: !values.has("refresh"),
    resume: !values.has("no-resume"),
    progressFile: stringOption(values, "progress-file") ?? DEFAULT_PROGRESS,
    concurrency: positiveInt(stringOption(values, "concurrency"), 2),
    pauseMs: nonNegativeInt(stringOption(values, "pause-ms"), 250),
    timeoutMs: positiveInt(stringOption(values, "timeout-ms"), 30_000),
    retryAttempts: nonNegativeInt(stringOption(values, "retry-attempts"), 2),
    retryDelayMs: nonNegativeInt(stringOption(values, "retry-delay-ms"), 1_000),
    continueOnError: values.has("continue-on-error"),
    maxErrors: positiveInt(stringOption(values, "max-errors"), 25),
    compact: values.has("compact"),
    shardIndex,
    shardCount,
  };
}

function summarizeRace(race: RaceCandidate) {
  return {
    id: race.id,
    sourceId: race.sourceId,
    trackName: race.trackName,
    state: race.state,
    raceNumber: race.raceNumber,
    name: race.name,
    raceTime: race.raceTime.toISOString(),
    replayUrl: race.replayUrl,
  };
}

async function readCompletedVideoKeys(progressFile: string) {
  const completed = new Set<string>();
  try {
    const body = await readFile(progressFile, "utf8");
    for (const line of body.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const record = parseJson<ProgressRecord>(line);
      if (record?.ok && record.raceId && record.videoSourceId) {
        completed.add(`${record.raceId}:${record.videoSourceId}`);
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  return completed;
}

function progressKey(candidate: VideoCandidate) {
  return `${candidate.id}:${candidate.videoSourceId}`;
}

async function appendProgress(
  progressFile: string,
  record: Record<string, unknown>
) {
  await mkdir(path.dirname(progressFile), { recursive: true });
  await appendFile(
    progressFile,
    `${JSON.stringify({ ...record, loggedAt: new Date().toISOString() })}\n`
  );
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

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function optionalPositiveInt(value: string | undefined) {
  if (value == null) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, got ${value}`);
  }
  return parsed;
}

function assertDate(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
}

function extractVideoSourceId(replayUrl: string) {
  return replayUrl.match(/\/videos\/watch\/races\/(\d+)\/replay\b/i)?.[1];
}

function absoluteUrl(value: string) {
  return new URL(value, THEDOGS_BASE).toString();
}

function streamContentType(value: string | null | undefined) {
  if (!value) return null;
  const pathname = new URL(value).pathname.toLowerCase();
  if (pathname.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (pathname.endsWith(".mp4")) return "video/mp4";
  return null;
}

function belongsToShard(id: string, options: Options) {
  if (options.shardIndex == null || options.shardCount == null) return true;
  return shardIndexFor(id, options.shardCount) === options.shardIndex;
}

function shardIndexFor(value: string, shardCount: number) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return (hash % shardCount) + 1;
}

function cleanHtml(value = "") {
  return decodeEntities(
    value
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  ) || null;
}

function decodeEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCharCode(Number.parseInt(code, 16))
    )
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number.parseInt(code, 10))
    )
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'");
}

function parseJson<T>(value: string) {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function defaultFromDate() {
  const today = formatSydneyDate(new Date());
  const [year, month, day] = today.split("-").map(Number);
  return `${year - 5}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatSydneyDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function startOfDay(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function endOfDay(date: string) {
  return new Date(dayValue(date) + MS_PER_DAY - 1);
}

function dayValue(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function ratio(value: number, total: number) {
  return total > 0 ? Number((value / total).toFixed(4)) : 0;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function json(value: unknown, compact: boolean) {
  return JSON.stringify(
    value,
    (_key, item) => (typeof item === "bigint" ? Number(item) : item),
    compact ? 0 : 2
  );
}

main()
  .catch((err) => {
    console.error("[race-videos] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
