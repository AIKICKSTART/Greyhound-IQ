import { cache } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { safeQuery } from "@/lib/db";
import {
  withDbRequestContext,
  type DbContextUser,
} from "@/lib/db-context";
import { cached } from "@/lib/ttl-cache";
import { getApproximateTableCounts } from "@/lib/db-stats";
import {
  formatRaceDateInput,
  normaliseRaceDateInput,
  raceClockTimeWindow,
  raceDateWindow,
} from "@/lib/race-time";
import { canonicalTrackName, trackNameAliasKey } from "@/lib/live/track-name";

const MARKETPLACE_CARD_MEDIA_LIMIT = 6;

const marketplaceListingCardInclude = {
  profile: { select: { id: true, displayName: true, verified: true } },
  category: { select: { id: true, slug: true, name: true } },
  location: {
    select: {
      state: true,
      region: true,
      suburb: true,
      postcode: true,
    },
  },
  media: {
    orderBy: { position: "asc" },
    take: MARKETPLACE_CARD_MEDIA_LIMIT,
    include: {
      media: {
        select: {
          id: true,
          storageBucket: true,
          storagePath: true,
          publicUrl: true,
          originalName: true,
          mimeType: true,
          widthPx: true,
          heightPx: true,
        },
      },
    },
  },
  dog: {
    select: {
      id: true,
      name: true,
      sire: { select: { name: true } },
      dam: { select: { name: true } },
    },
  },
} as const satisfies Prisma.ListingInclude;

type MarketplaceListingCard = Prisma.ListingGetPayload<{
  include: typeof marketplaceListingCardInclude;
}>;

const MARKETPLACE_LISTINGS_CACHE_MS = 30_000;
const marketplaceListingsCache = new Map<
  string,
  { expiresAt: number; value: MarketplaceListingCard[] }
>();
const pendingMarketplaceListings = new Map<
  string,
  Promise<MarketplaceListingCard[]>
>();

export async function getTodaysMeetings() {
  const { gte, lt } = raceDateWindow(formatRaceDateInput(new Date()));
  const raceWhere: Prisma.RaceWhereInput = { raceTime: { gte, lt } };
  const meetingWhere: Prisma.MeetingWhereInput = {
    races: { some: raceWhere },
  };
  const meetings = await getRaceExplorerMeetings(meetingWhere, raceWhere);

  return orderMeetingsByFirstRaceTime(meetings);
}

export const getRaceById = cache(async (id: string) => {
  return safeQuery(
    () =>
      prisma.race.findUnique({
        where: { id },
        include: {
          meeting: { include: { track: true } },
          runners: {
            orderBy: { boxNumber: "asc" },
            include: {
              dog: {
                include: {
                  trainer: true,
                  formEntries: {
                    where: { OR: [{ raceId: null }, { raceId: { not: id } }] },
                    orderBy: { date: "desc" },
                    take: 6,
                  },
                  profileForms: {
                    where: { hasVideo: true },
                    orderBy: { date: "desc" },
                    take: 8,
                    select: {
                      id: true,
                      sourceProvider: true,
                      raceUrl: true,
                      date: true,
                      trackCode: true,
                      trackName: true,
                      raceName: true,
                      finishText: true,
                      finishingPosition: true,
                      distance: true,
                      grade: true,
                      runningTime: true,
                      winnerTime: true,
                      hasVideo: true,
                    },
                  },
                },
              },
              trainer: true,
              result: true,
            },
          },
          videos: {
            orderBy: { fetchedAt: "desc" },
            select: {
              id: true,
              sourceProvider: true,
              sourceId: true,
              kind: true,
              pageUrl: true,
              embedSourceType: true,
              sourceStatus: true,
              sourceCode: true,
              streamUrl: true,
              streamContentType: true,
              title: true,
              description: true,
              fetchedAt: true,
              lastSyncedAt: true,
            },
          },
        },
      }),
    null
  );
});

export async function getPreviousRaceVideoRunners(raceId: string) {
  const currentRace = await safeQuery(
    () =>
      prisma.race.findUnique({
        where: { id: raceId },
        select: {
          raceTime: true,
          runners: { select: { dogId: true } },
        },
      }),
    null
  );
  if (!currentRace) return [];

  const dogIds = [...new Set(currentRace.runners.map((runner) => runner.dogId))];
  if (dogIds.length === 0) return [];

  return safeQuery(
    () =>
      prisma.runner.findMany({
        where: {
          dogId: { in: dogIds },
          raceId: { not: raceId },
          race: {
            raceTime: { lt: currentRace.raceTime },
            OR: [{ replayUrl: { not: null } }, { videos: { some: {} } }],
          },
        },
        orderBy: { race: { raceTime: "desc" } },
        take: 24,
        include: {
          dog: { select: { name: true } },
          result: true,
          race: {
            include: {
              meeting: { include: { track: true } },
              videos: {
                orderBy: { fetchedAt: "desc" },
                select: {
                  id: true,
                  sourceProvider: true,
                  sourceId: true,
                  kind: true,
                  pageUrl: true,
                  embedSourceType: true,
                  sourceStatus: true,
                  sourceCode: true,
                  streamUrl: true,
                  streamContentType: true,
                  title: true,
                  description: true,
                  fetchedAt: true,
                  lastSyncedAt: true,
                },
              },
            },
          },
        },
      }),
    []
  );
}

// Minimal payload: only the fields the search dropdown renders. Heavy relations
// (form entries, runners, ownership) stay on the profile page.
const dogSearchSelect = {
  id: true,
  name: true,
  colour: true,
  sex: true,
  careerStarts: true,
  careerWins: true,
  prizeMoney: true,
  trainer: { select: { name: true } },
  sire: { select: { name: true } },
  dam: { select: { name: true } },
} as const satisfies Prisma.DogSelect;

type DogSearchResult = Prisma.DogGetPayload<{ select: typeof dogSearchSelect }> & {
  _count: { formEntries: number };
};

export async function searchDogs(
  query: string,
  limit = 20
): Promise<DogSearchResult[]> {
  const trimmed = query?.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!trimmed) return [];

  // 1-2 char prefixes are the hottest autocomplete keystrokes and the slowest
  // (widest match set). There are only ~a few thousand distinct short prefixes
  // and the result is identical for every user, so cache them for a minute.
  if (trimmed.length < 3) {
    return cached(`dogsearch:${trimmed.toLowerCase()}:${limit}`, 60_000, () =>
      runDogSearch(trimmed, limit)
    );
  }
  return runDogSearch(trimmed, limit);
}

async function runDogSearch(
  trimmed: string,
  limit: number
): Promise<DogSearchResult[]> {
  const prefixPattern = `${escapeLikePattern(trimmed)}%`;

  // pg_trgm needs 3+ chars to be index-useful; a 1-2 char "%x%" contains scan
  // would seq-scan 200k+ rows. For short queries do a case-insensitive prefix
  // match on lower(name), served by Dog_lower_name_prefix_idx (text_pattern_ops)
  // — fast, ordered, and what "filter as you type" wants (type "b" -> B dogs).
  const ranked =
    trimmed.length < 3
      ? await safeQuery(
          () =>
            prisma.$queryRaw<{ id: string }[]>`
              SELECT d.id
              FROM "Dog" d
              WHERE lower(d.name) LIKE lower(${prefixPattern}) ESCAPE '\\'
                AND EXISTS (SELECT 1 FROM "Runner" r WHERE r."dogId" = d.id)
              ORDER BY d.name ASC
              LIMIT ${limit}
            `,
          []
        )
      : await searchDogsTrigram(trimmed, prefixPattern, limit);

  if (ranked.length === 0) return [];
  const ids = ranked.map((row) => row.id);

  // Form counts fetched separately: Prisma's relation _count compiles to a
  // GROUP BY over the whole 5.6M-row FormEntry table joined back in (the
  // planner cannot push the id filter into the grouped subquery, ~5s). A
  // groupBy restricted to the matched ids is an indexed millisecond query.
  const [dogs, formCounts] = await Promise.all([
    safeQuery(
      () =>
        prisma.dog.findMany({
          where: { id: { in: ids } },
          select: dogSearchSelect,
        }),
      []
    ),
    safeQuery(
      () =>
        prisma.formEntry.groupBy({
          by: ["dogId"],
          where: { dogId: { in: ids } },
          _count: { _all: true },
        }),
      []
    ),
  ]);

  const countByDogId = new Map(
    formCounts.map((row) => [row.dogId, row._count._all])
  );
  const byId = new Map(
    dogs.map((dog) => [
      dog.id,
      { ...dog, _count: { formEntries: countByDogId.get(dog.id) ?? 0 } },
    ])
  );
  return ids
    .map((id) => byId.get(id))
    .filter((dog): dog is DogSearchResult => dog != null);
}

// 3+ char search: each whitespace word must appear anywhere in the name (AND);
// the trigram GIN index makes the ILIKE '%word%' scans index-assisted. Ranks
// exact-prefix first, then trigram similarity.
function searchDogsTrigram(
  trimmed: string,
  prefixPattern: string,
  limit: number
) {
  const words = trimmed.split(" ");
  const wordConditions = Prisma.join(
    words.map(
      (word) =>
        Prisma.sql`d.name ILIKE ${`%${escapeLikePattern(word)}%`} ESCAPE '\\'`
    ),
    " AND "
  );

  return safeQuery(
    () =>
      prisma.$queryRaw<{ id: string }[]>`
        SELECT d.id
        FROM "Dog" d
        WHERE ${wordConditions}
          AND EXISTS (SELECT 1 FROM "Runner" r WHERE r."dogId" = d.id)
        ORDER BY
          CASE WHEN d.name ILIKE ${prefixPattern} ESCAPE '\\' THEN 1 ELSE 0 END DESC,
          similarity(d.name, ${trimmed}) DESC,
          d.name ASC
        LIMIT ${limit}
      `,
    []
  );
}

const DOG_TALLY_TTL_MS = 10 * 60 * 1000;

export type DogSearchTallies = {
  dogs: number;
  races: number;
  results: number;
};

// Approximate row counts (pg_class.reltuples) for the dog-search landing page.
// Exact COUNT(*) over 5.6M+ rows is expensive; estimates are effectively free
// and accurate enough for a "national database" headline. Cached per instance.
export async function getDogSearchTallies(): Promise<DogSearchTallies> {
  return cached("dog-search-tallies", DOG_TALLY_TTL_MS, async () => {
    const counts = await getApproximateTableCounts(["Dog", "Race", "Result"]);
    return {
      dogs: counts.get("Dog") ?? 0,
      races: counts.get("Race") ?? 0,
      results: counts.get("Result") ?? 0,
    };
  });
}

export const getDogById = cache(async (id: string) => {
  return safeQuery(
    () =>
      prisma.dog.findUnique({
        where: { id },
        include: {
          trainer: true,
          sire: { include: { sire: true, dam: true } },
          dam: { include: { sire: true, dam: true } },
          formEntries: {
            orderBy: { date: "desc" },
            include: { track: true },
          },
          runners: {
            include: {
              race: {
                include: { meeting: { include: { track: true } } },
              },
              result: true,
            },
            orderBy: { createdAt: "desc" },
            take: 20,
          },
          ownership: {
            orderBy: [{ verified: "desc" }, { createdAt: "desc" }],
            include: {
              profile: {
                include: {
                  user: {
                    select: {
                      email: true,
                      subscriptionTier: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    null
  );
});

// The claimant's own ownership row for a dog, at ANY status. getDogById runs on
// the bare client (no request context), so RLS hides a claimant's pending/rejected
// row from it — this fetches it under the user's context so the claim UI can show
// pending/rejected state. Public/approved ownership still comes from getDogById.
export async function getMyDogOwnership(
  current: { dbUserId: string; profileId: string; profileRole: string; tier: string },
  dogId: string
) {
  return safeQuery(
    () =>
      withDbRequestContext(current, (tx) =>
        tx.dogOwnership.findUnique({
          where: { dogId_profileId: { dogId, profileId: current.profileId } },
          select: {
            id: true,
            role: true,
            status: true,
            rejectionReason: true,
          },
        })
      ),
    null
  );
}

export type DogPrizeMoney = {
  careerWon: number;
  // Winnings + count grouped by finishing position (only positions with a
  // non-null prizeMoneyWon somewhere in the dog's results).
  byPosition: { position: number; count: number; won: number }[];
};

// One aggregate + one grouped query over Result joined to Runner.dogId. Never
// loads rows into JS; both scans ride Runner_dogId_idx. Career figures are
// independent of the take:20 runners cap on getDogById.
export const getDogPrizeMoney = cache(
  async (dogId: string): Promise<DogPrizeMoney> => {
    const [total, grouped] = await Promise.all([
      safeQuery(
        () =>
          prisma.result.aggregate({
            where: { prizeMoneyWon: { not: null }, runner: { dogId } },
            _sum: { prizeMoneyWon: true },
          }),
        null
      ),
      safeQuery(
        () =>
          prisma.result.groupBy({
            by: ["finishingPosition"],
            where: {
              prizeMoneyWon: { not: null },
              finishingPosition: { not: null },
              runner: { dogId },
            },
            _sum: { prizeMoneyWon: true },
            _count: { _all: true },
            orderBy: { finishingPosition: "asc" },
          }),
        []
      ),
    ]);

    return {
      careerWon: total?._sum.prizeMoneyWon ?? 0,
      byPosition: grouped.map((row) => ({
        position: row.finishingPosition!,
        count: row._count._all,
        won: row._sum.prizeMoneyWon ?? 0,
      })),
    };
  }
);

type RecentResultsFilters = {
  date?: string | null;
  trackId?: string | null;
  limit?: number;
};

export async function getRecentResults(filters: RecentResultsFilters = {}) {
  // The unfiltered default view is identical for every visitor — cache it.
  if (!filters.date && !filters.trackId) {
    return cached("results:recent:default", 60_000, () =>
      fetchRecentResults(filters)
    );
  }
  return fetchRecentResults(filters);
}

async function fetchRecentResults(filters: RecentResultsFilters = {}) {
  const selectedDate = normaliseRaceDateInput(filters.date);
  const raceFilters: Prisma.RaceWhereInput[] = [
    { runners: { some: { result: { isNot: null } } } },
  ];
  if (selectedDate) {
    raceFilters.push({ raceTime: raceDateWindow(selectedDate) });
  }
  if (filters.trackId) {
    raceFilters.push({ meeting: { trackId: filters.trackId } });
  }

  return safeQuery(
    () =>
      prisma.race.findMany({
        where: { AND: raceFilters },
        include: {
          meeting: { include: { track: true } },
          runners: {
            where: { result: { isNot: null } },
            orderBy: { result: { finishingPosition: "asc" } },
            take: 3,
            include: {
              dog: {
                include: {
                  trainer: true,
                  formEntries: {
                    orderBy: { date: "desc" },
                    take: 7,
                  },
                },
              },
              trainer: true,
              result: true,
            },
          },
        },
        orderBy: { raceTime: "desc" },
        take: filters.limit ?? 50,
      }),
    []
  );
}

// Bounded to a recent window and cached: the previous versions aggregated the
// full 5.6M-row Result history (and a 4-level nested EXISTS for tracks) on
// every page view, which saturated the DB and hung /results.
const RESULT_FILTER_WINDOW_DAYS = 45;

export async function getResultFilterOptions() {
  return cached("results:filter-options", 5 * 60_000, async () => {
    const [tracks, dates] = await Promise.all([
      safeQuery(
        () =>
          prisma.$queryRaw<{ id: string; name: string; state: string }[]>`
            SELECT DISTINCT t.id, t.name, t.state
            FROM "Race" ra
            JOIN "Meeting" m ON m.id = ra."meetingId"
            JOIN "Track" t ON t.id = m."trackId"
            WHERE ra."raceTime" >= now() - make_interval(days => ${RESULT_FILTER_WINDOW_DAYS}::int)
              AND EXISTS (SELECT 1 FROM "Result" res WHERE res."raceId" = ra.id)
            ORDER BY t.state ASC, t.name ASC
          `,
        []
      ),
      safeQuery(
        () =>
          prisma.$queryRaw<{ date: string; races: number }[]>`
            SELECT to_char(((ra."raceTime" AT TIME ZONE 'UTC') AT TIME ZONE 'Australia/Sydney')::date, 'YYYY-MM-DD') AS date,
                   COUNT(ra.id)::int AS races
            FROM "Race" ra
            WHERE ra."raceTime" >= now() - make_interval(days => ${RESULT_FILTER_WINDOW_DAYS}::int)
              AND EXISTS (SELECT 1 FROM "Result" res WHERE res."raceId" = ra.id)
            GROUP BY 1
            ORDER BY 1 DESC
            LIMIT 30
          `,
        []
      ),
    ]);

    return { tracks, dates };
  });
}

export async function getUpcomingRaces(days = 7) {
  const now = new Date();
  now.setHours(0, 0, 0, 0); // include today's meetings even after some races have run
  const until = new Date();
  until.setDate(until.getDate() + days);
  until.setHours(23, 59, 59, 999);

  return safeQuery(
    () =>
      prisma.meeting.findMany({
        where: {
          meetingDate: { gte: now, lte: until },
        },
        include: {
          track: true,
          races: {
            orderBy: { raceTime: "asc" },
            include: { runners: true },
          },
        },
        orderBy: { meetingDate: "asc" },
      }),
    []
  );
}

export interface RaceExplorerFilters {
  date?: string | null;
  state?: string | null;
  q?: string | null;
  status?: string | null;
  sort?: string | null;
}

export async function getRaceExplorerData(filters: RaceExplorerFilters = {}) {
  // Default, unfiltered view is identical for every visitor — cache it for a
  // minute so the shared 8-race list + dataset stats aren't recomputed per
  // request. Any filter/search/date/state/sort bypasses the cache.
  const isDefaultView =
    !filters.date && !filters.state && !filters.q && !filters.status && !filters.sort;
  if (isDefaultView) {
    return cached("races:explorer:default", 60_000, () =>
      fetchRaceExplorerData(filters)
    );
  }
  return fetchRaceExplorerData(filters);
}

async function fetchRaceExplorerData(filters: RaceExplorerFilters = {}) {
  const [latestRace, states, datasetStats, recentRaceDates] = await Promise.all([
    safeQuery(
      () =>
        prisma.race.findFirst({
          orderBy: { raceTime: "desc" },
          select: { raceTime: true },
        }),
      null
    ),
    getRaceStates(),
    getDatasetStats(),
    getRecentRaceDates(),
  ]);

  const currentDate = formatRaceDateInput(new Date());
  const defaultDate =
    recentRaceDates.find((row) => row.date <= currentDate)?.date ??
    formatRaceDateInput(latestRace?.raceTime ?? new Date());
  const searchQuery = normaliseRaceSearchParam(filters.q);
  const dateScope = resolveRaceSearchDate(filters.date, searchQuery, defaultDate);
  const selectedDate = dateScope.selectedDate;
  const selectedState = states.includes(filters.state ?? "")
    ? filters.state ?? null
    : null;
  const selectedStatus = normaliseRaceStatusParam(filters.status);
  const selectedSort = normaliseRaceSortParam(filters.sort, Boolean(searchQuery));
  const { gte, lt } = dateScope.isGlobalSearch
    ? ALL_RACE_DATES_WINDOW
    : raceDateWindow(selectedDate);
  const rankedRaceIds = searchQuery
    ? await findRankedRaceSearchIds({
        query: searchQuery,
        selectedDate: dateScope.isGlobalSearch ? null : selectedDate,
        selectedState,
        selectedStatus,
        gte,
        lt,
      })
    : null;
  const searchFilter: Prisma.RaceWhereInput | null = searchQuery
    ? rankedRaceIds
      ? { id: { in: rankedRaceIds } }
      : raceSearchWhere(searchQuery, dateScope.isGlobalSearch ? null : selectedDate)
    : null;
  const baseRaceFilters: Prisma.RaceWhereInput[] = [
    { raceTime: { gte, lt } },
    raceStatusWhere(selectedStatus),
    ...(searchFilter ? [searchFilter] : []),
  ];
  const raceWhere: Prisma.RaceWhereInput = selectedState
    ? { AND: [...baseRaceFilters, { meeting: { track: { state: selectedState } } }] }
    : { AND: baseRaceFilters };
  const meetingWhere: Prisma.MeetingWhereInput = {
    races: { some: { AND: baseRaceFilters } },
    ...(selectedState ? { track: { state: selectedState } } : {}),
  };

  const rawMeetings = await getRaceExplorerMeetings(meetingWhere, raceWhere);
  const [dateSummary, replayRaces] = searchQuery
    ? await Promise.all([
        summarizeRaceExplorerMeetings(rawMeetings),
        Promise.resolve(replayRacesFromExplorerMeetings(rawMeetings)),
      ])
    : await Promise.all([
        getRaceDateSummary(raceWhere, meetingWhere),
        safeQuery(
          () =>
            prisma.race.findMany({
              where: {
                ...raceWhere,
                videos: { some: { streamUrl: { not: null } } },
              },
              orderBy: { raceTime: "desc" },
              take: 8,
              include: {
                meeting: { include: { track: true } },
                videos: {
                  where: { streamUrl: { not: null } },
                  orderBy: { fetchedAt: "desc" },
                  take: 1,
                },
              },
            }),
          []
        ),
      ]);
  const meetings = orderRaceExplorerMeetings(
    rawMeetings,
    rankedRaceIds,
    selectedSort
  );

  return {
    selectedDate,
    dateInputValue: dateScope.dateInputValue,
    isGlobalSearch: dateScope.isGlobalSearch,
    selectedState,
    searchQuery,
    selectedStatus,
    selectedSort,
    states,
    datasetStats,
    recentRaceDates,
    dateSummary,
    meetings,
    replayRaces,
  };
}

type RaceExplorerMeeting = {
  id: string;
  meetingDate: Date;
  sourceProvider: string | null;
  track: {
    id: string;
    name: string;
    state: string;
    hasIsolynx: boolean;
  };
  races: RaceExplorerRace[];
};

type RaceExplorerRace = {
  id: string;
  raceNumber: number;
  raceTime: Date;
  distance: number;
  grade: string | null;
  _count: { runners: number };
  videos: {
    id: string;
    streamUrl: string | null;
    sourceStatus: number | null;
  }[];
};

async function getRaceExplorerMeetings(
  meetingWhere: Prisma.MeetingWhereInput,
  raceWhere: Prisma.RaceWhereInput
) {
  return safeQuery(async (): Promise<RaceExplorerMeeting[]> => {
    const meetings = await prisma.meeting.findMany({
      where: meetingWhere,
      select: {
        id: true,
        meetingDate: true,
        sourceProvider: true,
        track: {
          select: {
            id: true,
            name: true,
            state: true,
            hasIsolynx: true,
          },
        },
      },
      orderBy: [{ track: { state: "asc" } }, { track: { name: "asc" } }],
    });
    if (meetings.length === 0) return [];

    const meetingIds = meetings.map((meeting) => meeting.id);
    const races = await prisma.race.findMany({
      where: { AND: [raceWhere, { meetingId: { in: meetingIds } }] },
      orderBy: { raceTime: "asc" },
      select: {
        id: true,
        meetingId: true,
        raceNumber: true,
        raceTime: true,
        distance: true,
        grade: true,
      },
    });
    if (races.length === 0) {
      return meetings.map((meeting) => ({ ...meeting, races: [] }));
    }

    const raceIds = races.map((race) => race.id);
    const [runnerCounts, videos] = await Promise.all([
      prisma.runner.groupBy({
        by: ["raceId"],
        where: { raceId: { in: raceIds } },
        _count: { _all: true },
      }),
      prisma.raceVideo.findMany({
        where: { raceId: { in: raceIds } },
        orderBy: { fetchedAt: "desc" },
        select: {
          id: true,
          raceId: true,
          streamUrl: true,
          sourceStatus: true,
        },
      }),
    ]);

    const runnersByRace = new Map(
      runnerCounts.map((row) => [row.raceId, row._count._all])
    );
    const videosByRace = new Map<string, RaceExplorerRace["videos"]>();
    for (const video of videos) {
      const raceVideos = videosByRace.get(video.raceId) ?? [];
      raceVideos.push({
        id: video.id,
        streamUrl: video.streamUrl,
        sourceStatus: video.sourceStatus,
      });
      videosByRace.set(video.raceId, raceVideos);
    }

    const racesByMeeting = new Map<string, RaceExplorerRace[]>();
    for (const race of races) {
      const meetingRaces = racesByMeeting.get(race.meetingId) ?? [];
      meetingRaces.push({
        id: race.id,
        raceNumber: race.raceNumber,
        raceTime: race.raceTime,
        distance: race.distance,
        grade: race.grade,
        _count: { runners: runnersByRace.get(race.id) ?? 0 },
        videos: videosByRace.get(race.id) ?? [],
      });
      racesByMeeting.set(race.meetingId, meetingRaces);
    }

    return meetings.map((meeting) => ({
      ...meeting,
      races: racesByMeeting.get(meeting.id) ?? [],
    }));
  }, []);
}

async function getRaceStates() {
  if (raceStatesCache && raceStatesCache.expiresAt > Date.now()) {
    return raceStatesCache.value;
  }
  const value = await loadRaceStates();
  raceStatesCache = {
    expiresAt: Date.now() + RACE_EXPLORER_META_TTL_MS,
    value,
  };
  return value;
}

async function loadRaceStates() {
  const rows = await safeQuery(
    () =>
      prisma.track.findMany({
        distinct: ["state"],
        select: { state: true },
        orderBy: { state: "asc" },
      }),
    []
  );
  return rows.map((row) => row.state).filter(Boolean);
}

async function getDatasetStats() {
  if (datasetStatsCache && datasetStatsCache.expiresAt > Date.now()) {
    return datasetStatsCache.value;
  }
  const value = await loadDatasetStats();
  datasetStatsCache = {
    expiresAt: Date.now() + RACE_EXPLORER_META_TTL_MS,
    value,
  };
  return value;
}

async function loadDatasetStats() {
  const fallback = {
    races: 0,
    runners: 0,
    results: 0,
    dogs: 0,
    dogProfileForms: 0,
    videos: 0,
    videosWithStream: 0,
    latestRaceTime: null as string | null,
  };
  return safeQuery(async () => {
    const [tableCounts, videosWithStream, latestRace] = await Promise.all([
      getApproximateTableCounts([
        "Race",
        "Runner",
        "Result",
        "Dog",
        "DogProfileForm",
        "RaceVideo",
      ]),
      prisma.raceVideo.count({ where: { streamUrl: { not: null } } }),
      prisma.race.findFirst({
        orderBy: { raceTime: "desc" },
        select: { raceTime: true },
      }),
    ]);

    return {
      races: tableCounts.get("Race") ?? 0,
      runners: tableCounts.get("Runner") ?? 0,
      results: tableCounts.get("Result") ?? 0,
      dogs: tableCounts.get("Dog") ?? 0,
      dogProfileForms: tableCounts.get("DogProfileForm") ?? 0,
      videos: tableCounts.get("RaceVideo") ?? 0,
      videosWithStream,
      latestRaceTime: latestRace?.raceTime.toISOString() ?? null,
    };
  }, fallback);
}

async function getRecentRaceDates() {
  if (recentRaceDatesCache && recentRaceDatesCache.expiresAt > Date.now()) {
    return recentRaceDatesCache.value;
  }
  const value = await loadRecentRaceDates();
  recentRaceDatesCache = {
    expiresAt: Date.now() + RACE_EXPLORER_META_TTL_MS,
    value,
  };
  return value;
}

async function loadRecentRaceDates() {
  const rows = await safeQuery(
    () =>
      prisma.$queryRaw<{ date: string; races: number }[]>`
        SELECT to_char(((r."raceTime" AT TIME ZONE 'UTC') AT TIME ZONE 'Australia/Sydney')::date, 'YYYY-MM-DD') AS date,
               COUNT(*)::int AS races
        FROM "Race" r
        GROUP BY 1
        ORDER BY 1 DESC
        LIMIT 90
      `,
    []
  );

  return rows.map((row) => ({
    date: row.date,
    races: row.races,
  }));
}

async function getRaceDateSummary(
  raceWhere: Prisma.RaceWhereInput,
  meetingWhere: Prisma.MeetingWhereInput
) {
  const fallback = {
    meetings: 0,
    races: 0,
    runners: 0,
    results: 0,
    videos: 0,
    videosWithStream: 0,
  };

  return safeQuery(async () => {
    const [meetings, races, runners, results, videos, videosWithStream] =
      await Promise.all([
        prisma.meeting.count({ where: meetingWhere }),
        prisma.race.count({ where: raceWhere }),
        prisma.runner.count({ where: { race: raceWhere } }),
        prisma.result.count({ where: { runner: { race: raceWhere } } }),
        prisma.raceVideo.count({ where: { race: raceWhere } }),
        prisma.raceVideo.count({
          where: { race: raceWhere, streamUrl: { not: null } },
        }),
      ]);

    return { meetings, races, runners, results, videos, videosWithStream };
  }, fallback);
}

async function summarizeRaceExplorerMeetings(
  meetings: {
    races: {
      id: string;
      _count?: { runners: number };
      videos?: { streamUrl: string | null }[];
    }[];
  }[]
) {
  const raceIds = meetings.flatMap((meeting) =>
    meeting.races.map((race) => race.id)
  );
  const results = raceIds.length
    ? await safeQuery(
        () => prisma.result.count({ where: { raceId: { in: raceIds } } }),
        0
      )
    : 0;

  return meetings.reduce(
    (summary, meeting) => {
      summary.meetings += 1;
      summary.races += meeting.races.length;
      for (const race of meeting.races) {
        summary.runners += race._count?.runners ?? 0;
        summary.videos += race.videos?.length ?? 0;
        summary.videosWithStream +=
          race.videos?.filter((video) => video.streamUrl).length ?? 0;
      }
      return summary;
    },
    {
      meetings: 0,
      races: 0,
      runners: 0,
      results,
      videos: 0,
      videosWithStream: 0,
    }
  );
}

function replayRacesFromExplorerMeetings<
  T extends {
    id: string;
    meetingDate: Date;
    track: { name: string; state: string | null };
    races: R[];
  },
  R extends {
    id: string;
    raceNumber: number;
    raceTime: Date;
    distance: number;
    grade: string | null;
    videos?: { streamUrl: string | null }[];
  },
>(meetings: T[]) {
  return meetings
    .flatMap((meeting) =>
      meeting.races
        .filter((race) => race.videos?.some((video) => video.streamUrl))
        .map((race) => ({
          ...race,
          meeting: {
            id: meeting.id,
            meetingDate: meeting.meetingDate,
            track: meeting.track,
          },
        }))
    )
    .sort((a, b) => b.raceTime.getTime() - a.raceTime.getTime())
    .slice(0, 8);
}

type RaceStatusFilter = "all" | "upcoming" | "live" | "resulted" | "replay";
type RaceSort = "relevance" | "time";

const RACE_SEARCH_RESULT_LIMIT = 120;
const RACE_SEARCH_DOG_MATCH_LIMIT = 80;
const RACE_SEARCH_RUNNER_RESULT_LIMIT = 48;
const RACE_SEARCH_TRIGRAM_THRESHOLD = 0.3;
const ALL_RACE_DATES_WINDOW = {
  gte: new Date("1970-01-01T00:00:00.000Z"),
  lt: new Date("2100-01-01T00:00:00.000Z"),
};
const RACE_EXPLORER_META_TTL_MS = 60_000;

let raceStatesCache:
  | { expiresAt: number; value: Awaited<ReturnType<typeof loadRaceStates>> }
  | null = null;
let datasetStatsCache:
  | { expiresAt: number; value: Awaited<ReturnType<typeof loadDatasetStats>> }
  | null = null;
let recentRaceDatesCache:
  | { expiresAt: number; value: Awaited<ReturnType<typeof loadRecentRaceDates>> }
  | null = null;

function normaliseRaceSearchParam(value: string | null | undefined) {
  const trimmed = value?.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!trimmed) return null;
  if (trimmed.length < 2 && !/^\d$/.test(trimmed)) return null;
  return trimmed;
}

export function resolveRaceSearchDate(
  value: string | null | undefined,
  searchQuery: string | null,
  defaultDate: string
) {
  const explicitDate = normaliseRaceDateInput(value);
  return {
    selectedDate: explicitDate ?? defaultDate,
    dateInputValue: explicitDate ?? "",
    isGlobalSearch: Boolean(searchQuery && !explicitDate),
  };
}

function normaliseRaceStatusParam(
  value: string | null | undefined
): RaceStatusFilter {
  return value === "upcoming" ||
    value === "live" ||
    value === "resulted" ||
    value === "replay"
    ? value
    : "all";
}

function raceStatusWhere(status: RaceStatusFilter): Prisma.RaceWhereInput {
  const now = new Date();
  if (status === "upcoming") return { raceTime: { gt: now } };
  if (status === "live") {
    return {
      raceTime: {
        gte: new Date(now.getTime() - 20 * 60 * 1000),
        lte: now,
      },
    };
  }
  if (status === "resulted") {
    return { runners: { some: { result: { isNot: null } } } };
  }
  if (status === "replay") {
    return { videos: { some: { streamUrl: { not: null } } } };
  }
  return {};
}

function normaliseRaceSortParam(
  value: string | null | undefined,
  hasSearch: boolean
): RaceSort {
  if (value === "time") return "time";
  return hasSearch ? "relevance" : "time";
}

function raceSearchWhere(
  query: string,
  selectedDate: string | null
): Prisma.RaceWhereInput {
  const parsed = parseRaceSearchQuery(query);
  const filters: Prisma.RaceWhereInput[] = [];
  if (parsed.raceNumber !== null) filters.push({ raceNumber: parsed.raceNumber });
  if (parsed.distance !== null) filters.push({ distance: parsed.distance });
  if (parsed.clockTime && selectedDate) {
    filters.push({
      raceTime: raceClockTimeWindow(
        selectedDate,
        parsed.clockTime.hour,
        parsed.clockTime.minute
      ),
    });
  }

  const insensitive = "insensitive" as const;
  if (parsed.text) {
    filters.push({
      OR: [
        { name: { contains: parsed.text, mode: insensitive } },
        { grade: { contains: parsed.text, mode: insensitive } },
        { meeting: { track: { name: { contains: parsed.text, mode: insensitive } } } },
        { meeting: { track: { state: { contains: parsed.text, mode: insensitive } } } },
        { runners: { some: { dog: { name: { contains: parsed.text, mode: insensitive } } } } },
      ],
    });
  }

  return filters.length > 1 ? { AND: filters } : filters[0] ?? {};
}

async function findRankedRaceSearchIds({
  query,
  selectedDate,
  selectedState,
  selectedStatus,
  gte,
  lt,
}: {
  query: string;
  selectedDate: string | null;
  selectedState: string | null;
  selectedStatus: RaceStatusFilter;
  gte: Date;
  lt: Date;
}) {
  const parsed = parseRaceSearchQuery(query);
  const textQuery = parsed.text ?? query;
  const likePattern = `%${escapeLikePattern(textQuery)}%`;
  const hasClockTime = Boolean(parsed.clockTime);
  const clockWindow = parsed.clockTime && selectedDate
    ? raceClockTimeWindow(
        selectedDate,
        parsed.clockTime.hour,
        parsed.clockTime.minute
      )
    : null;
  const clockLabel = parsed.clockTime
    ? `${String(parsed.clockTime.hour).padStart(2, "0")}:${String(
        parsed.clockTime.minute
      ).padStart(2, "0")}`
    : null;
  const hasTextQuery = Boolean(parsed.text);
  const liveGte = new Date(Date.now() - 20 * 60 * 1000);
  const now = new Date();

  const globalRunnerRows = selectedDate
    ? null
    : await findRunnerRaceSearchIds({
        parsed,
        textQuery,
        selectedDate,
        selectedState,
        selectedStatus,
        gte,
        lt,
      });

  if (globalRunnerRows?.length) {
    return globalRunnerRows;
  }

  const fieldRows = await safeQuery(
    () =>
      prisma.$queryRaw<{ id: string }[]>`
        WITH field_race AS (
          SELECT
            r.id,
            r."raceTime",
            CASE WHEN COALESCE(r.name, '') ILIKE ${likePattern} ESCAPE '\\' THEN 1 ELSE 0 END AS race_name_match,
            CASE WHEN t.name ILIKE ${likePattern} ESCAPE '\\' THEN 1 ELSE 0 END AS track_match,
            CASE WHEN t.state ILIKE ${likePattern} ESCAPE '\\' THEN 1 ELSE 0 END AS state_match,
            CASE WHEN COALESCE(r.grade, '') ILIKE ${likePattern} ESCAPE '\\' THEN 1 ELSE 0 END AS grade_match,
            CASE
              WHEN ${selectedDate}::text IS NOT NULL
                AND to_tsvector(
                'simple',
                concat_ws(' ', COALESCE(r.name, ''), COALESCE(r.grade, ''), t.name, t.state)
              ) @@ websearch_to_tsquery('simple', ${textQuery})
              THEN 1 ELSE 0
            END AS text_match,
            CASE WHEN ${parsed.raceNumber}::int IS NOT NULL AND r."raceNumber" = ${parsed.raceNumber}::int THEN 1 ELSE 0 END AS race_number_match,
            CASE WHEN ${parsed.distance}::int IS NOT NULL AND r.distance = ${parsed.distance}::int THEN 1 ELSE 0 END AS distance_match,
            CASE
              WHEN ${Boolean(clockWindow)}
                AND r."raceTime" >= ${clockWindow?.gte ?? gte}
                AND r."raceTime" < ${clockWindow?.lt ?? lt}
              THEN 1
              WHEN ${clockLabel}::text IS NOT NULL
                AND to_char(((r."raceTime" AT TIME ZONE 'UTC') AT TIME ZONE 'Australia/Sydney'), 'HH24:MI') = ${clockLabel}
              THEN 1 ELSE 0
            END AS time_match,
            CASE
              WHEN ${selectedStatus} = 'resulted'
              THEN EXISTS (
                SELECT 1 FROM "Runner" rr
                JOIN "Result" res ON res."runnerId" = rr.id
                WHERE rr."raceId" = r.id
              )
              ELSE false
            END AS has_results,
            CASE
              WHEN ${selectedStatus} = 'replay'
              THEN EXISTS (
                SELECT 1 FROM "RaceVideo" rv
                WHERE rv."raceId" = r.id
                  AND (
                    rv."streamUrl" IS NOT NULL
                    OR rv."pageUrl" IS NOT NULL
                    OR rv."sourceId" IS NOT NULL
                  )
              )
              ELSE false
            END AS has_replay
          FROM "Race" r
          JOIN "Meeting" m ON m.id = r."meetingId"
          JOIN "Track" t ON t.id = m."trackId"
          WHERE r."raceTime" >= ${gte}
            AND r."raceTime" < ${lt}
            AND (${selectedState}::text IS NULL OR t.state = ${selectedState})
        )
        SELECT id
        FROM field_race
        WHERE
          (${selectedStatus} = 'all'
            OR (${selectedStatus} = 'upcoming' AND "raceTime" > ${now})
            OR (${selectedStatus} = 'live' AND "raceTime" >= ${liveGte} AND "raceTime" <= ${now})
            OR (${selectedStatus} = 'resulted' AND has_results)
            OR (${selectedStatus} = 'replay' AND has_replay))
          AND (${parsed.raceNumber}::int IS NULL OR race_number_match = 1)
          AND (${parsed.distance}::int IS NULL OR distance_match = 1)
          AND (NOT ${hasClockTime} OR time_match = 1)
          AND (
            NOT ${hasTextQuery}
            OR race_name_match = 1
            OR track_match = 1
            OR state_match = 1
            OR grade_match = 1
            OR text_match = 1
          )
        ORDER BY
          track_match DESC,
          race_number_match DESC,
          distance_match DESC,
          time_match DESC,
          text_match DESC,
          CASE WHEN ${selectedDate}::text IS NULL THEN "raceTime" END DESC,
          race_name_match DESC,
          state_match DESC,
          grade_match DESC,
          CASE WHEN ${selectedDate}::text IS NOT NULL THEN "raceTime" END ASC
        LIMIT ${RACE_SEARCH_RESULT_LIMIT}
      `,
    null
  );

  if (fieldRows?.length) {
    return fieldRows.map((row) => row.id);
  }

  if (globalRunnerRows && globalRunnerRows.length === 0) {
    return [];
  }

  const runnerRows = selectedDate
    ? await findRunnerRaceSearchIds({
        parsed,
        textQuery,
        selectedDate,
        selectedState,
        selectedStatus,
        gte,
        lt,
      })
    : null;

  if (runnerRows?.length) {
    return runnerRows;
  }

  const exactRows = await safeQuery(
    () =>
      prisma.$queryRaw<{ id: string }[]>`
        WITH exact_race AS (
          SELECT
            r.id,
            r."raceTime",
            CASE WHEN COALESCE(r.name, '') ILIKE ${likePattern} ESCAPE '\\' THEN 1 ELSE 0 END AS race_name_match,
            CASE WHEN t.name ILIKE ${likePattern} ESCAPE '\\' THEN 1 ELSE 0 END AS track_match,
            CASE WHEN t.state ILIKE ${likePattern} ESCAPE '\\' THEN 1 ELSE 0 END AS state_match,
            CASE WHEN COALESCE(r.grade, '') ILIKE ${likePattern} ESCAPE '\\' THEN 1 ELSE 0 END AS grade_match,
            CASE
              WHEN to_tsvector(
                'simple',
                concat_ws(' ', COALESCE(r.name, ''), COALESCE(r.grade, ''), t.name, t.state)
              ) @@ websearch_to_tsquery('simple', ${textQuery})
              THEN 1 ELSE 0
            END AS text_match,
            CASE WHEN ${parsed.raceNumber}::int IS NOT NULL AND r."raceNumber" = ${parsed.raceNumber}::int THEN 1 ELSE 0 END AS race_number_match,
            CASE WHEN ${parsed.distance}::int IS NOT NULL AND r.distance = ${parsed.distance}::int THEN 1 ELSE 0 END AS distance_match,
            CASE
              WHEN ${Boolean(clockWindow)}
                AND r."raceTime" >= ${clockWindow?.gte ?? gte}
                AND r."raceTime" < ${clockWindow?.lt ?? lt}
              THEN 1
              WHEN ${clockLabel}::text IS NOT NULL
                AND to_char(((r."raceTime" AT TIME ZONE 'UTC') AT TIME ZONE 'Australia/Sydney'), 'HH24:MI') = ${clockLabel}
              THEN 1 ELSE 0
            END AS time_match,
            CASE WHEN EXISTS (
              SELECT 1
              FROM "Runner" runner_match
              JOIN "Dog" runner_dog ON runner_dog.id = runner_match."dogId"
              WHERE runner_match."raceId" = r.id
                AND runner_dog.name ILIKE ${likePattern} ESCAPE '\\'
            ) THEN 1 ELSE 0 END AS runner_match,
            EXISTS (
              SELECT 1 FROM "Runner" rr
              JOIN "Result" res ON res."runnerId" = rr.id
              WHERE rr."raceId" = r.id
            ) AS has_results,
            EXISTS (
              SELECT 1 FROM "RaceVideo" rv
              WHERE rv."raceId" = r.id
                AND (
                  rv."streamUrl" IS NOT NULL
                  OR rv."pageUrl" IS NOT NULL
                  OR rv."sourceId" IS NOT NULL
                )
            ) AS has_replay
          FROM "Race" r
          JOIN "Meeting" m ON m.id = r."meetingId"
          JOIN "Track" t ON t.id = m."trackId"
          WHERE r."raceTime" >= ${gte}
            AND r."raceTime" < ${lt}
            AND (${selectedState}::text IS NULL OR t.state = ${selectedState})
        )
        SELECT id
        FROM exact_race
        WHERE
          (${selectedStatus} = 'all'
            OR (${selectedStatus} = 'upcoming' AND "raceTime" > ${now})
            OR (${selectedStatus} = 'live' AND "raceTime" >= ${liveGte} AND "raceTime" <= ${now})
            OR (${selectedStatus} = 'resulted' AND has_results)
            OR (${selectedStatus} = 'replay' AND has_replay))
          AND (${parsed.raceNumber}::int IS NULL OR race_number_match = 1)
          AND (${parsed.distance}::int IS NULL OR distance_match = 1)
          AND (NOT ${hasClockTime} OR time_match = 1)
          AND (
            NOT ${hasTextQuery}
            OR race_name_match = 1
            OR track_match = 1
            OR state_match = 1
            OR grade_match = 1
            OR text_match = 1
            OR runner_match = 1
          )
        ORDER BY
          track_match DESC,
          race_number_match DESC,
          distance_match DESC,
          time_match DESC,
          text_match DESC,
          CASE WHEN ${selectedDate}::text IS NULL THEN "raceTime" END DESC,
          runner_match DESC,
          race_name_match DESC,
          state_match DESC,
          grade_match DESC,
          CASE WHEN ${selectedDate}::text IS NOT NULL THEN "raceTime" END ASC
        LIMIT ${RACE_SEARCH_RESULT_LIMIT}
      `,
    null
  );

  if (exactRows?.length) {
    return exactRows.map((row) => row.id);
  }

  const rows = await safeQuery(
    () =>
      prisma.$queryRaw<{ id: string }[]>`
        WITH race_search AS (
          SELECT
            r.id,
            r."raceTime",
            r."raceNumber",
            r.distance,
            concat_ws(
              ' ',
              COALESCE(r.name, ''),
              COALESCE(r.grade, ''),
              t.name,
              t.state,
              'race ' || r."raceNumber"::text,
              'r' || r."raceNumber"::text,
              r.distance::text || 'm',
              to_char(((r."raceTime" AT TIME ZONE 'UTC') AT TIME ZONE 'Australia/Sydney'), 'HH24:MI')
            ) AS search_text,
            CASE WHEN COALESCE(r.name, '') ILIKE ${likePattern} ESCAPE '\\' THEN 1 ELSE 0 END AS race_name_match,
            CASE WHEN t.name ILIKE ${likePattern} ESCAPE '\\' THEN 1 ELSE 0 END AS track_match,
            CASE WHEN t.state ILIKE ${likePattern} ESCAPE '\\' THEN 1 ELSE 0 END AS state_match,
            CASE WHEN COALESCE(r.grade, '') ILIKE ${likePattern} ESCAPE '\\' THEN 1 ELSE 0 END AS grade_match,
            CASE WHEN EXISTS (
              SELECT 1
              FROM "Runner" runner_match
              JOIN "Dog" runner_dog ON runner_dog.id = runner_match."dogId"
              WHERE runner_match."raceId" = r.id
                AND runner_dog.name ILIKE ${likePattern} ESCAPE '\\'
            ) THEN 1 ELSE 0 END AS runner_match,
            GREATEST(
              similarity(COALESCE(r.name, ''), ${query}),
              similarity(t.name, ${query}),
              similarity(t.state, ${query}),
              similarity(COALESCE(r.grade, ''), ${query}),
              COALESCE((
                SELECT MAX(similarity(runner_dog.name, ${query}))
                FROM "Runner" runner_similarity
                JOIN "Dog" runner_dog ON runner_dog.id = runner_similarity."dogId"
                WHERE runner_similarity."raceId" = r.id
              ), 0)
            ) AS trigram_score,
            EXISTS (
              SELECT 1 FROM "Runner" rr
              JOIN "Result" res ON res."runnerId" = rr.id
              WHERE rr."raceId" = r.id
            ) AS has_results,
            EXISTS (
              SELECT 1 FROM "RaceVideo" rv
              WHERE rv."raceId" = r.id
                AND (
                  rv."streamUrl" IS NOT NULL
                  OR rv."pageUrl" IS NOT NULL
                  OR rv."sourceId" IS NOT NULL
                )
            ) AS has_replay
          FROM "Race" r
          JOIN "Meeting" m ON m.id = r."meetingId"
          JOIN "Track" t ON t.id = m."trackId"
          WHERE r."raceTime" >= ${gte}
            AND r."raceTime" < ${lt}
            AND (${selectedState}::text IS NULL OR t.state = ${selectedState})
        ),
        scored AS (
          SELECT
            *,
            to_tsvector('simple', search_text) AS text_vector,
            websearch_to_tsquery('simple', ${textQuery}) AS text_query,
            CASE WHEN ${parsed.raceNumber}::int IS NOT NULL AND "raceNumber" = ${parsed.raceNumber}::int THEN 1 ELSE 0 END AS race_number_match,
            CASE WHEN ${parsed.distance}::int IS NOT NULL AND distance = ${parsed.distance}::int THEN 1 ELSE 0 END AS distance_match,
            CASE
              WHEN ${Boolean(clockWindow)}
                AND "raceTime" >= ${clockWindow?.gte ?? gte}
                AND "raceTime" < ${clockWindow?.lt ?? lt}
              THEN 1
              WHEN ${clockLabel}::text IS NOT NULL
                AND to_char((("raceTime" AT TIME ZONE 'UTC') AT TIME ZONE 'Australia/Sydney'), 'HH24:MI') = ${clockLabel}
              THEN 1 ELSE 0
            END AS time_match
          FROM race_search
          WHERE
            ${selectedStatus} = 'all'
            OR (${selectedStatus} = 'upcoming' AND "raceTime" > ${now})
            OR (${selectedStatus} = 'live' AND "raceTime" >= ${liveGte} AND "raceTime" <= ${now})
            OR (${selectedStatus} = 'resulted' AND has_results)
            OR (${selectedStatus} = 'replay' AND has_replay)
        )
        SELECT id
        FROM scored
        WHERE
          (${parsed.raceNumber}::int IS NULL OR race_number_match = 1)
          AND (${parsed.distance}::int IS NULL OR distance_match = 1)
          AND (NOT ${hasClockTime} OR time_match = 1)
          AND (
            NOT ${hasTextQuery}
            OR race_name_match = 1
            OR track_match = 1
            OR state_match = 1
            OR grade_match = 1
            OR runner_match = 1
            OR text_vector @@ text_query
            OR trigram_score >= ${RACE_SEARCH_TRIGRAM_THRESHOLD}
          )
        ORDER BY
          track_match DESC,
          race_number_match DESC,
          distance_match DESC,
          time_match DESC,
          CASE
            WHEN ${selectedDate}::text IS NULL AND track_match = 1 THEN "raceTime"
          END DESC,
          (
            track_match * 90 +
            runner_match * 85 +
            race_name_match * 75 +
            state_match * 65 +
            grade_match * 55 +
            race_number_match * 50 +
            distance_match * 45 +
            time_match * 45
          ) DESC,
          CASE WHEN ${selectedDate}::text IS NULL THEN "raceTime" END DESC,
          ts_rank_cd(text_vector, text_query) DESC,
          trigram_score DESC,
          CASE WHEN ${selectedDate}::text IS NOT NULL THEN "raceTime" END ASC
        LIMIT ${RACE_SEARCH_RESULT_LIMIT}
      `,
    null
  );

  return rows?.map((row) => row.id) ?? null;
}

async function findRunnerRaceSearchIds({
  parsed,
  textQuery,
  selectedDate,
  selectedState,
  selectedStatus,
  gte,
  lt,
}: {
  parsed: ReturnType<typeof parseRaceSearchQuery>;
  textQuery: string;
  selectedDate: string | null;
  selectedState: string | null;
  selectedStatus: RaceStatusFilter;
  gte: Date;
  lt: Date;
}) {
  if (!parsed.text) return null;
  if (parsed.clockTime && !selectedDate) return null;

  const insensitive = "insensitive" as const;
  const dogRows = await safeQuery(
    () =>
      prisma.dog.findMany({
        where: {
          name: { contains: textQuery, mode: insensitive },
        },
        orderBy: { name: "asc" },
        select: { id: true },
        take: RACE_SEARCH_DOG_MATCH_LIMIT,
      }),
    []
  );
  if (dogRows.length === 0) return [];

  const raceFilters: Prisma.RaceWhereInput[] = [
    { raceTime: { gte, lt } },
    raceStatusWhere(selectedStatus),
  ];
  if (selectedState) {
    raceFilters.push({ meeting: { track: { state: selectedState } } });
  }
  if (parsed.raceNumber !== null) {
    raceFilters.push({ raceNumber: parsed.raceNumber });
  }
  if (parsed.distance !== null) {
    raceFilters.push({ distance: parsed.distance });
  }
  if (parsed.clockTime && selectedDate) {
    raceFilters.push({
      raceTime: raceClockTimeWindow(
        selectedDate,
        parsed.clockTime.hour,
        parsed.clockTime.minute
      ),
    });
  }

  const rows = await safeQuery(
    () =>
      prisma.runner.findMany({
        where: {
          dogId: { in: dogRows.map((dog) => dog.id) },
          race: { AND: raceFilters },
        },
        orderBy: {
          race: {
            raceTime: selectedDate ? "asc" : "desc",
          },
        },
        select: { raceId: true },
        take: RACE_SEARCH_RUNNER_RESULT_LIMIT * 2,
      }),
    []
  );

  const raceIds: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.raceId)) continue;
    seen.add(row.raceId);
    raceIds.push(row.raceId);
    if (raceIds.length >= RACE_SEARCH_RUNNER_RESULT_LIMIT) break;
  }

  return raceIds;
}

function orderRaceExplorerMeetings<
  T extends {
    track: { name: string; state: string | null };
    races: { id: string; raceTime: Date }[];
  },
>(meetings: T[], rankedRaceIds: string[] | null, sort: RaceSort): T[] {
  const uniqueMeetings = dedupeExactMeetingMatches(meetings);
  if (!rankedRaceIds || sort !== "relevance") {
    return orderMeetingsByFirstRaceTime(uniqueMeetings);
  }
  const rank = new Map(rankedRaceIds.map((id, index) => [id, index]));
  const raceRank = (race: { id: string; raceTime: Date }) =>
    rank.get(race.id) ?? Number.MAX_SAFE_INTEGER;
  const meetingRank = (meeting: T) =>
    Math.min(...meeting.races.map(raceRank), Number.MAX_SAFE_INTEGER);

  return uniqueMeetings
    .map((meeting) => ({
      ...meeting,
      track: {
        ...meeting.track,
        name: canonicalTrackName(meeting.track.name),
      },
      races: [...meeting.races].sort(
        (a, b) => raceRank(a) - raceRank(b) || a.raceTime.getTime() - b.raceTime.getTime()
      ),
    }))
    .sort(
      (a, b) =>
        meetingRank(a) - meetingRank(b) ||
        String(a.track.state).localeCompare(String(b.track.state)) ||
        a.track.name.localeCompare(b.track.name)
    ) as T[];
}

export function orderMeetingsByFirstRaceTime<
  T extends {
    sourceProvider?: string | null;
    track: { name: string; state: string | null };
    races: { raceTime: Date; raceNumber?: number; distance?: number }[];
  },
>(meetings: T[]): T[] {
  return dedupeExactMeetingMatches(meetings)
    .map((meeting) => ({
      ...meeting,
      track: {
        ...meeting.track,
        name: canonicalTrackName(meeting.track.name),
      },
      races: [...meeting.races].sort(
        (a, b) => a.raceTime.getTime() - b.raceTime.getTime()
      ),
    }))
    .sort(
      (a, b) =>
        firstRaceTime(a) - firstRaceTime(b) ||
        String(a.track.state).localeCompare(String(b.track.state)) ||
        a.track.name.localeCompare(b.track.name)
    ) as T[];
}

function firstRaceTime(meeting: { races: { raceTime: Date }[] }) {
  return meeting.races[0]?.raceTime.getTime() ?? Number.MAX_SAFE_INTEGER;
}

function dedupeExactMeetingMatches<
  T extends {
    sourceProvider?: string | null;
    track: { name: string; state: string | null };
    races: { raceTime: Date; raceNumber?: number; distance?: number }[];
  },
>(meetings: T[]) {
  const bySignature = new Map<string, T>();
  for (const meeting of meetings) {
    const existing = bySignature.get(meetingSignature(meeting));
    if (!existing || providerScore(meeting.sourceProvider) > providerScore(existing.sourceProvider)) {
      bySignature.set(meetingSignature(meeting), meeting);
    }
  }
  return [...bySignature.values()];
}

function meetingSignature(meeting: {
  track: { name: string; state: string | null };
  races: { raceTime: Date; raceNumber?: number; distance?: number }[];
}) {
  const raceSignature = [...meeting.races]
    .sort((a, b) => a.raceTime.getTime() - b.raceTime.getTime())
    .map(
      (race) =>
        `${race.raceNumber ?? ""}:${race.raceTime.toISOString()}:${race.distance ?? ""}`
    )
    .join("|");
  return [
    trackNameAliasKey(canonicalTrackName(meeting.track.name)),
    meeting.track.state ?? "",
    raceSignature,
  ].join(":");
}

function providerScore(provider: string | null | undefined) {
  if (provider === "thedogs") return 3;
  if (provider === "topaz") return 2;
  if (provider === "watchdog") return 1;
  return 0;
}

export function parseRaceSearchQuery(query: string) {
  const raceNumber = raceNumberFromSearch(query);
  const distance = distanceFromSearch(query);
  const clockTime = clockTimeFromSearch(query);
  const text = structuredSearchText(query, {
    raceNumber,
    distance,
    clockTime,
  });

  return { raceNumber, distance, clockTime, text };
}

function raceNumberFromSearch(query: string) {
  const labelled = /\b(?:race\s*|r)(\d{1,2})\b/i.exec(query);
  if (labelled) return Number(labelled[1]);
  const exact = /^(\d{1,2})$/i.exec(query.trim());
  return exact ? Number(exact[1]) : null;
}

function distanceFromSearch(query: string) {
  const match = /\b(\d{3,4})\s*m\b/i.exec(query);
  if (match) return Number(match[1]);
  const exact = /^(\d{3,4})$/i.exec(query.trim());
  return exact ? Number(exact[1]) : null;
}

function clockTimeFromSearch(query: string) {
  const twentyFourHour = /\b(?:at\s*)?([01]?\d|2[0-3]):([0-5]\d)\b/.exec(query);
  if (twentyFourHour) {
    return {
      hour: Number(twentyFourHour[1]),
      minute: Number(twentyFourHour[2]),
    };
  }

  const meridiem = /\b(?:at\s*)?(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*([ap])m?\b/i.exec(query);
  if (!meridiem) return null;
  const hour = Number(meridiem[1]) % 12;
  return {
    hour: meridiem[3].toLowerCase() === "p" ? hour + 12 : hour,
    minute: Number(meridiem[2] ?? 0),
  };
}

function structuredSearchText(
  query: string,
  parsed: {
    raceNumber: number | null;
    distance: number | null;
    clockTime: { hour: number; minute: number } | null;
  }
) {
  let text = query.trim();
  if (parsed.raceNumber !== null) {
    text = text.replace(/\b(?:race\s*|r)\d{1,2}\b/gi, " ");
    if (/^\d{1,2}$/.test(text.trim())) text = "";
  }
  if (parsed.distance !== null) {
    text = text.replace(/\b\d{3,4}\s*m\b/gi, " ");
    if (/^\d{3,4}$/.test(text.trim())) text = "";
  }
  if (parsed.clockTime) {
    text = text
      .replace(/\b(?:at\s*)?(?:[01]?\d|2[0-3]):[0-5]\d\b/g, " ")
      .replace(/\b(?:at\s*)?(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*[ap]m?\b/gi, " ");
  }
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length >= 2 ? trimmed : null;
}

const ACTIVE_TRACK_WINDOW_DAYS = 35;
const TRACKS_PAGE_EXCLUDED_NAMES = [
  "Albion Park",
  "Ashburton",
  "AUCKLAND",
  "Broken Hill",
  "Bundaberg",
  "Cambridge",
  "Christchurch",
  "Dapto",
  "Devonport",
  "Ipswich",
  "Manawatu",
  "MANUKAU",
  "Muswellbrook",
  "OTAGO",
  "Palmerston - North",
  "Potts Park",
  "Southland",
  "Waikato",
  "Wanganui",
  "WELLINGTON",
] as const;

function activeTrackWindow(now = new Date()) {
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - ACTIVE_TRACK_WINDOW_DAYS);
  from.setUTCHours(0, 0, 0, 0);

  const to = new Date(now);
  to.setUTCDate(to.getUTCDate() + ACTIVE_TRACK_WINDOW_DAYS);
  to.setUTCHours(23, 59, 59, 999);

  return { from, to };
}

export async function getActiveTracks() {
  const { from, to } = activeTrackWindow();
  const activeMeetingWhere = {
    meetingDate: { gte: from, lte: to },
    races: { some: {} },
  } satisfies Prisma.MeetingWhereInput;

  return safeQuery(
    () =>
      prisma.track.findMany({
        where: {
          name: { notIn: [...TRACKS_PAGE_EXCLUDED_NAMES] },
          meetings: { some: activeMeetingWhere },
        },
        orderBy: { name: "asc" },
        include: {
          _count: { select: { meetings: true } },
          meetings: {
            where: activeMeetingWhere,
            orderBy: { meetingDate: "desc" },
            take: 1,
            include: {
              races: {
                orderBy: { raceTime: "asc" },
                include: {
                  videos: {
                    take: 1,
                    select: { streamUrl: true },
                  },
                },
              },
            },
          },
        },
      }),
    []
  );
}

// === STATISTICS (computed from real results) ===

export interface BoxBiasRow {
  box: number;
  starts: number;
  wins: number;
  winRate: number;
}

export async function getBoxBias(): Promise<BoxBiasRow[]> {
  // Served from the giq_box_bias materialized view (hourly cron refresh, see
  // live/sync.ts). The inline aggregation scanned Result(5.6M) per view and
  // hung /statistics.
  const rows = await cached("stats:box-bias", 5 * 60_000, () =>
    safeQuery(
      () =>
        prisma.$queryRaw<{ box: number; starts: number; wins: number }[]>`
          SELECT box, starts, wins
          FROM giq_box_bias
          ORDER BY box ASC
        `,
      []
    )
  );
  return rows.map((r) => ({
    ...r,
    winRate: r.starts > 0 ? parseFloat(((r.wins / r.starts) * 100).toFixed(1)) : 0,
  }));
}

export interface TrainerLeaderRow {
  name: string;
  wins: number;
  starters: number;
  strike: number;
  roi: number;
}

export async function getTrainerLeaderboard(limit = 10): Promise<TrainerLeaderRow[]> {
  // Served from giq_trainer_leaderboard (hourly cron refresh, see live/sync.ts).
  const rows = await cached(`stats:trainer-leaderboard:${limit}`, 5 * 60_000, () =>
    safeQuery(
      () =>
        prisma.$queryRaw<
          { name: string; wins: number; starters: number; winsp: number }[]
        >`
          SELECT name, starters, wins, winsp
          FROM giq_trainer_leaderboard
          ORDER BY wins DESC
          LIMIT ${limit}
        `,
      []
    )
  );
  // ROI from flat $1 win bets at starting price: (returns - outlay) / outlay.
  return rows.map((r) => ({
    name: r.name,
    wins: r.wins,
    starters: r.starters,
    strike: r.starters > 0 ? parseFloat(((r.wins / r.starters) * 100).toFixed(1)) : 0,
    roi: r.starters > 0 ? parseFloat((((r.winsp - r.starters) / r.starters) * 100).toFixed(1)) : 0,
  }));
}

export interface TrackRecordRow {
  track: string;
  dist: number;
  time: number;
  dog: string;
  year: number;
}

export async function getTrackRecords(limit = 12): Promise<TrackRecordRow[]> {
  // Served from giq_track_records (hourly cron refresh, see live/sync.ts).
  return cached(`stats:track-records:${limit}`, 5 * 60_000, () =>
    safeQuery(
      () =>
        prisma.$queryRaw<TrackRecordRow[]>`
          SELECT track, dist, time, dog, year
          FROM giq_track_records
          ORDER BY track ASC, dist ASC
          LIMIT ${limit}
        `,
      []
    )
  );
}

// === BREEDING (computed from sire relations + results) ===

export interface SireLeaderRow {
  name: string;
  progeny: number;
  winners: number;
  strike: number;
  earnings: number;
}

export async function getSireLeaderboard(limit = 10): Promise<SireLeaderRow[]> {
  // Served from the giq_sire_leaderboard materialized view (refreshed hourly
  // by the live-sync results cron). The inline aggregation took 200s+ across
  // Dog x Runner(6.4M) x Result(5.6M) and hung /breeding.
  const rows = await cached(`breeding:sire-leaderboard:${limit}`, 5 * 60_000, () =>
    safeQuery(
      () =>
        prisma.$queryRaw<
          { name: string; progeny: number; winners: number; earnings: number }[]
        >`
          SELECT name, progeny, winners, earnings
          FROM giq_sire_leaderboard
          ORDER BY winners DESC, progeny DESC
          LIMIT ${limit}
        `,
      []
    )
  );
  return rows.map((r) => ({
    name: r.name,
    progeny: r.progeny,
    winners: r.winners,
    strike: r.progeny > 0 ? parseFloat(((r.winners / r.progeny) * 100).toFixed(1)) : 0,
    earnings: r.earnings,
  }));
}

export async function getTrackByName(name: string) {
  return safeQuery(
    () =>
      prisma.track.findFirst({
        where: { name: { contains: name } },
        include: {
          meetings: {
            orderBy: { meetingDate: "desc" },
            take: 5,
            include: { races: true },
          },
        },
      }),
    null
  );
}

export const getTrackById = cache(async (id: string) => {
  return safeQuery(
    () =>
      prisma.track.findUnique({
        where: { id },
        include: {
          meetings: {
            orderBy: { meetingDate: "desc" },
            take: 8,
            include: {
              races: {
                orderBy: { raceNumber: "asc" },
                include: {
                  runners: {
                    include: {
                      dog: true,
                      result: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    null
  );
});

export async function getForumOverview() {
  return safeQuery(
    () =>
      prisma.forumCategory.findMany({
        orderBy: { sortOrder: "asc" },
        include: {
          _count: { select: { threads: true } },
          threads: {
            orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
            take: 3,
            include: {
              author: true,
              _count: { select: { posts: true } },
            },
          },
        },
      }),
    []
  );
}

export async function getRecentThreads(limit = 8) {
  return safeQuery(
    () =>
      prisma.thread.findMany({
        orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
        take: limit,
        include: {
          category: true,
          author: true,
          _count: { select: { posts: true } },
        },
      }),
    []
  );
}

export const getForumCategoryBySlug = cache(async (slug: string) => {
  return safeQuery(
    () =>
      prisma.forumCategory.findUnique({
        where: { slug },
        include: {
          threads: {
            orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
            include: {
              author: true,
              _count: { select: { posts: true } },
              posts: {
                orderBy: { createdAt: "desc" },
                take: 1,
                include: { author: true },
              },
            },
          },
        },
      }),
    null
  );
});

export const getForumThreadById = cache(async (id: string) => {
  return safeQuery(
    () =>
      prisma.thread.findUnique({
        where: { id },
        include: {
          category: true,
          author: true,
          posts: {
            orderBy: { createdAt: "asc" },
            include: { author: true },
          },
          _count: { select: { posts: true } },
        },
      }),
    null
  );
});

export interface MarketplaceListingFilters {
  type?: string | null;
  categoryId?: string | null;
  categorySlug?: string | null;
  state?: string | null;
  dogId?: string | null;
  q?: string | null;
  status?: "active";
  sort?: "created_at" | "price" | "expires_at" | null;
}

const LISTING_SEARCH_CANDIDATE_LIMIT = 500;

// A seller's active, approved listings — powers the business-page storefront.
export function getActiveListingsForProfile(profileId: string, limit = 12) {
  return safeQuery(
    () =>
      prisma.listing.findMany({
        where: {
          profileId,
          status: "active",
          moderationStatus: "approved",
        },
        include: marketplaceListingCardInclude,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
    []
  );
}

export async function getMarketplaceListings(
  limit = 24,
  filters: MarketplaceListingFilters = {}
) {
  const cacheKey = marketplaceListingsCacheKey(limit, filters);
  const cached = marketplaceListingsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const pending = pendingMarketplaceListings.get(cacheKey);
  if (pending) return pending;

  const query = fetchMarketplaceListings(limit, filters).then((value) => {
    marketplaceListingsCache.set(cacheKey, {
      expiresAt: Date.now() + MARKETPLACE_LISTINGS_CACHE_MS,
      value,
    });
    return value;
  }).finally(() => {
    pendingMarketplaceListings.delete(cacheKey);
  });
  pendingMarketplaceListings.set(cacheKey, query);
  return query;
}

async function fetchMarketplaceListings(
  limit = 24,
  filters: MarketplaceListingFilters = {}
): Promise<MarketplaceListingCard[]> {
  const now = new Date();
  const where: Prisma.ListingWhereInput = {
    status: "active",
    moderationStatus: "approved",
    archivedAt: null,
    OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
  };

  if (filters.type) where.type = filters.type;
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.categorySlug) where.category = { slug: filters.categorySlug };
  if (filters.state) where.state = filters.state;
  if (filters.dogId) where.dogId = filters.dogId;

  const q = filters.q?.trim();
  let searchCandidateIds: string[] | null = null;
  if (q) {
    searchCandidateIds = await findMarketplaceListingSearchCandidates(
      q,
      Math.max(limit * 10, LISTING_SEARCH_CANDIDATE_LIMIT)
    );
    if (searchCandidateIds) {
      if (searchCandidateIds.length === 0) return [];
      where.id = { in: searchCandidateIds };
    } else {
      const textSearch = [
        { title: { contains: q } },
        { description: { contains: q } },
        { searchIndex: { searchText: { contains: q } } },
      ];
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        { OR: textSearch },
      ];
    }
  }

  const orderBy: Prisma.ListingOrderByWithRelationInput =
    filters.sort === "price"
      ? { price: "asc" }
      : filters.sort === "expires_at"
        ? { expiresAt: "asc" }
        : { createdAt: "desc" };

  const queryLimit = q && searchCandidateIds && !filters.sort
    ? Math.min(searchCandidateIds.length, Math.max(limit * 10, limit))
    : limit;
  const listings = await safeQuery(
    () =>
      prisma.listing.findMany({
        where,
        orderBy,
        take: queryLimit,
        include: marketplaceListingCardInclude,
      }),
    []
  );

  if (q && searchCandidateIds && !filters.sort) {
    const rank = new Map(
      searchCandidateIds.map((listingId, index) => [listingId, index])
    );
    return listings
      .toSorted(
        (a, b) =>
          (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
          (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER)
      )
      .slice(0, limit);
  }

  return listings;
}

function marketplaceListingsCacheKey(
  limit: number,
  filters: MarketplaceListingFilters
) {
  return JSON.stringify({
    limit,
    type: filters.type ?? null,
    categoryId: filters.categoryId ?? null,
    categorySlug: filters.categorySlug ?? null,
    state: filters.state ?? null,
    dogId: filters.dogId ?? null,
    q: filters.q?.trim() ?? null,
    status: filters.status ?? null,
    sort: filters.sort ?? null,
  });
}

async function findMarketplaceListingSearchCandidates(
  query: string,
  limit: number
) {
  const trimmed = query.trim().slice(0, 200);
  if (!trimmed) return null;
  const likePattern = `%${escapeLikePattern(trimmed)}%`;
  const bounded = Math.min(Math.max(Math.trunc(limit), 1), 1000);

  return safeQuery<string[] | null>(async () => {
    const rows = await prisma.$queryRaw<{ listingId: string }[]>`
      WITH search_query AS (
        SELECT websearch_to_tsquery('english', ${trimmed}) AS query
      )
      SELECT search_index."listingId" AS "listingId"
      FROM "ListingSearchIndex" search_index, search_query
      WHERE
        search_query.query @@ to_tsvector('english', COALESCE(search_index."searchText", ''))
        OR search_index."searchText" ILIKE ${likePattern} ESCAPE '\\'
      ORDER BY
        ts_rank_cd(
          to_tsvector('english', COALESCE(search_index."searchText", '')),
          search_query.query
        ) DESC,
        similarity(search_index."searchText", ${trimmed}) DESC,
        search_index."updatedAt" DESC
      LIMIT ${bounded}
    `;
    if (!Array.isArray(rows)) throw new Error("search.fts_unavailable");
    return rows.map((row) => row.listingId);
  }, null);
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export async function getMarketplaceCategories() {
  return safeQuery(
    () =>
      prisma.marketplaceCategory.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
    []
  );
}

export async function getDogsForListingSelect(limit = 80) {
  return safeQuery(
    () =>
      prisma.dog.findMany({
        orderBy: { name: "asc" },
        take: limit,
        select: {
          id: true,
          name: true,
          sire: { select: { name: true } },
          dam: { select: { name: true } },
        },
      }),
    []
  );
}

export async function getMessagingProfiles(
  current: DbContextUser,
  excludeEmail?: string,
  limit = 60,
  search?: string
) {
  const trimmedSearch = search?.trim();
  return safeQuery(
    () =>
      withDbRequestContext(current, (tx) => tx.profile.findMany({
        where: {
          user: {
            ...(excludeEmail ? { email: { not: excludeEmail } } : {}),
            isBanned: false,
            deletionRequestedAt: null,
          },
          ...(trimmedSearch
            ? {
                displayName: {
                  contains: trimmedSearch,
                  mode: "insensitive" as const,
                },
              }
            : {}),
        },
        orderBy: [{ verified: "desc" }, { displayName: "asc" }],
        take: limit,
        include: {
          user: {
            select: {
              email: true,
              subscriptionTier: true,
            },
          },
        },
      })),
    []
  );
}

export async function getMessagesForUserEmail(
  current: DbContextUser,
  email: string
) {
  const user = await safeQuery(
    () =>
      withDbRequestContext(current, (tx) => tx.user.findUnique({
        where: { email },
        include: { profile: true },
      })),
    null
  );

  if (!user?.profile) return [];

  return safeQuery(
    () =>
      withDbRequestContext(current, (tx) => tx.message.findMany({
        where: {
          OR: [
            { senderId: user.profile!.id },
            { recipientId: user.profile!.id },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          sender: true,
          recipient: true,
          media: {
            orderBy: { position: "asc" },
            include: { media: true },
          },
        },
      })),
    []
  );
}

export async function getConversationsForUserEmail(
  current: DbContextUser,
  email: string
) {
  const user = await safeQuery(
    () =>
      withDbRequestContext(current, (tx) => tx.user.findUnique({
        where: { email },
        include: { profile: true },
      })),
    null
  );

  if (!user?.profile) return [];

  return safeQuery(
    () =>
      withDbRequestContext(current, (tx) => tx.conversation.findMany({
        where: {
          OR: [
            { participantAId: user.profile!.id },
            { participantBId: user.profile!.id },
          ],
        },
        orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
        take: 50,
        include: {
          participantA: true,
          participantB: true,
          messages: {
            where: {
              OR: [
                {
                  senderId: user.profile!.id,
                  deletedBySenderAt: null,
                },
                {
                  recipientId: user.profile!.id,
                  deletedByRecipientAt: null,
                },
              ],
            },
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              sender: true,
              recipient: true,
              media: {
                orderBy: { position: "asc" },
                include: { media: true },
              },
            },
          },
        },
      })),
    []
  );
}

export async function getAgentRuns(current: DbContextUser, limit = 12) {
  return safeQuery(
    () =>
      withDbRequestContext(current, (tx) =>
        tx.agentRun.findMany({
          where: { userId: current.dbUserId },
          orderBy: { createdAt: "desc" },
          take: limit,
        })
      ),
    []
  );
}

export async function getAccountSummary(
  current: DbContextUser,
  email: string
) {
  return safeQuery(
    () =>
      withDbRequestContext(current, (tx) => tx.user.findUnique({
        where: { email },
        include: {
          profile: {
            include: {
              dogsOwned: {
                orderBy: [{ verified: "desc" }, { createdAt: "desc" }],
                include: {
                  dog: {
                    select: {
                      id: true,
                      name: true,
                      sex: true,
                      colour: true,
                    },
                  },
                },
              },
              _count: {
                select: {
                  listings: true,
                  threads: true,
                  posts: true,
                  dogsOwned: true,
                  savedListings: true,
                },
              },
            },
          },
        },
      })),
    null
  );
}
