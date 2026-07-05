/**
 * Audit and backfill public race replay rows across supported states.
 *
 * Examples:
 *   npm run audit:race-videos -- --from 2026-07-01 --to 2026-07-05 --compact
 *   npm run backfill:race-videos -- --from 2026-07-01 --to 2026-07-05 --state QLD,TAS,WA --dry-run
 */
import "./load-import-env";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

import { prisma } from "../src/lib/db";
import {
  parseGreyhoundsWaVimeoVideos,
  parseTheDogsReplayCards,
  resolveRaceVideoReplay,
  resolveRacingQueenslandReplay,
  streamContentType,
  tasracingStreamUrl,
} from "../src/lib/live/race-replay";
import { absoluteTheDogsUrl } from "../src/lib/live/thedogs-replay";

const DEFAULT_KIND = "replay";
const THEDOGS_REPLAYS_URL =
  process.env.THEDOGS_REPLAYS_URL ?? "https://www.thedogs.com.au/videos/replays";
const RACING_QUEENSLAND_BASE =
  process.env.RACING_QUEENSLAND_BASE_URL ??
  "https://www.racingqueensland.com.au";
const TASRACING_EVENT_API =
  process.env.TASRACING_EVENT_REPLAY_API ??
  "https://test.tasracing.com.au/wp-json/event_replay/list";
const TASRACING_RACE_API =
  process.env.TASRACING_RACE_REPLAY_API ??
  "https://test.tasracing.com.au/wp-json/race_replay/list";
const GREYHOUNDS_WA_SHOWCASE_BASE =
  process.env.GREYHOUNDS_WA_SHOWCASE_BASE ?? "https://vimeo.com/showcase";
const FETCH_TIMEOUT_MS = 20_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PUBLIC_PROVIDERS = [
  "thedogs",
  "racing-queensland",
  "tasracing",
  "greyhoundswa",
  "sa-race-replay",
];

type Options = {
  from: string;
  to: string;
  states: string[];
  providers: string[];
  limit: number;
  full: boolean;
  auditOnly: boolean;
  dryRun: boolean;
  onlyMissing: boolean;
  compact: boolean;
};

type RaceRow = {
  id: string;
  raceTime: Date;
  meetingDate: Date;
  raceNumber: number;
  name: string | null;
  trackName: string;
  state: string;
};

type RaceVideoRow = RaceRow & {
  sourceProvider: string;
  sourceId: string;
  kind: string;
  pageUrl: string;
  embedSourceType: string | null;
  streamUrl: string | null;
  streamContentType: string | null;
  title: string | null;
  description: string | null;
  sourceStatus: number | null;
  sourceCode: string | null;
};

type RaceVideoWrite = {
  raceId: string;
  sourceProvider: string;
  sourceId: string;
  kind?: string;
  pageUrl: string;
  embedSourceType: string | null;
  sourceStatus: number | null;
  sourceCode: string | null;
  streamUrl: string | null;
  streamContentType: string | null;
  title: string | null;
  description: string | null;
  sourceRawJson: string | null;
};

type BackfillSummary = {
  provider: string;
  selected: number;
  resolved: number;
  written: number;
  skipped: number;
  errors: number;
  notes: string[];
};

type TasEvent = {
  title?: string;
  category?: string;
  venue?: string;
  meeting_code?: string;
  meeting_date_format?: string;
  trial?: boolean;
};

type TasRace = {
  race_name?: string;
  race_number?: number;
  race_code?: string;
  angles?: Record<string, TasAngle> | TasAngle[];
};

type TasAngle = {
  name?: string;
  stream?: string;
  angle?: string;
  login?: boolean;
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const auditBefore = await auditRaceVideos(options);

  if (options.auditOnly) {
    console.log(json(auditBefore, options.compact));
    return;
  }

  const backfill: BackfillSummary[] = [];
  if (providerEnabled(options, "thedogs")) {
    backfill.push(await backfillTheDogs(options));
  }
  if (providerEnabled(options, "racing-queensland") && stateEnabled(options, "QLD")) {
    backfill.push(await backfillRacingQueensland(options));
  }
  if (providerEnabled(options, "tasracing") && stateEnabled(options, "TAS")) {
    backfill.push(await backfillTasracing(options));
  }
  if (providerEnabled(options, "greyhoundswa") && stateEnabled(options, "WA")) {
    backfill.push(await backfillGreyhoundsWa(options));
  }
  if (providerEnabled(options, "sa-race-replay") && stateEnabled(options, "SA")) {
    backfill.push(await backfillSaRaceReplayYoutube(options));
  }

  const auditAfter = await auditRaceVideos(options);
  console.log(
    json(
      {
        generatedAt: new Date().toISOString(),
        dryRun: options.dryRun,
        rangeFrom: options.from,
        rangeTo: options.to,
        states: options.states.length ? options.states : "all",
        providers: options.providers.length ? options.providers : PUBLIC_PROVIDERS,
        auditBefore,
        backfill,
        auditAfter,
      },
      options.compact
    )
  );
}

async function auditRaceVideos(options: Options) {
  const stateRows = await prisma.$queryRaw<
    Array<{
      state: string;
      races: bigint;
      videoRows: bigint;
      streamRows: bigint;
      replayAvailableRows: bigint;
    }>
  >`
    SELECT
      t."state",
      COUNT(DISTINCT r."id")::bigint AS "races",
      COUNT(rv."id")::bigint AS "videoRows",
      COUNT(DISTINCT r."id") FILTER (WHERE rv."streamUrl" IS NOT NULL)::bigint AS "streamRows",
      COUNT(DISTINCT r."id") FILTER (
        WHERE rv."streamUrl" IS NOT NULL
          OR rv."pageUrl" IS NOT NULL
          OR rv."sourceId" IS NOT NULL
      )::bigint AS "replayAvailableRows"
    FROM "Race" r
    JOIN "Meeting" m ON m."id" = r."meetingId"
    JOIN "Track" t ON t."id" = m."trackId"
    LEFT JOIN "RaceVideo" rv ON rv."raceId" = r."id"
    WHERE r."raceTime" >= ${startOfDay(options.from)}
      AND r."raceTime" <= ${endOfDay(options.to)}
      ${stateSql(options)}
    GROUP BY t."state"
    ORDER BY t."state"
  `;

  const providerRows = await prisma.$queryRaw<
    Array<{
      state: string;
      sourceProvider: string | null;
      videoRows: bigint;
      streamRows: bigint;
      replayAvailableRows: bigint;
    }>
  >`
    SELECT
      t."state",
      rv."sourceProvider" AS "sourceProvider",
      COUNT(rv."id")::bigint AS "videoRows",
      COUNT(rv."id") FILTER (WHERE rv."streamUrl" IS NOT NULL)::bigint AS "streamRows",
      COUNT(rv."id") FILTER (
        WHERE rv."streamUrl" IS NOT NULL
          OR rv."pageUrl" IS NOT NULL
          OR rv."sourceId" IS NOT NULL
      )::bigint AS "replayAvailableRows"
    FROM "Race" r
    JOIN "Meeting" m ON m."id" = r."meetingId"
    JOIN "Track" t ON t."id" = m."trackId"
    LEFT JOIN "RaceVideo" rv ON rv."raceId" = r."id"
    WHERE r."raceTime" >= ${startOfDay(options.from)}
      AND r."raceTime" <= ${endOfDay(options.to)}
      ${stateSql(options)}
    GROUP BY t."state", rv."sourceProvider"
    ORDER BY t."state", rv."sourceProvider"
  `;

  return {
    generatedAt: new Date().toISOString(),
    rangeFrom: options.from,
    rangeTo: options.to,
    perState: stateRows.map((row) => ({
      state: row.state,
      races: Number(row.races),
      videoRows: Number(row.videoRows),
      streamRows: Number(row.streamRows),
      replayAvailableRows: Number(row.replayAvailableRows),
      replayAvailabilityRate: ratio(
        Number(row.replayAvailableRows),
        Number(row.races)
      ),
      streamRate: ratio(Number(row.streamRows), Number(row.races)),
    })),
    perProvider: providerRows
      .filter((row) => row.sourceProvider)
      .map((row) => ({
        state: row.state,
        sourceProvider: row.sourceProvider,
        videoRows: Number(row.videoRows),
        streamRows: Number(row.streamRows),
        replayAvailableRows: Number(row.replayAvailableRows),
      })),
  };
}

async function backfillTheDogs(options: Options): Promise<BackfillSummary> {
  const summary = newSummary("thedogs");
  const remaining = () =>
    options.full ? Number.POSITIVE_INFINITY : Math.max(options.limit - summary.selected, 0);

  const existingRows = await queryTheDogsExistingRows(options, remaining());
  for (const row of existingRows) {
    if (!canSelect(summary, options)) break;
    summary.selected += 1;
    try {
      const replay = await resolveRaceVideoReplay(row);
      if (!replay?.streamUrl) {
        summary.skipped += 1;
        continue;
      }
      summary.resolved += 1;
      await writeRaceVideo(
        {
          raceId: row.id,
          sourceProvider: row.sourceProvider,
          sourceId: row.sourceId,
          kind: row.kind,
          pageUrl: replay.pageUrl,
          embedSourceType: row.embedSourceType ?? "race-replay",
          sourceStatus: replay.sourceStatus,
          sourceCode: replay.sourceCode,
          streamUrl: replay.streamUrl,
          streamContentType: replay.streamContentType,
          title: replay.title ?? row.title,
          description: replay.description ?? row.description,
          sourceRawJson: null,
        },
        options
      );
      summary.written += options.dryRun ? 0 : 1;
    } catch {
      summary.errors += 1;
    }
  }

  if (remaining() > 0) {
    await backfillTheDogsReplayPages(options, summary);
  }

  return summary;
}

async function backfillTheDogsReplayPages(
  options: Options,
  summary: BackfillSummary
) {
  for (const date of eachDate(options.from, options.to)) {
    if (!canSelect(summary, options)) break;
    const races = await queryRacesByMeetingDate(date, options, {
      sourceProvider: "thedogs",
      onlyWithoutProvider: options.onlyMissing ? "thedogs" : null,
    });
    const racesByKey = new Map(
      races.map((race) => [raceKey(race.trackName, race.raceNumber), race])
    );
    if (racesByKey.size === 0) continue;

    const url = new URL(THEDOGS_REPLAYS_URL);
    url.searchParams.set("date", date);
    let html: string;
    try {
      html = await fetchText(url.toString());
    } catch (err) {
      summary.errors += 1;
      if (summary.notes.length < 8) {
        summary.notes.push(`The Dogs ${date} replay page failed: ${errorMessage(err)}`);
      }
      continue;
    }
    for (const card of parseTheDogsReplayCards(html)) {
      if (!canSelect(summary, options)) break;
      const race = racesByKey.get(raceKey(card.trackName, card.raceNumber));
      if (!race) continue;
      summary.selected += 1;

      try {
        const pageUrl = absoluteTheDogsUrl(card.pageUrl);
        const replay = await resolveRaceVideoReplay({
          sourceProvider: "thedogs",
          sourceId: card.videoSourceId,
          pageUrl,
          embedSourceType: "race-replay",
          title: card.title,
        });
        if (replay?.streamUrl) summary.resolved += 1;
        await writeRaceVideo(
          {
            raceId: race.id,
            sourceProvider: "thedogs",
            sourceId: card.videoSourceId,
            kind: DEFAULT_KIND,
            pageUrl,
            embedSourceType: "race-replay",
            sourceStatus: replay?.sourceStatus ?? 200,
            sourceCode: replay?.sourceCode ?? "thedogs-replay-card",
            streamUrl: replay?.streamUrl ?? null,
            streamContentType: replay?.streamContentType ?? null,
            title: replay?.title ?? card.title,
            description: replay?.description ?? race.name,
            sourceRawJson: JSON.stringify(card),
          },
          options
        );
        summary.written += options.dryRun ? 0 : 1;
      } catch {
        summary.errors += 1;
      }
    }
  }
}

async function backfillRacingQueensland(
  options: Options
): Promise<BackfillSummary> {
  const summary = newSummary("racing-queensland");
  const races = await queryRacesForState(options, "QLD", "racing-queensland");
  for (const race of races) {
    if (!canSelect(summary, options)) break;
    const trackCode = racingQueenslandTrackCode(race.trackName);
    if (!trackCode) {
      summary.skipped += 1;
      if (summary.notes.length < 8) {
        summary.notes.push(`No Racing Queensland code for ${race.trackName}`);
      }
      continue;
    }

    summary.selected += 1;
    const dateKey = compactDate(formatDate(race.meetingDate));
    const encodedCode = encodeURIComponent(trackCode);
    const pageUrl = `${RACING_QUEENSLAND_BASE}/racing/replays/tab-race-replays/race-player/greyhound/${encodedCode}/${dateKey}/race/${race.raceNumber}`;

    try {
      const replay = await resolveRacingQueenslandReplay(pageUrl, {
        sourceProvider: "racing-queensland",
        sourceId: `${trackCode}:${dateKey}:${race.raceNumber}`,
        title: race.name,
      });
      if (!replay || (replay.sourceStatus != null && replay.sourceStatus >= 400)) {
        summary.skipped += 1;
        continue;
      }
      if (replay.streamUrl) summary.resolved += 1;

      await writeRaceVideo(
        {
          raceId: race.id,
          sourceProvider: "racing-queensland",
          sourceId: `${trackCode}:${dateKey}:${race.raceNumber}`,
          kind: DEFAULT_KIND,
          pageUrl,
          embedSourceType: "racing-queensland",
          sourceStatus: replay.sourceStatus,
          sourceCode: replay.sourceCode,
          streamUrl: null,
          streamContentType: null,
          title: replay.title ?? race.name,
          description: race.name,
          sourceRawJson: JSON.stringify({
            pageUrl,
            resolvedStreamAtBackfill: Boolean(replay.streamUrl),
          }),
        },
        options
      );
      summary.written += options.dryRun ? 0 : 1;
    } catch {
      summary.errors += 1;
    }
  }
  return summary;
}

async function backfillTasracing(options: Options): Promise<BackfillSummary> {
  const summary = newSummary("tasracing");
  const races = await queryRacesForState(options, "TAS", "tasracing");
  const racesByKey = new Map(
    races.map((race) => [
      `${formatDate(race.meetingDate)}:${normaliseName(race.trackName)}:${race.raceNumber}`,
      race,
    ])
  );

  const events = await fetchTasracingEvents(options);
  for (const event of events) {
    if (!canSelect(summary, options)) break;
    if (!event.meeting_code || !event.meeting_date_format || !event.venue) continue;
    const replay = await fetchJson<{ races?: TasRace[] }>(
      `${TASRACING_RACE_API}?search=${encodeURIComponent(event.meeting_code)}`
    );
    for (const raceReplay of replay.races ?? []) {
      if (!canSelect(summary, options)) break;
      const raceNumber = Number(raceReplay.race_number);
      const race = racesByKey.get(
        `${event.meeting_date_format}:${normaliseName(event.venue)}:${raceNumber}`
      );
      if (!race) continue;
      const angle = publicTasracingAngle(raceReplay);
      if (!angle?.stream) {
        summary.skipped += 1;
        continue;
      }
      const streamUrl = tasracingStreamUrl(angle.stream);
      if (!streamUrl) {
        summary.skipped += 1;
        continue;
      }

      summary.selected += 1;
      summary.resolved += 1;
      await writeRaceVideo(
        {
          raceId: race.id,
          sourceProvider: "tasracing",
          sourceId: angle.stream,
          kind: DEFAULT_KIND,
          pageUrl: `https://form.tasracing.com.au/replays/${event.meeting_code}?race=${raceNumber}`,
          embedSourceType: "tasracing-hls",
          sourceStatus: 200,
          sourceCode: "tasracing-public-angle",
          streamUrl,
          streamContentType: streamContentType(streamUrl),
          title: angle.name ?? raceReplay.race_name ?? race.name,
          description: race.name,
          sourceRawJson: JSON.stringify({ event, raceReplay, angle }),
        },
        options
      );
      summary.written += options.dryRun ? 0 : 1;
    }
  }
  return summary;
}

async function backfillGreyhoundsWa(options: Options): Promise<BackfillSummary> {
  const summary = newSummary("greyhoundswa");
  for (const date of eachDate(options.from, options.to)) {
    if (!canSelect(summary, options)) break;
    const races = await queryRacesByMeetingDate(date, options, {
      state: "WA",
      onlyWithoutProvider: options.onlyMissing ? "greyhoundswa" : null,
    });
    const trackCount = new Set(races.map((race) => normaliseName(race.trackName))).size;
    if (trackCount !== 1) {
      if (races.length > 0) {
        summary.notes.push(`Skipped ${date}; Vimeo titles do not identify one of ${trackCount} WA tracks`);
      }
      continue;
    }
    const racesByNumber = new Map(races.map((race) => [race.raceNumber, race]));
    if (racesByNumber.size === 0) continue;

    let html: string;
    try {
      html = await fetchText(
        `${GREYHOUNDS_WA_SHOWCASE_BASE}/greyhoundswa${compactDate(date)}`
      );
    } catch (err) {
      summary.errors += 1;
      if (summary.notes.length < 8) {
        summary.notes.push(`Greyhounds WA ${date} showcase failed: ${errorMessage(err)}`);
      }
      continue;
    }
    for (const video of parseGreyhoundsWaVimeoVideos(html)) {
      if (!canSelect(summary, options)) break;
      const race = racesByNumber.get(video.raceNumber);
      if (!race) continue;
      summary.selected += 1;
      summary.resolved += 1;
      await writeRaceVideo(
        {
          raceId: race.id,
          sourceProvider: "greyhoundswa",
          sourceId: video.videoId,
          kind: DEFAULT_KIND,
          pageUrl: video.pageUrl,
          embedSourceType: "vimeo",
          sourceStatus: 200,
          sourceCode: "greyhoundswa-vimeo",
          streamUrl: null,
          streamContentType: null,
          title: `${race.trackName} Race ${race.raceNumber}`,
          description: race.name,
          sourceRawJson: JSON.stringify(video),
        },
        options
      );
      summary.written += options.dryRun ? 0 : 1;
    }
  }
  return summary;
}

async function backfillSaRaceReplayYoutube(
  options: Options
): Promise<BackfillSummary> {
  const summary = newSummary("sa-race-replay");
  const races = await queryRacesForState(options, "SA", "sa-race-replay");
  for (const race of races) {
    if (!canSelect(summary, options)) break;
    const exactTitle = saRaceReplayTitle(race);
    summary.selected += 1;
    try {
      const videoId = await findYouTubeVideoByExactTitle(exactTitle);
      if (!videoId) {
        summary.skipped += 1;
        continue;
      }
      summary.resolved += 1;
      await writeRaceVideo(
        {
          raceId: race.id,
          sourceProvider: "sa-race-replay",
          sourceId: videoId,
          kind: DEFAULT_KIND,
          pageUrl: `https://www.youtube.com/watch?v=${videoId}`,
          embedSourceType: "youtube",
          sourceStatus: 200,
          sourceCode: "sa-race-replay-youtube-exact-title",
          streamUrl: null,
          streamContentType: null,
          title: exactTitle,
          description: race.name,
          sourceRawJson: JSON.stringify({ exactTitle }),
        },
        options
      );
      summary.written += options.dryRun ? 0 : 1;
    } catch (err) {
      summary.errors += 1;
      if (summary.notes.length < 8) {
        summary.notes.push(`${exactTitle} failed: ${errorMessage(err)}`);
      }
    }
  }
  return summary;
}

async function queryTheDogsExistingRows(options: Options, limit: number) {
  if (!options.full && limit <= 0) return [];
  const limitSql = options.full ? Prisma.empty : Prisma.sql`LIMIT ${limit}`;
  const missingSql = options.onlyMissing
    ? Prisma.sql`AND rv."streamUrl" IS NULL`
    : Prisma.empty;

  return prisma.$queryRaw<RaceVideoRow[]>`
    SELECT
      r."id",
      r."raceTime",
      m."meetingDate",
      r."raceNumber",
      r."name",
      t."name" AS "trackName",
      t."state",
      rv."sourceProvider",
      rv."sourceId",
      rv."kind",
      rv."pageUrl",
      rv."embedSourceType",
      rv."streamUrl",
      rv."streamContentType",
      rv."title",
      rv."description",
      rv."sourceStatus",
      rv."sourceCode"
    FROM "RaceVideo" rv
    JOIN "Race" r ON r."id" = rv."raceId"
    JOIN "Meeting" m ON m."id" = r."meetingId"
    JOIN "Track" t ON t."id" = m."trackId"
    WHERE rv."sourceProvider" = 'thedogs'
      AND rv."kind" = ${DEFAULT_KIND}
      AND r."raceTime" >= ${startOfDay(options.from)}
      AND r."raceTime" <= ${endOfDay(options.to)}
      ${stateSql(options)}
      ${missingSql}
    ORDER BY r."raceTime" ASC, r."raceNumber" ASC
    ${limitSql}
  `;
}

async function queryRacesForState(
  options: Options,
  state: string,
  onlyWithoutProvider: string
) {
  const limitSql = options.full ? Prisma.empty : Prisma.sql`LIMIT ${options.limit}`;
  const missingSql = options.onlyMissing
    ? Prisma.sql`
      AND NOT EXISTS (
        SELECT 1 FROM "RaceVideo" rv
        WHERE rv."raceId" = r."id"
          AND rv."sourceProvider" = ${onlyWithoutProvider}
          AND rv."kind" = ${DEFAULT_KIND}
      )
    `
    : Prisma.empty;

  return prisma.$queryRaw<RaceRow[]>`
    SELECT
      r."id",
      r."raceTime",
      m."meetingDate",
      r."raceNumber",
      r."name",
      t."name" AS "trackName",
      t."state"
    FROM "Race" r
    JOIN "Meeting" m ON m."id" = r."meetingId"
    JOIN "Track" t ON t."id" = m."trackId"
    WHERE t."state" = ${state}
      AND r."raceTime" >= ${startOfDay(options.from)}
      AND r."raceTime" <= ${endOfDay(options.to)}
      ${missingSql}
    ORDER BY r."raceTime" ASC, r."raceNumber" ASC
    ${limitSql}
  `;
}

async function queryRacesByMeetingDate(
  date: string,
  options: Options,
  filters: { state?: string; sourceProvider?: string; onlyWithoutProvider?: string | null }
) {
  const stateFilter = filters.state
    ? Prisma.sql`AND t."state" = ${filters.state}`
    : stateSql(options);
  const sourceProviderFilter = filters.sourceProvider
    ? Prisma.sql`AND r."sourceProvider" = ${filters.sourceProvider}`
    : Prisma.empty;
  const missingFilter = filters.onlyWithoutProvider
    ? Prisma.sql`
      AND NOT EXISTS (
        SELECT 1 FROM "RaceVideo" rv
        WHERE rv."raceId" = r."id"
          AND rv."sourceProvider" = ${filters.onlyWithoutProvider}
          AND rv."kind" = ${DEFAULT_KIND}
      )
    `
    : Prisma.empty;

  return prisma.$queryRaw<RaceRow[]>`
    SELECT
      r."id",
      r."raceTime",
      m."meetingDate",
      r."raceNumber",
      r."name",
      t."name" AS "trackName",
      t."state"
    FROM "Race" r
    JOIN "Meeting" m ON m."id" = r."meetingId"
    JOIN "Track" t ON t."id" = m."trackId"
    WHERE m."meetingDate" >= ${startOfDay(date)}
      AND m."meetingDate" <= ${endOfDay(date)}
      ${stateFilter}
      ${sourceProviderFilter}
      ${missingFilter}
    ORDER BY t."name" ASC, r."raceNumber" ASC
  `;
}

async function fetchTasracingEvents(options: Options) {
  const events: TasEvent[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const payload = await fetchJson<{ videos?: TasEvent[] }>(
      `${TASRACING_EVENT_API}?search=greyhound&page=${page}`
    );
    const videos = payload.videos ?? [];
    if (videos.length === 0) break;

    let allOlderThanRange = true;
    for (const event of videos) {
      const date = event.meeting_date_format;
      if (!date) continue;
      if (date >= options.from) allOlderThanRange = false;
      if (
        date >= options.from &&
        date <= options.to &&
        event.category === "Greyhounds" &&
        !event.trial
      ) {
        events.push(event);
      }
    }
    if (allOlderThanRange) break;
  }
  return events;
}

function publicTasracingAngle(race: TasRace) {
  const angles = Array.isArray(race.angles)
    ? race.angles
    : Object.values(race.angles ?? {});
  return angles.find((angle) => angle.login === false && angle.stream);
}

async function writeRaceVideo(row: RaceVideoWrite, options: Options) {
  if (options.dryRun) return;
  const now = new Date();
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
      ${row.raceId},
      ${row.sourceProvider},
      ${row.sourceId},
      ${row.kind ?? DEFAULT_KIND},
      ${row.pageUrl},
      ${row.embedSourceType},
      ${row.sourceStatus},
      ${row.sourceCode},
      ${row.streamUrl},
      ${row.streamContentType},
      ${row.title},
      ${row.description},
      ${row.sourceRawJson},
      ${now},
      ${now},
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

function parseOptions(args: string[]): Options {
  const flags = parseFlags(args);
  const from = stringOption(flags, "from") ?? formatDate(addDays(new Date(), -7));
  const to = stringOption(flags, "to") ?? formatDate(new Date());
  assertDate(from, "--from");
  assertDate(to, "--to");
  if (dayValue(from) > dayValue(to)) {
    throw new Error("--from must be before or equal to --to");
  }

  return {
    from,
    to,
    states: csvOption(flags, "state").map((state) => state.toUpperCase()),
    providers: csvOption(flags, "provider").map((provider) => provider.toLowerCase()),
    limit: positiveInt(stringOption(flags, "limit"), 100),
    full: flags.has("full"),
    auditOnly: flags.has("audit-only"),
    dryRun: flags.has("dry-run"),
    onlyMissing: !flags.has("refresh"),
    compact: flags.has("compact"),
  };
}

function parseFlags(args: string[]) {
  const values = new Map<string, string | true>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    const next = args[index + 1];
    if (inlineValue != null) {
      values.set(key, inlineValue);
    } else if (next && !next.startsWith("--")) {
      values.set(key, next);
      index += 1;
    } else {
      values.set(key, true);
    }
  }
  return values;
}

function csvOption(values: Map<string, string | true>, key: string) {
  return (stringOption(values, key) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function stringOption(values: Map<string, string | true>, key: string) {
  const value = values.get(key);
  return typeof value === "string" ? value : undefined;
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function stateSql(options: Options) {
  return options.states.length
    ? Prisma.sql`AND t."state" IN (${Prisma.join(options.states)})`
    : Prisma.empty;
}

function stateEnabled(options: Options, state: string) {
  return options.states.length === 0 || options.states.includes(state);
}

function providerEnabled(options: Options, provider: string) {
  return options.providers.length === 0 || options.providers.includes(provider);
}

function newSummary(provider: string): BackfillSummary {
  return {
    provider,
    selected: 0,
    resolved: 0,
    written: 0,
    skipped: 0,
    errors: 0,
    notes: [],
  };
}

function canSelect(summary: BackfillSummary, options: Options) {
  return options.full || summary.selected < options.limit;
}

function racingQueenslandTrackCode(trackName: string) {
  const key = normaliseName(trackName);
  const codes: Record<string, string> = {
    "betdeluxe capalaba": "capa",
    capalaba: "capa",
    "betdeluxe rockhampton": "rock",
    rockhampton: "rock",
    "ladbrokes q straight": "qst ",
    "q straight": "qst ",
    "ladbrokes q1 lakeside": "qot ",
    "q1 lakeside": "qot ",
    "ladbrokes q2 parklands": "qtt ",
    "q2 parklands": "qtt ",
  };
  return codes[key] ?? null;
}

function saRaceReplayTitle(race: RaceRow) {
  return `${hyphenTrackName(race.trackName)}-${dayMonthYear(race.meetingDate)}-Race-${race.raceNumber}`;
}

function hyphenTrackName(trackName: string) {
  return normaliseName(trackName)
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("-");
}

function dayMonthYear(date: Date) {
  const value = formatDate(date);
  const [year, month, day] = value.split("-");
  return `${day}${month}${year}`;
}

async function findYouTubeVideoByExactTitle(exactTitle: string) {
  const url = new URL("https://www.youtube.com/results");
  url.searchParams.set("search_query", `${exactTitle} SA Race Replay`);
  const html = await fetchText(url.toString());
  const pattern =
    /(?:"videoId":"([A-Za-z0-9_-]{11})"[\s\S]{0,1500}?"text":"([^"]+)"|"text":"([^"]+)"[\s\S]{0,1500}?"videoId":"([A-Za-z0-9_-]{11})")/g;
  for (const match of html.matchAll(pattern)) {
    const videoId = match[1] ?? match[4];
    const title = decodeYouTubeText(match[2] ?? match[3] ?? "");
    if (videoId && title === exactTitle) return videoId;
  }
  return null;
}

function decodeYouTubeText(value: string) {
  return value.replace(/\\u0026/g, "&").replace(/\\"/g, '"');
}

function raceKey(trackName: string, raceNumber: number) {
  return `${normaliseName(trackName)}:${raceNumber}`;
}

function normaliseName(value: string) {
  return value
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      accept: "text/html,application/xhtml+xml,application/json",
      "accept-language": "en-US,en;q=0.9",
      "user-agent": USER_AGENT,
    },
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { accept: "application/json", "user-agent": USER_AGENT },
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return (await response.json()) as T;
}

function eachDate(from: string, to: string) {
  const dates: string[] = [];
  for (let value = dayValue(from); value <= dayValue(to); value += MS_PER_DAY) {
    dates.push(formatDate(new Date(value)));
  }
  return dates;
}

function assertDate(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
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

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function formatDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function compactDate(date: string) {
  return date.replaceAll("-", "");
}

function ratio(value: number, total: number) {
  return total > 0 ? Number((value / total).toFixed(4)) : 0;
}

function json(value: unknown, compact: boolean) {
  return JSON.stringify(
    value,
    (_key, item) => (typeof item === "bigint" ? Number(item) : item),
    compact ? 0 : 2
  );
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

main()
  .catch((err) => {
    console.error("[race-videos] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
