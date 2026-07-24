import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { withDbSystemContext } from "../db-context";
import { readBoundedTextResponse } from "../remote-response";
import {
  parseGreyhoundsWaVimeoVideos,
  parseTheDogsReplayCards,
  streamContentType,
  tasracingStreamUrl,
} from "./race-replay";

const REPLAY_LOOKBACK_DAYS = 7;
const REPLAY_CANDIDATE_LIMIT = 1_000;
const REPLAY_WRITE_CHUNK_SIZE = 100;
const FETCH_TIMEOUT_MS = 20_000;
const RESPONSE_MAX_BYTES = 4 * 1024 * 1024;
const THEDOGS_REPLAYS_URL = "https://www.thedogs.com.au/videos/replays";
const TASRACING_EVENT_API =
  "https://test.tasracing.com.au/wp-json/event_replay/list";
const TASRACING_RACE_API =
  "https://test.tasracing.com.au/wp-json/race_replay/list";
const GREYHOUNDS_WA_SHOWCASE_BASE = "https://vimeo.com/showcase";
const ALLOWED_REPLAY_ORIGINS = new Set([
  "https://www.thedogs.com.au",
  "https://test.tasracing.com.au",
  "https://vimeo.com",
]);
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const shortText = z.string().trim().min(1).max(200);
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const tasAngleSchema = z.object({
  name: shortText.optional(),
  stream: z.string().trim().min(1).max(256).optional(),
  angle: z.string().trim().min(1).max(80).optional(),
  login: z.boolean().optional(),
});
const tasAnglesSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const entries = Object.entries(value);
  if (entries.length > 16 || entries.some(([key]) => key.length > 80)) {
    return value;
  }
  return entries.map(([, angle]) => angle);
}, z.array(tasAngleSchema).max(16));
const tasRaceSchema = z.object({
  race_name: shortText.optional(),
  race_number: z.coerce.number().int().min(1).max(64).optional(),
  race_code: z.string().trim().min(1).max(80).optional(),
  angles: tasAnglesSchema.optional(),
});
const tasEventSchema = z.object({
  title: shortText.optional(),
  category: z.string().trim().min(1).max(80).optional(),
  venue: shortText.optional(),
  meeting_code: z.string().trim().min(1).max(128).optional(),
  meeting_date_format: dateKey.optional(),
  trial: z.boolean().optional(),
});
const tasEventEnvelopeSchema = z.object({
  videos: z.array(tasEventSchema).max(100).optional(),
});
const tasRaceEnvelopeSchema = z.object({
  races: z.array(tasRaceSchema).max(64).optional(),
});

type FetchLike = typeof fetch;
type TasEvent = z.infer<typeof tasEventSchema>;
type TasRace = z.infer<typeof tasRaceSchema>;

export type ReplayCandidate = {
  raceId: string;
  raceNumber: number;
  raceName: string | null;
  meetingDate: string;
  trackName: string;
  state: string;
};

type RaceVideoWrite = {
  raceId: string;
  sourceProvider: string;
  sourceId: string;
  pageUrl: string;
  embedSourceType: string;
  sourceStatus: number;
  sourceCode: string;
  streamUrl: string | null;
  streamContentType: string | null;
  title: string | null;
  description: string | null;
  sourceRawJson: string;
};

export type ReplayReconciliationResult = {
  candidates: number;
  resolved: number;
  written: number;
  errors: number;
  failedSources: string[];
};

export async function reconcileRecentRaceReplays({
  includeTheDogs,
  now = new Date(),
  fetchImpl = fetch,
}: {
  includeTheDogs: boolean;
  now?: Date;
  fetchImpl?: FetchLike;
}): Promise<ReplayReconciliationResult> {
  const candidates = await recentReplayCandidates(now);
  if (candidates.length === 0) {
    return {
      candidates: 0,
      resolved: 0,
      written: 0,
      errors: 0,
      failedSources: [],
    };
  }

  const collected = await collectOfficialReplayRows(candidates, {
    includeTheDogs,
    fetchImpl,
  });
  const written = await writeRaceVideos(collected.rows);
  return {
    candidates: candidates.length,
    resolved: collected.rows.length,
    written,
    errors: collected.errors,
    failedSources: collected.failedSources,
  };
}

export async function collectOfficialReplayRows(
  candidates: ReplayCandidate[],
  {
    includeTheDogs,
    fetchImpl = fetch,
  }: {
    includeTheDogs: boolean;
    fetchImpl?: FetchLike;
  },
) {
  const rows: RaceVideoWrite[] = [];
  const failedSources: string[] = [];
  let errors = 0;

  if (includeTheDogs) {
    const result = await collectTheDogsRows(candidates, fetchImpl);
    rows.push(...result.rows);
    errors += result.errors;
    failedSources.push(...result.failedSources);
  }

  const tasResult = await collectTasracingRows(
    candidates.filter((candidate) => candidate.state === "TAS"),
    fetchImpl,
  );
  rows.push(...tasResult.rows);
  errors += tasResult.errors;
  failedSources.push(...tasResult.failedSources);

  const waResult = await collectGreyhoundsWaRows(
    candidates.filter((candidate) => candidate.state === "WA"),
    fetchImpl,
  );
  rows.push(...waResult.rows);
  errors += waResult.errors;
  failedSources.push(...waResult.failedSources);

  return {
    rows: uniqueRows(rows),
    errors,
    failedSources: [...new Set(failedSources)].slice(0, 16),
  };
}

async function recentReplayCandidates(now: Date): Promise<ReplayCandidate[]> {
  const from = new Date(
    now.getTime() - REPLAY_LOOKBACK_DAYS * 24 * 60 * 60 * 1_000,
  );
  const races = await withDbSystemContext(
    (tx) =>
      tx.race.findMany({
        where: {
          raceTime: { gte: from, lte: now },
          videos: { none: { kind: "replay" } },
          meeting: {
            track: {
              state: {
                in: ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"],
              },
            },
          },
        },
        orderBy: { raceTime: "desc" },
        take: REPLAY_CANDIDATE_LIMIT,
        select: {
          id: true,
          raceNumber: true,
          name: true,
          meeting: {
            select: {
              meetingDate: true,
              track: { select: { name: true, state: true } },
            },
          },
        },
      }),
    { maxWait: 30_000, timeout: 60_000 },
  );

  return races.map((race) => ({
    raceId: race.id,
    raceNumber: race.raceNumber,
    raceName: race.name,
    meetingDate: race.meeting.meetingDate.toISOString().slice(0, 10),
    trackName: race.meeting.track.name,
    state: race.meeting.track.state.trim().toUpperCase(),
  }));
}

async function collectTheDogsRows(
  candidates: ReplayCandidate[],
  fetchImpl: FetchLike,
) {
  const rows: RaceVideoWrite[] = [];
  const failedSources: string[] = [];
  let errors = 0;

  for (const [date, dateCandidates] of byMeetingDate(candidates)) {
    try {
      const url = new URL(THEDOGS_REPLAYS_URL);
      url.searchParams.set("date", date);
      const html = await fetchReplayText(url, "html", fetchImpl);
      const cardsByKey = new Map<
        string,
        ReturnType<typeof parseTheDogsReplayCards>
      >();
      for (const card of parseTheDogsReplayCards(html)) {
        const key = raceKey(card.trackName, card.raceNumber);
        const cards = cardsByKey.get(key) ?? [];
        cards.push(card);
        cardsByKey.set(key, cards);
      }

      for (const candidate of dateCandidates) {
        const cards = cardsByKey.get(
          raceKey(candidate.trackName, candidate.raceNumber),
        );
        if (!cards) continue;
        if (new Set(cards.map((card) => card.videoSourceId)).size !== 1) {
          errors += 1;
          failedSources.push(`thedogs:${date}:ambiguous`);
          continue;
        }
        const card = cards[0];
        rows.push({
          raceId: candidate.raceId,
          sourceProvider: "thedogs",
          sourceId: card.videoSourceId,
          pageUrl: new URL(card.pageUrl, THEDOGS_REPLAYS_URL).toString(),
          embedSourceType: "race-replay",
          sourceStatus: 200,
          sourceCode: "thedogs-replay-card",
          streamUrl: null,
          streamContentType: null,
          title: card.title,
          description: candidate.raceName,
          sourceRawJson: JSON.stringify({
            date,
            trackName: card.trackName,
            raceNumber: card.raceNumber,
            videoSourceId: card.videoSourceId,
          }),
        });
      }
    } catch {
      errors += 1;
      failedSources.push(`thedogs:${date}`);
    }
  }

  return { rows, errors, failedSources };
}

async function collectTasracingRows(
  candidates: ReplayCandidate[],
  fetchImpl: FetchLike,
) {
  if (candidates.length === 0) {
    return { rows: [] as RaceVideoWrite[], errors: 0, failedSources: [] };
  }

  const rows: RaceVideoWrite[] = [];
  const failedSources: string[] = [];
  let errors = 0;
  const candidateMeetings = new Set(
    candidates.map(
      (candidate) =>
        `${candidate.meetingDate}:${normaliseName(candidate.trackName)}`,
    ),
  );
  const events: TasEvent[] = [];

  try {
    for (let page = 1; page <= 10; page += 1) {
      const url = new URL(TASRACING_EVENT_API);
      url.searchParams.set("search", "greyhound");
      url.searchParams.set("page", String(page));
      const payload = parseProviderJson(
        await fetchReplayText(url, "json", fetchImpl),
        tasEventEnvelopeSchema,
        "tasracing.event_response_invalid",
      );
      const videos = payload.videos ?? [];
      if (videos.length === 0) break;
      events.push(
        ...videos.filter(
          (event) =>
            event.category === "Greyhounds" &&
            event.trial !== true &&
            event.meeting_date_format != null &&
            event.venue != null &&
            candidateMeetings.has(
              `${event.meeting_date_format}:${normaliseName(event.venue)}`,
            ),
        ),
      );
      if (
        [...candidateMeetings].every((meeting) =>
          events.some(
            (event) =>
              event.meeting_date_format != null &&
              event.venue != null &&
              `${event.meeting_date_format}:${normaliseName(event.venue)}` ===
                meeting,
          ),
        )
      ) {
        break;
      }
    }
  } catch {
    return {
      rows,
      errors: 1,
      failedSources: ["tasracing:events"],
    };
  }

  for (const event of events) {
    if (!event.meeting_code || !event.meeting_date_format || !event.venue) {
      continue;
    }
    try {
      const url = new URL(TASRACING_RACE_API);
      url.searchParams.set("search", event.meeting_code);
      const payload = parseProviderJson(
        await fetchReplayText(url, "json", fetchImpl),
        tasRaceEnvelopeSchema,
        "tasracing.race_response_invalid",
      );
      const candidatesByRace = new Map(
        candidates
          .filter(
            (candidate) =>
              candidate.meetingDate === event.meeting_date_format &&
              normaliseName(candidate.trackName) === normaliseName(event.venue ?? ""),
          )
          .map((candidate) => [candidate.raceNumber, candidate]),
      );

      for (const race of payload.races ?? []) {
        const candidate = race.race_number
          ? candidatesByRace.get(race.race_number)
          : undefined;
        if (!candidate) continue;
        const angle = publicTasracingAngle(race);
        const streamUrl = angle?.stream
          ? tasracingStreamUrl(angle.stream)
          : null;
        if (!angle?.stream || !streamUrl) continue;
        rows.push({
          raceId: candidate.raceId,
          sourceProvider: "tasracing",
          sourceId: angle.stream,
          pageUrl: `https://form.tasracing.com.au/replays/${encodeURIComponent(event.meeting_code)}?race=${candidate.raceNumber}`,
          embedSourceType: "tasracing-hls",
          sourceStatus: 200,
          sourceCode: "tasracing-public-angle",
          streamUrl,
          streamContentType: streamContentType(streamUrl),
          title: angle.name ?? race.race_name ?? candidate.raceName,
          description: candidate.raceName,
          sourceRawJson: JSON.stringify({
            meetingCode: event.meeting_code,
            meetingDate: event.meeting_date_format,
            venue: event.venue,
            raceNumber: candidate.raceNumber,
            stream: angle.stream,
          }),
        });
      }
    } catch {
      errors += 1;
      failedSources.push(`tasracing:${event.meeting_code}`);
    }
  }

  return { rows, errors, failedSources };
}

async function collectGreyhoundsWaRows(
  candidates: ReplayCandidate[],
  fetchImpl: FetchLike,
) {
  const rows: RaceVideoWrite[] = [];
  const failedSources: string[] = [];
  let errors = 0;

  for (const [date, dateCandidates] of byMeetingDate(candidates)) {
    const tracks = new Set(
      dateCandidates.map((candidate) => normaliseName(candidate.trackName)),
    );
    if (tracks.size !== 1) {
      errors += 1;
      failedSources.push(`greyhoundswa:${date}:ambiguous`);
      continue;
    }

    try {
      const url = new URL(
        `${GREYHOUNDS_WA_SHOWCASE_BASE}/greyhoundswa${date.replaceAll("-", "")}`,
      );
      const html = await fetchReplayText(url, "html", fetchImpl);
      const candidatesByRace = new Map(
        dateCandidates.map((candidate) => [candidate.raceNumber, candidate]),
      );
      for (const video of parseGreyhoundsWaVimeoVideos(html)) {
        const candidate = candidatesByRace.get(video.raceNumber);
        if (!candidate) continue;
        rows.push({
          raceId: candidate.raceId,
          sourceProvider: "greyhoundswa",
          sourceId: video.videoId,
          pageUrl: video.pageUrl,
          embedSourceType: "vimeo",
          sourceStatus: 200,
          sourceCode: "greyhoundswa-vimeo",
          streamUrl: null,
          streamContentType: null,
          title: `${candidate.trackName} Race ${candidate.raceNumber}`,
          description: candidate.raceName,
          sourceRawJson: JSON.stringify({
            date,
            raceNumber: video.raceNumber,
            videoId: video.videoId,
          }),
        });
      }
    } catch {
      errors += 1;
      failedSources.push(`greyhoundswa:${date}`);
    }
  }

  return { rows, errors, failedSources };
}

function publicTasracingAngle(race: TasRace) {
  return race.angles?.find((angle) => angle.login === false && angle.stream);
}

async function fetchReplayText(
  url: URL,
  kind: "html" | "json",
  fetchImpl: FetchLike,
) {
  if (
    !ALLOWED_REPLAY_ORIGINS.has(url.origin) ||
    url.protocol !== "https:" ||
    url.username ||
    url.password
  ) {
    throw new Error("replay_reconciliation.url_outside_provider_boundary");
  }

  const response = await fetchImpl(url, {
    redirect: "error",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      accept:
        kind === "json"
          ? "application/json"
          : "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9",
      "user-agent": USER_AGENT,
    },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`replay_reconciliation.provider_failed:${response.status}`);
  }
  return readBoundedTextResponse(response, {
    maxBytes: RESPONSE_MAX_BYTES,
    allowedContentTypes:
      kind === "json"
        ? ["application/json", "+json"]
        : ["text/html", "application/xhtml+xml"],
  });
}

function parseProviderJson<T extends z.ZodType>(
  text: string,
  schema: T,
  errorCode: string,
): z.output<T> {
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(errorCode);
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new Error(errorCode);
  return parsed.data;
}

async function writeRaceVideos(rows: RaceVideoWrite[]) {
  if (rows.length === 0) return 0;
  return withDbSystemContext(
    async (tx) => {
      let written = 0;
      for (let index = 0; index < rows.length; index += REPLAY_WRITE_CHUNK_SIZE) {
        const chunk = rows.slice(index, index + REPLAY_WRITE_CHUNK_SIZE);
        const now = new Date();
        written += await tx.$executeRaw`
          INSERT INTO "RaceVideo"
            ("id", "raceId", "sourceProvider", "sourceId", "kind", "pageUrl", "embedSourceType", "sourceStatus", "sourceCode", "streamUrl", "streamContentType", "title", "description", "sourceRawJson", "fetchedAt", "lastSyncedAt", "createdAt", "updatedAt")
          VALUES ${Prisma.join(
            chunk.map((row) => Prisma.sql`
              (${randomUUID()}, ${row.raceId}, ${row.sourceProvider}, ${row.sourceId}, 'replay', ${row.pageUrl}, ${row.embedSourceType}, ${row.sourceStatus}, ${row.sourceCode}, ${row.streamUrl}, ${row.streamContentType}, ${row.title}, ${row.description}, ${row.sourceRawJson}, ${now}, ${now}, NOW(), NOW())
            `),
          )}
          ON CONFLICT ("raceId", "sourceProvider", "kind") DO NOTHING
        `;
      }
      return written;
    },
    { maxWait: 30_000, timeout: 60_000 },
  );
}

function byMeetingDate(candidates: ReplayCandidate[]) {
  const byDate = new Map<string, ReplayCandidate[]>();
  for (const candidate of candidates) {
    const current = byDate.get(candidate.meetingDate) ?? [];
    current.push(candidate);
    byDate.set(candidate.meetingDate, current);
  }
  return [...byDate.entries()].sort(([left], [right]) =>
    right.localeCompare(left),
  );
}

function uniqueRows(rows: RaceVideoWrite[]) {
  const unique = new Map<string, RaceVideoWrite>();
  for (const row of rows) {
    const key = `${row.raceId}:${row.sourceProvider}`;
    if (!unique.has(key)) unique.set(key, row);
  }
  return [...unique.values()];
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
