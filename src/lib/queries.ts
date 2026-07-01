import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { safeQuery } from "@/lib/db";
import { getApproximateTableCounts } from "@/lib/db-stats";
import { listingInclude, soldSearchCutoffDate } from "@/lib/listing-service";

export async function getTodaysMeetings() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return safeQuery(
    () =>
      prisma.meeting.findMany({
        where: {
          meetingDate: { gte: today, lt: tomorrow },
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
                    orderBy: { date: "desc" },
                    take: 6,
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

export async function searchDogs(query: string, limit = 20) {
  if (!query || query.length < 2) return [];
  return safeQuery(
    () =>
      prisma.dog.findMany({
        where: {
          name: { contains: query },
        },
        include: {
          trainer: true,
          sire: { select: { name: true } },
          dam: { select: { name: true } },
          _count: { select: { formEntries: true } },
        },
        take: limit,
        orderBy: { name: "asc" },
      }),
    []
  );
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

export async function getRecentResults(days = 2) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  return safeQuery(
    () =>
      prisma.race.findMany({
        where: {
          raceTime: { gte: since },
          runners: { some: { result: { isNot: null } } },
        },
        include: {
          meeting: { include: { track: true } },
          runners: {
            where: { result: { isNot: null } },
            orderBy: { result: { finishingPosition: "asc" } },
            take: 3,
            include: { dog: true, result: true },
          },
        },
        orderBy: { raceTime: "desc" },
        take: 50,
      }),
    []
  );
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
}

export async function getRaceExplorerData(filters: RaceExplorerFilters = {}) {
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

  const selectedDate =
    normaliseDateParam(filters.date) ??
    formatDateInput(latestRace?.raceTime ?? new Date());
  const selectedState = states.includes(filters.state ?? "")
    ? filters.state ?? null
    : null;
  const { gte, lt } = raceDateWindow(selectedDate);
  const raceWhere: Prisma.RaceWhereInput = {
    raceTime: { gte, lt },
    ...(selectedState
      ? { meeting: { track: { state: selectedState } } }
      : {}),
  };
  const meetingWhere: Prisma.MeetingWhereInput = {
    races: { some: { raceTime: { gte, lt } } },
    ...(selectedState ? { track: { state: selectedState } } : {}),
  };

  const [meetings, dateSummary, replayRaces] = await Promise.all([
    safeQuery(
      () =>
        prisma.meeting.findMany({
          where: meetingWhere,
          include: {
            track: true,
            races: {
              where: { raceTime: { gte, lt } },
              orderBy: { raceTime: "asc" },
              include: {
                runners: { select: { id: true } },
                videos: {
                  select: {
                    id: true,
                    streamUrl: true,
                    sourceStatus: true,
                  },
                  orderBy: { fetchedAt: "desc" },
                  take: 1,
                },
              },
            },
          },
          orderBy: [{ track: { state: "asc" } }, { track: { name: "asc" } }],
        }),
      []
    ),
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

  return {
    selectedDate,
    selectedState,
    states,
    datasetStats,
    recentRaceDates,
    dateSummary,
    meetings,
    replayRaces,
  };
}

async function getRaceStates() {
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
  const rows = await safeQuery(
    () =>
      prisma.$queryRaw<{ date: Date; races: number }[]>`
        SELECT date_trunc('day', r."raceTime") AS date,
               COUNT(*)::int AS races
        FROM "Race" r
        GROUP BY 1
        ORDER BY 1 DESC
        LIMIT 14
      `,
    []
  );

  return rows.map((row) => ({
    date: formatDateInput(row.date),
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

function normaliseDateParam(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.valueOf()) ? null : value;
}

function raceDateWindow(date: string) {
  const gte = new Date(`${date}T00:00:00.000Z`);
  const lt = new Date(gte);
  lt.setUTCDate(lt.getUTCDate() + 1);
  return { gte, lt };
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function getAllTracks() {
  return safeQuery(
    () =>
      prisma.track.findMany({
        orderBy: { name: "asc" },
        include: {
          _count: { select: { meetings: true } },
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
  const rows = await safeQuery(
    () =>
      prisma.$queryRaw<{ box: number; starts: number; wins: number }[]>`
        SELECT rn."boxNumber" AS box,
               COUNT(*)::int AS starts,
               COUNT(*) FILTER (WHERE res."finishingPosition" = 1)::int AS wins
        FROM "Result" res
        JOIN "Runner" rn ON rn.id = res."runnerId"
        WHERE rn."boxNumber" BETWEEN 1 AND 8
        GROUP BY rn."boxNumber"
        ORDER BY rn."boxNumber" ASC
      `,
    []
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
  const rows = await safeQuery(
    () =>
      prisma.$queryRaw<
        { name: string; wins: number; starters: number; winsp: number }[]
      >`
        SELECT t.name AS name,
               COUNT(rn.id)::int AS starters,
               COUNT(*) FILTER (WHERE res."finishingPosition" = 1)::int AS wins,
               COALESCE(SUM(rn."startingPrice") FILTER (WHERE res."finishingPosition" = 1), 0)::float AS winsp
        FROM "Runner" rn
        JOIN "Result" res ON res."runnerId" = rn.id
        JOIN "Trainer" t ON t.id = rn."trainerId"
        GROUP BY t.id, t.name
        HAVING COUNT(rn.id) >= 5
        ORDER BY wins DESC
        LIMIT ${limit}
      `,
    []
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
  return safeQuery(
    () =>
      prisma.$queryRaw<TrackRecordRow[]>`
        SELECT DISTINCT ON (tr.name, ra.distance)
               tr.name AS track,
               ra.distance AS dist,
               res."runningTime" AS time,
               d.name AS dog,
               EXTRACT(YEAR FROM ra."raceTime")::int AS year
        FROM "Result" res
        JOIN "Runner" rn ON rn.id = res."runnerId"
        JOIN "Race" ra ON ra.id = rn."raceId"
        JOIN "Meeting" m ON m.id = ra."meetingId"
        JOIN "Track" tr ON tr.id = m."trackId"
        JOIN "Dog" d ON d.id = rn."dogId"
        WHERE res."runningTime" IS NOT NULL
        ORDER BY tr.name, ra.distance, res."runningTime" ASC
        LIMIT ${limit}
      `,
    []
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
  const rows = await safeQuery(
    () =>
      prisma.$queryRaw<
        { name: string; progeny: number; winners: number; earnings: number }[]
      >`
        SELECT s.name AS name,
               COUNT(DISTINCT child.id)::int AS progeny,
               COUNT(DISTINCT child.id) FILTER (WHERE res."finishingPosition" = 1)::int AS winners,
               COALESCE(SUM(ra."prizeMoney") FILTER (WHERE res."finishingPosition" = 1), 0)::float AS earnings
        FROM "Dog" s
        JOIN "Dog" child ON child."sireId" = s.id
        LEFT JOIN "Runner" rn ON rn."dogId" = child.id
        LEFT JOIN "Result" res ON res."runnerId" = rn.id
        LEFT JOIN "Race" ra ON ra.id = rn."raceId"
        GROUP BY s.id, s.name
        HAVING COUNT(DISTINCT child.id) > 0
        ORDER BY winners DESC, progeny DESC
        LIMIT ${limit}
      `,
    []
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
  state?: string | null;
  dogId?: string | null;
  q?: string | null;
  status?: "active" | "sold";
  sort?: "created_at" | "price" | "expires_at" | null;
}

export async function getMarketplaceListings(
  limit = 24,
  filters: MarketplaceListingFilters = {}
) {
  const now = new Date();
  const status = filters.status ?? "active";
  const where: Prisma.ListingWhereInput =
    status === "sold"
      ? {
          status: "sold",
          archivedAt: null,
          soldAt: { gte: soldSearchCutoffDate(now) },
        }
      : {
          status: "active",
          archivedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
        };

  if (filters.type) where.type = filters.type;
  if (filters.state) where.state = filters.state;
  if (filters.dogId) where.dogId = filters.dogId;

  const q = filters.q?.trim();
  if (q) {
    const textSearch = [
      { title: { contains: q } },
      { description: { contains: q } },
    ];
    where.AND = [...(Array.isArray(where.AND) ? where.AND : []), { OR: textSearch }];
  }

  const orderBy: Prisma.ListingOrderByWithRelationInput =
    filters.sort === "price"
      ? { price: "asc" }
      : filters.sort === "expires_at"
        ? { expiresAt: "asc" }
        : status === "sold"
          ? { soldAt: "desc" }
          : { createdAt: "desc" };

  return safeQuery(
    () =>
      prisma.listing.findMany({
        where,
        orderBy,
        take: limit,
        include: listingInclude(),
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

export async function getMessagingProfiles(excludeEmail?: string, limit = 60) {
  return safeQuery(
    () =>
      prisma.profile.findMany({
        where: excludeEmail
          ? {
              user: {
                email: { not: excludeEmail },
                isBanned: false,
                deletionRequestedAt: null,
              },
            }
          : {
              user: {
                isBanned: false,
                deletionRequestedAt: null,
              },
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
      }),
    []
  );
}

export async function getMessagesForUserEmail(email: string) {
  const user = await safeQuery(
    () =>
      prisma.user.findUnique({
        where: { email },
        include: { profile: true },
      }),
    null
  );

  if (!user?.profile) return [];

  return safeQuery(
    () =>
      prisma.message.findMany({
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
      }),
    []
  );
}

export async function getConversationsForUserEmail(email: string) {
  const user = await safeQuery(
    () =>
      prisma.user.findUnique({
        where: { email },
        include: { profile: true },
      }),
    null
  );

  if (!user?.profile) return [];

  return safeQuery(
    () =>
      prisma.conversation.findMany({
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
      }),
    []
  );
}

export async function getAgentRuns(limit = 12) {
  return safeQuery(
    () =>
      prisma.agentRun.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
    []
  );
}

export async function getAccountSummary(email: string) {
  return safeQuery(
    () =>
      prisma.user.findUnique({
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
                },
              },
            },
          },
        },
      }),
    null
  );
}
