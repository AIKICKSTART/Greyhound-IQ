/**
 * Backfill VIC race replay rows from the Watchdog (GRV) public form API.
 *
 * Enumerates historical meetings via /calendar-month/{ISO}, matches them to
 * local VIC Meeting/Race rows by (meeting date, normalized track name, race
 * number), then fetches /race/{id}/detailed for each unmatched race and writes
 * a `watchdog` RaceVideo row pointing at the GRV Vision YouTube videoId.
 *
 * Replay videoIds exist from 2014-01-01 (GRV Vision launch); earlier races
 * return null and are counted, not treated as errors.
 *
 * Examples:
 *   npx tsx scripts/backfill-watchdog-race-videos.ts --from 2014-01-01 --to 2014-03-31 --dry-run
 *   npx tsx scripts/backfill-watchdog-race-videos.ts --from 2014-01-01 --to 2026-07-19
 */
import "./load-import-env";

import { randomUUID } from "node:crypto";

import { prisma } from "../src/lib/db";

const WATCHDOG_API_BASE =
  process.env.WATCHDOG_BASE_URL?.replace(/\/$/, "") ?? "https://watchdog.grv.org.au";
const FORM_API = `${WATCHDOG_API_BASE}/api/public/form`;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 20_000;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const SOURCE_PROVIDER = "watchdog";
const KIND = "replay";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type Options = {
  from: string;
  to: string;
  dryRun: boolean;
  pauseMs: number;
  meetingLimit: number;
  maxErrors: number;
};

type WatchdogMeeting = {
  id: number | string;
  trackName?: string;
  trackCode?: string;
  meetingDate?: string;
  countRaces?: number;
};

type WatchdogRace = {
  id: number | string;
  number?: number;
  videoId?: string | null;
  photoFinishUrl?: string | null;
};

type LocalRace = { id: string; raceNumber: number; hasVideo: boolean };

function parseOptions(args: string[]): Options {
  const values = new Map<string, string | true>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const [key, inline] = arg.slice(2).split("=", 2);
    const next = args[index + 1];
    if (inline != null) values.set(key, inline);
    else if (next && !next.startsWith("--")) {
      values.set(key, next);
      index += 1;
    } else values.set(key, true);
  }
  const str = (key: string) => {
    const value = values.get(key);
    return typeof value === "string" ? value : undefined;
  };
  const from = str("from") ?? "2014-01-01";
  const to = str("to") ?? new Date().toISOString().slice(0, 10);
  for (const [label, value] of [["--from", from], ["--to", to]] as const) {
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
      throw new Error(`${label} must be YYYY-MM-DD`);
    }
  }
  return {
    from,
    to,
    dryRun: values.has("dry-run"),
    pauseMs: Number.parseInt(str("pause-ms") ?? "150", 10),
    meetingLimit: Number.parseInt(str("meeting-limit") ?? "0", 10),
    maxErrors: Number.parseInt(str("max-errors") ?? "50", 10),
  };
}

function normaliseName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, " ").trim();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": USER_AGENT },
    redirect: "error",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`watchdog ${response.status} ${url}`);
  }
  const body = await response.text();
  if (body.length > MAX_RESPONSE_BYTES) {
    throw new Error(`watchdog oversized response ${url}`);
  }
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

async function enumerateMeetings(options: Options) {
  const meetings = new Map<string, WatchdogMeeting>();
  const fromMs = Date.parse(`${options.from}T00:00:00Z`);
  const toMs = Date.parse(`${options.to}T00:00:00Z`);
  // calendar-month returns a ~6 week window; step 28 days so windows overlap.
  for (let cursor = fromMs; cursor <= toMs + 27 * MS_PER_DAY; cursor += 28 * MS_PER_DAY) {
    // The endpoint requires a full ISO8601 timestamp, not a bare date.
    const iso = new Date(cursor).toISOString();
    const payload = await fetchJson<WatchdogMeeting[] | { meetings?: WatchdogMeeting[] }>(
      `${FORM_API}/calendar-month/${iso}`,
    );
    const list = Array.isArray(payload) ? payload : payload?.meetings ?? [];
    for (const meeting of list) {
      const date = meeting.meetingDate?.slice(0, 10);
      if (!meeting.id || !date) continue;
      if (date < options.from || date > options.to) continue;
      meetings.set(String(meeting.id), meeting);
    }
    await sleep(options.pauseMs);
  }
  return [...meetings.values()].sort((a, b) =>
    String(a.meetingDate).localeCompare(String(b.meetingDate)),
  );
}

async function localRacesForMeeting(meeting: WatchdogMeeting): Promise<LocalRace[]> {
  const date = meeting.meetingDate?.slice(0, 10);
  const trackName = meeting.trackName ?? "";
  if (!date || !trackName) return [];
  const rows = await prisma.$queryRaw<
    Array<{ id: string; raceNumber: number; videoCount: bigint }>
  >`
    SELECT
      r.id,
      r."raceNumber",
      COUNT(rv.id) AS "videoCount"
    FROM "Race" r
    JOIN "Meeting" m ON m.id = r."meetingId"
    JOIN "Track" t ON t.id = m."trackId"
    LEFT JOIN "RaceVideo" rv
      ON rv."raceId" = r.id AND rv."sourceProvider" = ${SOURCE_PROVIDER} AND rv.kind = ${KIND}
    WHERE t.state = 'VIC'
      AND m."meetingDate" = ${new Date(`${date}T00:00:00Z`)}
      AND LOWER(REGEXP_REPLACE(t.name, '[^a-zA-Z0-9]+', ' ', 'g')) = ${normaliseName(trackName)}
    GROUP BY r.id, r."raceNumber"
  `;
  return rows.map((row) => ({
    id: row.id,
    raceNumber: row.raceNumber,
    hasVideo: Number(row.videoCount) > 0,
  }));
}

async function writeWatchdogVideo(
  raceId: string,
  videoId: string,
  watchdogRaceId: string,
  photoFinishUrl: string | null,
) {
  const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
  // Azure blob paths contain literal spaces; encode so the stored URL fetches.
  const encodedPhotoFinish = photoFinishUrl ? encodeURI(photoFinishUrl) : null;
  const now = new Date();
  // FORCE RLS on RaceVideo requires giq_is_system(); claim it in the same
  // transaction as the write so pool recycling cannot drop the claim.
  await prisma.$transaction([
    prisma.$executeRawUnsafe("SELECT set_config('app.system', 'true', true)"),
    prisma.$executeRaw`
      INSERT INTO "RaceVideo" (
        "id", "raceId", "sourceProvider", "sourceId", "kind", "pageUrl",
        "embedSourceType", "sourceStatus", "streamUrl",
        "sourceRawJson", "fetchedAt", "lastSyncedAt", "createdAt", "updatedAt"
      )
      VALUES (
        ${randomUUID()}, ${raceId}, ${SOURCE_PROVIDER}, ${videoId}, ${KIND}, ${pageUrl},
        'youtube', 200, NULL,
        ${JSON.stringify({ watchdogRaceId, videoId })}, ${now}, ${now}, NOW(), NOW()
      )
      ON CONFLICT ("raceId", "sourceProvider", "kind") DO UPDATE SET
        "sourceId" = EXCLUDED."sourceId",
        "pageUrl" = EXCLUDED."pageUrl",
        "streamUrl" = NULL,
        "sourceRawJson" = EXCLUDED."sourceRawJson",
        "fetchedAt" = EXCLUDED."fetchedAt",
        "lastSyncedAt" = EXCLUDED."lastSyncedAt",
        "updatedAt" = NOW()
    `,
    prisma.$executeRaw`
      UPDATE "Race" SET
        "replayUrl" = COALESCE("replayUrl", ${pageUrl}),
        "photoFinishUrl" = COALESCE("photoFinishUrl", ${encodedPhotoFinish})
      WHERE id = ${raceId}
        AND ("replayUrl" IS NULL OR ("photoFinishUrl" IS NULL AND ${encodedPhotoFinish}::text IS NOT NULL))
    `,
  ]);
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const summary = {
    from: options.from,
    to: options.to,
    dryRun: options.dryRun,
    meetingsSeen: 0,
    meetingsMatched: 0,
    meetingsUnmatched: 0,
    racesConsidered: 0,
    racesAlreadyCovered: 0,
    racesNumberMismatch: 0,
    videosWritten: 0,
    nullVideoIds: 0,
    errors: 0,
  };

  const meetings = await enumerateMeetings(options);
  summary.meetingsSeen = meetings.length;
  const limited = options.meetingLimit > 0 ? meetings.slice(0, options.meetingLimit) : meetings;

  for (const meeting of limited) {
    try {
      const localRaces = await localRacesForMeeting(meeting);
      if (localRaces.length === 0) {
        summary.meetingsUnmatched += 1;
        continue;
      }
      summary.meetingsMatched += 1;
      const pending = new Map(
        localRaces.filter((race) => !race.hasVideo).map((race) => [race.raceNumber, race]),
      );
      summary.racesConsidered += localRaces.length;
      summary.racesAlreadyCovered += localRaces.length - pending.size;
      if (pending.size === 0) continue;

      const detail = await fetchJson<{ races?: WatchdogRace[] } | WatchdogRace[]>(
        `${FORM_API}/meeting/${meeting.id}`,
      );
      const races = Array.isArray(detail) ? detail : detail?.races ?? [];
      for (const race of races) {
        const local = race.number != null ? pending.get(race.number) : undefined;
        if (!local) continue;
        let videoId = race.videoId ?? null;
        let photoFinishUrl = race.photoFinishUrl ?? null;
        if (!videoId) {
          const raceDetail = await fetchJson<{ races?: WatchdogRace[] }>(
            `${FORM_API}/race/${race.id}/detailed`,
          );
          videoId = raceDetail?.races?.[0]?.videoId ?? null;
          photoFinishUrl = raceDetail?.races?.[0]?.photoFinishUrl ?? photoFinishUrl;
          await sleep(options.pauseMs);
        }
        if (!videoId) {
          summary.nullVideoIds += 1;
          continue;
        }
        if (!options.dryRun) {
          await writeWatchdogVideo(local.id, videoId, String(race.id), photoFinishUrl);
        }
        summary.videosWritten += 1;
      }
      await sleep(options.pauseMs);
    } catch (error) {
      summary.errors += 1;
      console.error(
        `[watchdog-videos] meeting ${meeting.id} (${meeting.meetingDate} ${meeting.trackName}) failed:`,
        error instanceof Error ? error.message : error,
      );
      if (summary.errors >= options.maxErrors) {
        console.error("[watchdog-videos] max errors reached; stopping");
        break;
      }
      await sleep(Math.max(options.pauseMs * 4, 1_000));
    }
  }

  console.log(JSON.stringify(summary));
  if (summary.errors >= options.maxErrors) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("[watchdog-videos] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
