import "server-only";

import { withDbSystemContext } from "@/lib/db-context";
import { fetchPublicInternetOrigin } from "@/lib/public-network";
import { readBoundedTextResponse } from "@/lib/remote-response";
import type { LiveMeeting, LiveRace } from "./provider";
import {
  parseSaRaceReplayVideoIds,
  resolveRacingQueenslandReplay,
  streamContentType,
  tasracingStreamUrl,
} from "./race-replay";

const RACING_QUEENSLAND_BASE =
  process.env.RACING_QUEENSLAND_BASE_URL ??
  "https://www.racingqueensland.com.au";
const TASRACING_EVENT_API =
  process.env.TASRACING_EVENT_REPLAY_API ??
  "https://test.tasracing.com.au/wp-json/event_replay/list";
const TASRACING_RACE_API =
  process.env.TASRACING_RACE_REPLAY_API ??
  "https://test.tasracing.com.au/wp-json/race_replay/list";
const PROVIDER_RESPONSE_MAX_BYTES = 4 * 1024 * 1024;
const REPLAY_FETCH_TIMEOUT_MS = 10_000;
const RACE_LOOKUP_CHUNK_SIZE = 50;
const MAX_QUEENSLAND_CANDIDATES = 24;
const MAX_SOUTH_AUSTRALIA_CANDIDATES = 18;
const MAX_TASMANIA_CANDIDATES = 18;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

type ReplayState = "QLD" | "SA" | "TAS";

type ReplayCandidate = {
  sourceProvider: string;
  sourceId: string;
  meetingDate: string;
  trackName: string;
  state: ReplayState;
  race: LiveRace;
};

type LinkedReplayCandidate = ReplayCandidate & {
  raceId: string;
};

type RaceLookupRow = {
  id: string;
  sourceProvider: string | null;
  sourceId: string | null;
  videos: Array<{ sourceProvider: string }>;
};

type ReplayWrite = {
  raceId: string;
  sourceProvider: string;
  sourceId: string;
  kind: string;
  pageUrl: string;
  embedSourceType: string | null;
  sourceStatus: number | null;
  sourceCode: string | null;
  streamUrl: string | null;
  streamContentType: string | null;
  title: string | null;
  description: string | null;
  sourceRawJson: string | null;
  fetchedAt: Date;
  lastSyncedAt: Date;
};

type TasEvent = {
  category?: string;
  venue?: string;
  meeting_code?: string;
  meeting_date_format?: string;
  trial?: boolean;
};

type TasRace = {
  race_name?: string;
  race_number?: number;
  angles?: Record<string, TasAngle> | TasAngle[];
};

type TasAngle = {
  name?: string;
  stream?: string;
  login?: boolean;
};

export type ReplayEnrichmentSummary = {
  candidates: number;
  resolved: number;
  written: number;
  skipped: number;
  errors: number;
};

export async function enrichLiveRaceReplays(
  meetings: LiveMeeting[],
): Promise<ReplayEnrichmentSummary> {
  const summary: ReplayEnrichmentSummary = {
    candidates: 0,
    resolved: 0,
    written: 0,
    skipped: 0,
    errors: 0,
  };
  const sourceCandidates = collectReplayCandidates(meetings);
  if (sourceCandidates.length === 0) return summary;

  let linked: LinkedReplayCandidate[];
  try {
    linked = await linkStoredRaces(sourceCandidates);
  } catch {
    return { ...summary, errors: sourceCandidates.length };
  }

  const candidates = selectBoundedCandidates(linked);
  summary.candidates = candidates.length;
  summary.skipped += sourceCandidates.length - candidates.length;

  const [queensland, southAustralia, tasmania] = await Promise.all([
    resolveQueenslandCandidates(candidates.filter(({ state }) => state === "QLD")),
    resolveSouthAustraliaCandidates(candidates.filter(({ state }) => state === "SA")),
    resolveTasmaniaCandidates(candidates.filter(({ state }) => state === "TAS")),
  ]);
  const resolutions = [...queensland, ...southAustralia, ...tasmania];
  const writes = resolutions.flatMap((resolution) =>
    resolution.write ? [resolution.write] : [],
  );
  summary.resolved = writes.length;
  summary.errors += resolutions.filter(({ error }) => error).length;
  summary.skipped += resolutions.length - writes.length;

  if (writes.length === 0) return summary;
  try {
    summary.written = await withDbSystemContext(
      async (tx) => {
        const result = await tx.raceVideo.createMany({
          data: writes,
          skipDuplicates: true,
        });
        return result.count;
      },
      { timeout: 30_000 },
    );
  } catch {
    summary.errors += writes.length;
  }
  return summary;
}

export function racingQueenslandTrackCode(trackName: string) {
  const codes: Record<string, string> = {
    "albion park": "albi",
    "bet nation townsville": "town",
    "betdeluxe capalaba": "capa",
    "betdeluxe rockhampton": "rock",
    capalaba: "capa",
    "ladbrokes q straight": "qst ",
    "ladbrokes q1 lakeside": "qot ",
    "ladbrokes q2 parklands": "qtt ",
    "q straight": "qst ",
    "q1 lakeside": "qot ",
    "q2 parklands": "qtt ",
    rockhampton: "rock",
    townsville: "town",
  };
  return codes[normaliseName(trackName)] ?? null;
}

export function saRaceReplayTitle(
  trackName: string,
  meetingDate: string,
  raceNumber: number,
) {
  const [year, month, day] = meetingDate.slice(0, 10).split("-");
  if (!year || !month || !day) return null;
  const normalisedTrack = normaliseName(trackName);
  const titleTrack =
    normalisedTrack === "mount gambier"
      ? "Mt-Gambier"
      : normalisedTrack
          .split(" ")
          .filter(Boolean)
          .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
          .join("-");
  return titleTrack ? `${titleTrack}-${day}${month}${year}-Race-${raceNumber}` : null;
}

function collectReplayCandidates(meetings: LiveMeeting[]) {
  const candidates = new Map<string, ReplayCandidate>();
  for (const meeting of meetings) {
    const state = normaliseReplayState(meeting.state);
    if (!state) continue;
    for (const race of meeting.races) {
      const sourceProvider = race.sourceProvider ?? meeting.sourceProvider;
      const sourceId = race.sourceId?.trim();
      if (!sourceProvider || !sourceId) continue;
      const key = sourceRaceKey(sourceProvider, sourceId);
      candidates.set(key, {
        sourceProvider,
        sourceId,
        meetingDate: meeting.meetingDate.slice(0, 10),
        trackName: meeting.trackName,
        state,
        race,
      });
    }
  }
  return [...candidates.values()].sort(compareCandidates);
}

async function linkStoredRaces(candidates: ReplayCandidate[]) {
  const byProvider = new Map<string, Set<string>>();
  for (const candidate of candidates) {
    const ids = byProvider.get(candidate.sourceProvider) ?? new Set<string>();
    ids.add(candidate.sourceId);
    byProvider.set(candidate.sourceProvider, ids);
  }

  const rows = await withDbSystemContext(async (tx) => {
    const found: RaceLookupRow[] = [];
    for (const [sourceProvider, sourceIds] of byProvider) {
      const ids = [...sourceIds];
      for (let index = 0; index < ids.length; index += RACE_LOOKUP_CHUNK_SIZE) {
        found.push(
          ...(await tx.race.findMany({
            where: {
              sourceProvider,
              sourceId: { in: ids.slice(index, index + RACE_LOOKUP_CHUNK_SIZE) },
            },
            take: RACE_LOOKUP_CHUNK_SIZE,
            select: {
              id: true,
              sourceProvider: true,
              sourceId: true,
              videos: {
                where: { kind: "replay" },
                select: { sourceProvider: true },
              },
            },
          })),
        );
      }
    }
    return found;
  });

  const rowsBySource = new Map<string, RaceLookupRow[]>();
  for (const row of rows) {
    if (!row.sourceProvider || !row.sourceId) continue;
    const key = sourceRaceKey(row.sourceProvider, row.sourceId);
    const matches = rowsBySource.get(key) ?? [];
    matches.push(row);
    rowsBySource.set(key, matches);
  }

  return candidates.flatMap((candidate): LinkedReplayCandidate[] => {
    const matches = rowsBySource.get(
      sourceRaceKey(candidate.sourceProvider, candidate.sourceId),
    );
    if (matches?.length !== 1) return [];
    const row = matches[0];
    const supplementalProvider = supplementalProviderFor(candidate.state);
    if (row.videos.some(({ sourceProvider }) => sourceProvider === supplementalProvider)) {
      return [];
    }
    return [{ ...candidate, raceId: row.id }];
  });
}

function selectBoundedCandidates(candidates: LinkedReplayCandidate[]) {
  const limits: Record<ReplayState, number> = {
    QLD: MAX_QUEENSLAND_CANDIDATES,
    SA: MAX_SOUTH_AUSTRALIA_CANDIDATES,
    TAS: MAX_TASMANIA_CANDIDATES,
  };
  const selected: LinkedReplayCandidate[] = [];
  const counts: Record<ReplayState, number> = { QLD: 0, SA: 0, TAS: 0 };
  for (const candidate of candidates) {
    if (counts[candidate.state] >= limits[candidate.state]) continue;
    counts[candidate.state] += 1;
    selected.push(candidate);
  }
  return selected;
}

async function resolveQueenslandCandidates(candidates: LinkedReplayCandidate[]) {
  return mapLimit(candidates, 4, async (candidate) => {
    const trackCode = racingQueenslandTrackCode(candidate.trackName);
    if (!trackCode) return { write: null, error: false };
    const dateKey = candidate.meetingDate.replaceAll("-", "");
    const pageUrl = `${RACING_QUEENSLAND_BASE}/racing/replays/tab-race-replays/race-player/greyhound/${encodeURIComponent(trackCode)}/${dateKey}/race/${candidate.race.raceNumber}`;
    try {
      const replay = await resolveRacingQueenslandReplay(pageUrl, {
        title: candidate.race.name,
      });
      if (!replay?.streamUrl || (replay.sourceStatus ?? 500) >= 400) {
        return { write: null, error: false };
      }
      return {
        write: replayWrite(candidate, {
          sourceProvider: "racing-queensland",
          sourceId: `${trackCode}:${dateKey}:${candidate.race.raceNumber}`,
          pageUrl,
          embedSourceType: "racing-queensland",
          sourceStatus: replay.sourceStatus,
          sourceCode: "racing-queensland-page",
          streamUrl: null,
          streamContentType: null,
          title: replay.title ?? candidate.race.name ?? null,
        }),
        error: false,
      };
    } catch {
      return { write: null, error: true };
    }
  });
}

async function resolveSouthAustraliaCandidates(
  candidates: LinkedReplayCandidate[],
) {
  return mapLimit(candidates, 3, async (candidate) => {
    const exactTitle = saRaceReplayTitle(
      candidate.trackName,
      candidate.meetingDate,
      candidate.race.raceNumber,
    );
    if (!exactTitle) return { write: null, error: false };
    try {
      const url = new URL("https://www.youtube.com/results");
      url.searchParams.set("search_query", `${exactTitle} SA Race Replay`);
      const html = await fetchText(url.toString());
      const videoIds = parseSaRaceReplayVideoIds(html, exactTitle);
      if (videoIds.length !== 1) return { write: null, error: false };
      const videoId = videoIds[0];
      return {
        write: replayWrite(candidate, {
          sourceProvider: "sa-race-replay",
          sourceId: videoId,
          pageUrl: `https://www.youtube.com/watch?v=${videoId}`,
          embedSourceType: "youtube",
          sourceStatus: 200,
          sourceCode: "sa-race-replay-youtube-exact-title",
          streamUrl: null,
          streamContentType: null,
          title: exactTitle,
        }),
        error: false,
      };
    } catch {
      return { write: null, error: true };
    }
  });
}

async function resolveTasmaniaCandidates(candidates: LinkedReplayCandidate[]) {
  if (candidates.length === 0) return [];
  try {
    const dates = new Set(candidates.map(({ meetingDate }) => meetingDate));
    const events = await fetchTasracingEvents(dates);
    const candidatesByEvent = new Map<string, LinkedReplayCandidate[]>();
    for (const candidate of candidates) {
      const key = tasEventKey(candidate.meetingDate, candidate.trackName);
      const values = candidatesByEvent.get(key) ?? [];
      values.push(candidate);
      candidatesByEvent.set(key, values);
    }

    const matchedEvents = events.filter(
      (event) =>
        event.meeting_code &&
        event.meeting_date_format &&
        event.venue &&
        candidatesByEvent.has(tasEventKey(event.meeting_date_format, event.venue)),
    );
    const resolved = await mapLimit(matchedEvents, 2, async (event) => {
      const payload = await fetchJson<{ races?: TasRace[] }>(
        `${TASRACING_RACE_API}?search=${encodeURIComponent(event.meeting_code ?? "")}`,
      );
      const racesByNumber = new Map(
        (payload.races ?? []).map((race) => [Number(race.race_number), race]),
      );
      const eventCandidates = candidatesByEvent.get(
        tasEventKey(event.meeting_date_format ?? "", event.venue ?? ""),
      ) ?? [];
      return eventCandidates.flatMap((candidate): ReplayWrite[] => {
        const raceReplay = racesByNumber.get(candidate.race.raceNumber);
        const angle = publicTasracingAngle(raceReplay);
        const streamUrl = angle?.stream ? tasracingStreamUrl(angle.stream) : null;
        if (!angle?.stream || !streamUrl) return [];
        return [
          replayWrite(candidate, {
            sourceProvider: "tasracing",
            sourceId: angle.stream,
            pageUrl: `https://form.tasracing.com.au/replays/${event.meeting_code}?race=${candidate.race.raceNumber}`,
            embedSourceType: "tasracing-hls",
            sourceStatus: 200,
            sourceCode: "tasracing-public-angle",
            streamUrl,
            streamContentType: streamContentType(streamUrl),
            title: angle.name ?? raceReplay?.race_name ?? candidate.race.name ?? null,
          }),
        ];
      });
    });
    const writes = resolved.flat();
    const matchedRaceIds = new Set(writes.map(({ raceId }) => raceId));
    return candidates.map((candidate) => ({
      write: writes.find(({ raceId }) => raceId === candidate.raceId) ?? null,
      error: false,
      matched: matchedRaceIds.has(candidate.raceId),
    }));
  } catch {
    return candidates.map(() => ({ write: null, error: true, matched: false }));
  }
}

async function fetchTasracingEvents(dates: Set<string>) {
  const events: TasEvent[] = [];
  const oldest = [...dates].sort()[0];
  for (let page = 1; page <= 5; page += 1) {
    const payload = await fetchJson<{ videos?: TasEvent[] }>(
      `${TASRACING_EVENT_API}?search=greyhound&page=${page}`,
    );
    const videos = payload.videos ?? [];
    if (videos.length === 0) break;
    for (const event of videos) {
      if (
        event.meeting_date_format &&
        dates.has(event.meeting_date_format) &&
        event.category === "Greyhounds" &&
        !event.trial
      ) {
        events.push(event);
      }
    }
    const dated = videos.flatMap(({ meeting_date_format }) =>
      meeting_date_format ? [meeting_date_format] : [],
    );
    if (oldest && dated.length > 0 && dated.every((date) => date < oldest)) break;
  }
  return events;
}

function publicTasracingAngle(race: TasRace | undefined) {
  const angles = Array.isArray(race?.angles)
    ? race.angles
    : Object.values(race?.angles ?? {});
  return angles.find((angle) => angle.login === false && angle.stream);
}

function replayWrite(
  candidate: LinkedReplayCandidate,
  replay: Omit<
    ReplayWrite,
    | "raceId"
    | "kind"
    | "description"
    | "sourceRawJson"
    | "fetchedAt"
    | "lastSyncedAt"
  >,
): ReplayWrite {
  const now = new Date();
  return {
    raceId: candidate.raceId,
    kind: "replay",
    description: candidate.race.name ?? null,
    sourceRawJson: null,
    fetchedAt: now,
    lastSyncedAt: now,
    ...replay,
  };
}

async function fetchText(url: string) {
  const response = await fetchPublicInternetOrigin(url, {
    signal: AbortSignal.timeout(REPLAY_FETCH_TIMEOUT_MS),
    redirect: "manual",
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9",
      "user-agent": USER_AGENT,
    },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("replay_source.request_failed");
  }
  return readBoundedTextResponse(response, {
    maxBytes: PROVIDER_RESPONSE_MAX_BYTES,
    allowedContentTypes: ["text/html", "application/xhtml+xml"],
  });
}

async function fetchJson<T>(url: string) {
  const response = await fetchPublicInternetOrigin(url, {
    signal: AbortSignal.timeout(REPLAY_FETCH_TIMEOUT_MS),
    redirect: "manual",
    headers: { accept: "application/json", "user-agent": USER_AGENT },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("replay_source.request_failed");
  }
  const text = await readBoundedTextResponse(response, {
    maxBytes: PROVIDER_RESPONSE_MAX_BYTES,
    allowedContentTypes: ["application/json", "+json"],
  });
  return JSON.parse(text) as T;
}

function normaliseReplayState(value: string | null | undefined): ReplayState | null {
  const state = value?.trim().toUpperCase();
  return state === "QLD" || state === "SA" || state === "TAS" ? state : null;
}

function supplementalProviderFor(state: ReplayState) {
  if (state === "QLD") return "racing-queensland";
  if (state === "SA") return "sa-race-replay";
  return "tasracing";
}

function sourceRaceKey(sourceProvider: string, sourceId: string) {
  return `${sourceProvider}:${sourceId}`;
}

function tasEventKey(meetingDate: string, venue: string) {
  return `${meetingDate}:${normaliseName(venue)}`;
}

function normaliseName(value: string) {
  return value
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compareCandidates(left: ReplayCandidate, right: ReplayCandidate) {
  return (
    right.meetingDate.localeCompare(left.meetingDate) ||
    left.trackName.localeCompare(right.trackName) ||
    left.race.raceNumber - right.race.raceNumber
  );
}

async function mapLimit<T, R>(
  values: T[],
  limit: number,
  mapper: (value: T) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(values[index]);
      }
    }),
  );
  return results;
}
