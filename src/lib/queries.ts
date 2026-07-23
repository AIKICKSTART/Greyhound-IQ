import { cache } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { safeQuery } from "@/lib/db";
import {
  withDbAnonymousQueryDeadline,
  withDbRequestContext,
  type DbContextClient,
  type DbContextUser,
} from "@/lib/db-context";
import { cached } from "@/lib/ttl-cache";
import {
  DOG_IDENTITY_SELECT,
  clusterDogRows,
  fetchRowsByNames,
  mergeCluster,
  resolveDogIdentity,
  type DogIdentityRow,
  type MergedDogIdentity,
} from "@/lib/dog-identity";
import { getApproximateTableCounts } from "@/lib/db-stats";
import {
  formatRaceDateInput,
  normaliseRaceDateInput,
  raceClockTimeWindow,
  raceDateWindow,
} from "@/lib/race-time";
import { resolveRaceSearchDate } from "@/lib/race-search";
import { canonicalTrackName, trackNameAliasKey } from "@/lib/live/track-name";
import { parseMarketplaceOffset } from "@/lib/marketplace-navigation";

const MARKETPLACE_CARD_MEDIA_LIMIT = 6;
const RACE_DETAIL_RUNNER_LIMIT = 12;
const RACE_DETAIL_VIDEO_LIMIT = 16;
const RACE_DETAIL_MEETING_RACE_LIMIT = 24;
const RACE_DETAIL_DOG_FORM_LIMIT = 6;
const RACE_DETAIL_DOG_PROFILE_FORM_LIMIT = 8;
const RACE_DETAIL_PREVIOUS_RUNNER_LIMIT = 24;
const TRACK_DETAIL_MEETING_LIMIT = 8;
const TRACK_DETAIL_RACE_LIMIT = 16;
const TRACK_DETAIL_RUNNER_LIMIT = 12;
const TRACK_DETAIL_RACE_QUERY_LIMIT =
  TRACK_DETAIL_MEETING_LIMIT * TRACK_DETAIL_RACE_LIMIT;
const TRACK_DETAIL_RUNNER_QUERY_LIMIT =
  TRACK_DETAIL_RACE_QUERY_LIMIT * TRACK_DETAIL_RUNNER_LIMIT;
const RACE_EXPLORER_MEETING_LIMIT = 128;
const RACE_EXPLORER_RACE_LIMIT = 2_048;
const RACE_EXPLORER_STATE_LIMIT = 16;
const RACE_EXPLORER_REPLAY_LIMIT = 8;
const PUBLIC_RACING_QUERY_DEADLINE = Object.freeze({
  statementTimeoutMilliseconds: 10_000,
  transactionTimeoutMilliseconds: 30_000,
});

const marketplaceListingCardInclude = {
  profile: {
    select: {
      id: true,
      displayName: true,
      verified: true,
      state: true,
      createdAt: true,
    },
  },
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
      colour: true,
      sex: true,
      careerStarts: true,
      careerWins: true,
      careerSeconds: true,
      careerThirds: true,
      prizeMoney: true,
      winPercentage: true,
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
  const meetings = await withDbAnonymousQueryDeadline(
    (tx) => getRaceExplorerMeetings(meetingWhere, raceWhere, tx),
    PUBLIC_RACING_QUERY_DEADLINE,
  );

  return orderMeetingsByFirstRaceTime(meetings);
}

export const getMeetingById = cache(async (id: string) => {
  return safeQuery(
    () =>
      prisma.meeting.findUnique({
        where: { id },
        select: {
          id: true,
          meetingDate: true,
          meetingType: true,
          sourceProvider: true,
          lastSyncedAt: true,
          track: {
            select: {
              id: true,
              name: true,
              state: true,
            },
          },
          races: {
            orderBy: [{ raceNumber: "asc" }, { raceTime: "asc" }],
            take: 24,
            select: {
              id: true,
              raceNumber: true,
              name: true,
              raceTime: true,
              distance: true,
              grade: true,
              prizeMoney: true,
              resultStatus: true,
              replayUrl: true,
              _count: { select: { runners: true } },
              runners: {
                where: { result: { isNot: null } },
                orderBy: [{ boxNumber: "asc" }, { id: "asc" }],
                take: 24,
                select: {
                  boxNumber: true,
                  dog: { select: { id: true, name: true } },
                  result: {
                    select: {
                      finishingPosition: true,
                      runningTime: true,
                      margin: true,
                    },
                  },
                },
              },
              videos: {
                where: { streamUrl: { not: null } },
                orderBy: { fetchedAt: "desc" },
                take: 1,
                select: { id: true, streamUrl: true },
              },
            },
          },
        },
      }),
    null,
  );
});

export const getRaceById = cache(async (id: string) => {
  return safeQuery(
    () =>
      withDbAnonymousQueryDeadline(async (tx) => {
      const race = await tx.race.findUnique({
        where: { id },
        select: {
          id: true,
          raceNumber: true,
          name: true,
          raceTime: true,
          distance: true,
          grade: true,
          prizeMoney: true,
          resultStatus: true,
          replayUrl: true,
          photoFinishUrl: true,
          sourceProvider: true,
          sourceId: true,
          meeting: {
            select: {
              id: true,
              meetingDate: true,
              track: { select: { name: true, state: true } },
              races: {
                orderBy: [{ raceNumber: "asc" }, { raceTime: "asc" }],
                take: RACE_DETAIL_MEETING_RACE_LIMIT,
                select: {
                  id: true,
                  raceNumber: true,
                  raceTime: true,
                  distance: true,
                  grade: true,
                  name: true,
                },
              },
            },
          },
          runners: {
            orderBy: { boxNumber: "asc" },
            take: RACE_DETAIL_RUNNER_LIMIT,
            select: {
              id: true,
              boxNumber: true,
              weight: true,
              scratched: true,
              dog: {
                select: {
                  id: true,
                  name: true,
                  colour: true,
                  sex: true,
                  trainer: { select: { name: true } },
                },
              },
              trainer: { select: { name: true } },
              result: {
                select: {
                  finishingPosition: true,
                  runningTime: true,
                  margin: true,
                  prizeMoneyWon: true,
                  splitTime: true,
                },
              },
            },
          },
          videos: {
            orderBy: { fetchedAt: "desc" },
            take: RACE_DETAIL_VIDEO_LIMIT,
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
      });
      if (!race) return null;

      const dogIds = [...new Set(race.runners.map((runner) => runner.dog.id))];
      const [formRows, profileFormRows] = await Promise.all([
        getBoundedRaceDetailFormEntries(dogIds, id, tx),
        getBoundedRaceDetailProfileForms(dogIds, tx),
      ]);
      const formEntriesByDog = groupRowsByKey(formRows, "dogId");
      const profileFormsByDog = groupRowsByKey(profileFormRows, "dogId");

      return {
        ...race,
        runners: race.runners.map((runner) => ({
          ...runner,
          dog: {
            ...runner.dog,
            formEntries: (formEntriesByDog.get(runner.dog.id) ?? []).map(
              (entry) => omitGroupingKey(entry, "dogId"),
            ),
            profileForms: (profileFormsByDog.get(runner.dog.id) ?? []).map(
              (entry) => omitGroupingKey(entry, "dogId"),
            ),
          },
        })),
      };
      }, PUBLIC_RACING_QUERY_DEADLINE),
    null
  );
});

export async function getPreviousRaceVideoRunners(raceId: string) {
  return safeQuery(
    () =>
      withDbAnonymousQueryDeadline(async (tx) => {
      const currentRace = await tx.race.findUnique({
        where: { id: raceId },
        select: {
          raceTime: true,
          runners: {
            take: RACE_DETAIL_RUNNER_LIMIT,
            select: { dogId: true },
          },
        },
      });
      if (!currentRace) return [];

      const dogIds = [
        ...new Set(currentRace.runners.map((runner) => runner.dogId)),
      ];
      if (dogIds.length === 0) return [];

      const candidates = await tx.runner.findMany({
        where: {
          dogId: { in: dogIds },
          raceId: { not: raceId },
          race: {
            raceTime: { lt: currentRace.raceTime },
            OR: [{ replayUrl: { not: null } }, { videos: { some: {} } }],
          },
        },
        orderBy: { race: { raceTime: "desc" } },
        take: RACE_DETAIL_PREVIOUS_RUNNER_LIMIT,
        select: {
          dog: { select: { name: true } },
          result: {
            select: { finishingPosition: true, runningTime: true },
          },
          race: {
            select: {
              id: true,
              raceNumber: true,
              name: true,
              raceTime: true,
              distance: true,
              grade: true,
              replayUrl: true,
              sourceProvider: true,
              sourceId: true,
              meeting: {
                select: { track: { select: { name: true } } },
              },
            },
          },
        },
      });
      const videosByRace = groupRowsByKey(
        await getBoundedRaceDetailVideos(
          [...new Set(candidates.map((candidate) => candidate.race.id))],
          tx,
        ),
        "raceId",
      );
      return candidates.map((candidate) => ({
        ...candidate,
        race: {
          ...candidate.race,
          videos: (videosByRace.get(candidate.race.id) ?? []).map(
            (video) => omitGroupingKey(video, "raceId"),
          ),
        },
      }));
      }, PUBLIC_RACING_QUERY_DEADLINE),
    []
  );
}

type RaceDetailFormEntryRow = {
  dogId: string;
  finish: number | null;
  date: Date;
  trackId: string | null;
};

type RaceDetailProfileFormRow = {
  dogId: string;
  id: string;
  sourceProvider: string;
  raceUrl: string;
  date: Date;
  trackCode: string | null;
  trackName: string | null;
  raceName: string | null;
  finishText: string | null;
  finishingPosition: number | null;
  distance: number | null;
  grade: string | null;
  runningTime: number | null;
  winnerTime: number | null;
  hasVideo: boolean;
};

type RaceDetailVideoRow = {
  raceId: string;
  id: string;
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
  fetchedAt: Date | null;
  lastSyncedAt: Date | null;
};

function getBoundedRaceDetailFormEntries(
  dogIds: string[],
  raceId: string,
  db: DbContextClient,
) {
  if (dogIds.length === 0) return Promise.resolve<RaceDetailFormEntryRow[]>([]);
  const values = Prisma.join(dogIds.map((dogId) => Prisma.sql`(${dogId})`));
  return db.$queryRaw<RaceDetailFormEntryRow[]>(Prisma.sql`
    SELECT
      bounded."dogId",
      bounded.finish,
      bounded.date,
      bounded."trackId"
    FROM (VALUES ${values}) AS selected("dogId")
    CROSS JOIN LATERAL (
      SELECT f."dogId", f.finish, f.date, f."trackId"
      FROM "FormEntry" AS f
      WHERE f."dogId" = selected."dogId"
        AND (f."raceId" IS NULL OR f."raceId" <> ${raceId})
      ORDER BY f.date DESC, f.id DESC
      LIMIT ${RACE_DETAIL_DOG_FORM_LIMIT}
    ) AS bounded
    ORDER BY bounded."dogId" ASC, bounded.date DESC
  `);
}

function getBoundedRaceDetailProfileForms(
  dogIds: string[],
  db: DbContextClient,
) {
  if (dogIds.length === 0) return Promise.resolve<RaceDetailProfileFormRow[]>([]);
  const values = Prisma.join(dogIds.map((dogId) => Prisma.sql`(${dogId})`));
  return db.$queryRaw<RaceDetailProfileFormRow[]>(Prisma.sql`
    SELECT
      bounded."dogId",
      bounded.id,
      bounded."sourceProvider",
      bounded."raceUrl",
      bounded.date,
      bounded."trackCode",
      bounded."trackName",
      bounded."raceName",
      bounded."finishText",
      bounded."finishingPosition",
      bounded.distance,
      bounded.grade,
      bounded."runningTime",
      bounded."winnerTime",
      bounded."hasVideo"
    FROM (VALUES ${values}) AS selected("dogId")
    CROSS JOIN LATERAL (
      SELECT
        p."dogId",
        p.id,
        p."sourceProvider",
        p."raceUrl",
        p.date,
        p."trackCode",
        p."trackName",
        p."raceName",
        p."finishText",
        p."finishingPosition",
        p.distance,
        p.grade,
        p."runningTime",
        p."winnerTime",
        p."hasVideo"
      FROM "DogProfileForm" AS p
      WHERE p."dogId" = selected."dogId" AND p."hasVideo" = true
      ORDER BY p.date DESC, p.id DESC
      LIMIT ${RACE_DETAIL_DOG_PROFILE_FORM_LIMIT}
    ) AS bounded
    ORDER BY bounded."dogId" ASC, bounded.date DESC
  `);
}

function getBoundedRaceDetailVideos(
  raceIds: string[],
  db: DbContextClient,
) {
  if (raceIds.length === 0) return Promise.resolve<RaceDetailVideoRow[]>([]);
  const values = Prisma.join(raceIds.map((raceId) => Prisma.sql`(${raceId})`));
  return db.$queryRaw<RaceDetailVideoRow[]>(Prisma.sql`
    SELECT
      bounded."raceId",
      bounded.id,
      bounded."sourceProvider",
      bounded."sourceId",
      bounded.kind,
      bounded."pageUrl",
      bounded."embedSourceType",
      bounded."sourceStatus",
      bounded."sourceCode",
      bounded."streamUrl",
      bounded."streamContentType",
      bounded.title,
      bounded.description,
      bounded."fetchedAt",
      bounded."lastSyncedAt"
    FROM (VALUES ${values}) AS selected("raceId")
    CROSS JOIN LATERAL (
      SELECT
        v."raceId",
        v.id,
        v."sourceProvider",
        v."sourceId",
        v.kind,
        v."pageUrl",
        v."embedSourceType",
        v."sourceStatus",
        v."sourceCode",
        v."streamUrl",
        v."streamContentType",
        v.title,
        v.description,
        v."fetchedAt",
        v."lastSyncedAt"
      FROM "RaceVideo" AS v
      WHERE v."raceId" = selected."raceId"
      ORDER BY v."fetchedAt" DESC, v.id ASC
      LIMIT ${RACE_DETAIL_VIDEO_LIMIT}
    ) AS bounded
    ORDER BY bounded."raceId" ASC, bounded."fetchedAt" DESC, bounded.id ASC
  `);
}

function groupRowsByKey<
  TKey extends "dogId" | "raceId",
  TRow extends Record<TKey, string>,
>(rows: TRow[], key: TKey) {
  const groups = new Map<string, TRow[]>();
  for (const row of rows) {
    const group = groups.get(row[key]) ?? [];
    group.push(row);
    groups.set(row[key], group);
  }
  return groups;
}

function omitGroupingKey<TRow extends object, TKey extends keyof TRow>(
  row: TRow,
  key: TKey,
): Omit<TRow, TKey> {
  const { [key]: omitted, ...remaining } = row;
  void omitted;
  return remaining;
}

// Minimal payload: only the fields the search dropdown renders. Heavy relations
// (form entries, runners, ownership) stay on the profile page.
const dogSearchSelect = {
  id: true,
  name: true,
  colour: true,
  sex: true,
  whelpDate: true,
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
  limit = 20,
  // Breeding surfaces (pedigree explorer, sire/dam pickers) must find studbook
  // sires and dams that never raced; the racing directory keeps racing-only.
  includeNonRacing = false
): Promise<DogSearchResult[]> {
  const trimmed = query?.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!trimmed) return [];
  const dogSearchLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const scope = includeNonRacing ? "all" : "racing";

  // 1-2 char prefixes are the hottest autocomplete keystrokes and the slowest
  // (widest match set). There are only ~a few thousand distinct short prefixes
  // and the result is identical for every user, so cache them for a minute.
  if (trimmed.length < 3) {
    return cached(`dogsearch:${scope}:${trimmed.toLowerCase()}:${dogSearchLimit}`, 60_000, () =>
      runDogSearch(trimmed, dogSearchLimit, includeNonRacing)
    );
  }
  return runDogSearch(trimmed, dogSearchLimit, includeNonRacing);
}

async function runDogSearch(
  trimmed: string,
  limit: number,
  includeNonRacing = false
): Promise<DogSearchResult[]> {
  const prefixPattern = `${escapeLikePattern(trimmed)}%`;
  const racedFilter = includeNonRacing
    ? Prisma.empty
    : Prisma.sql`AND EXISTS (SELECT 1 FROM "Runner" r WHERE r."dogId" = d.id)`;
  // Breeding scope overfetches because identity dedupe below may collapse
  // several ranked rows into one dog; the final list is sliced back to limit.
  const fetchLimit = includeNonRacing ? Math.min(limit * 3, 100) : limit;

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
                ${racedFilter}
              ORDER BY d.name ASC
              LIMIT ${fetchLimit}
            `,
          []
        )
      : await searchDogsTrigram(trimmed, prefixPattern, fetchLimit, racedFilter);

  if (ranked.length === 0) return [];
  let ids = ranked.map((row) => row.id);
  // Breeding scope bridges split identities (racing row + studbook row for the
  // same real dog) so the picker shows one dog once. Racing scope already
  // excludes studbook-only rows, so it keeps the untouched fast path.
  let mergedByMemberId: Map<string, MergedDogIdentity> | null = null;
  if (includeNonRacing) {
    const identityRows = await safeQuery(
      () =>
        prisma.dog.findMany({
          where: { id: { in: ids } },
          select: DOG_IDENTITY_SELECT,
          take: 100,
        }),
      [] as DogIdentityRow[]
    );
    const twins = await fetchRowsByNames(identityRows.map((row) => row.name));
    const poolById = new Map<string, DogIdentityRow>();
    for (const row of [...identityRows, ...twins]) poolById.set(row.id, row);
    mergedByMemberId = new Map();
    for (const cluster of clusterDogRows([...poolById.values()])) {
      const merged = mergeCluster(cluster);
      for (const member of cluster) mergedByMemberId.set(member.id, merged);
    }
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const id of ids) {
      const primary = mergedByMemberId.get(id)?.primaryId ?? id;
      if (seen.has(primary)) continue;
      seen.add(primary);
      deduped.push(primary);
    }
    ids = deduped;
  }

  // Form counts fetched separately: Prisma's relation _count compiles to a
  // GROUP BY over the whole 5.6M-row FormEntry table joined back in (the
  // planner cannot push the id filter into the grouped subquery, ~5s). A
  // groupBy restricted to the matched ids is an indexed millisecond query.
  const [dogs, formCounts] = await Promise.all([
    safeQuery(
      () =>
        prisma.dog.findMany({
          where: { id: { in: ids } },
          orderBy: { id: "asc" },
          take: 100,
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
          orderBy: { dogId: "asc" },
          take: 100,
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
    .map((id) => {
      const dog = byId.get(id);
      if (!dog) return null;
      const merged = mergedByMemberId?.get(id);
      if (!merged) return dog;
      // Present the bridged view: racing stats from the primary row plus any
      // display fields (colour/sex/whelp) only the twin row knows.
      return {
        ...dog,
        sex: dog.sex ?? merged.sex,
        colour: dog.colour ?? merged.colour,
        whelpDate: dog.whelpDate ?? merged.whelpDate,
        careerStarts: dog.careerStarts ?? merged.careerStarts,
        careerWins: dog.careerWins ?? merged.careerWins,
        prizeMoney: dog.prizeMoney ?? merged.prizeMoney,
      };
    })
    .filter((dog): dog is DogSearchResult => dog != null)
    .slice(0, limit);
}

// 3+ char search: each whitespace word must appear anywhere in the name (AND);
// the trigram GIN index makes the ILIKE '%word%' scans index-assisted. Ranks
// exact-prefix first, then trigram similarity.
function searchDogsTrigram(
  trimmed: string,
  prefixPattern: string,
  limit: number,
  racedFilter: Prisma.Sql = Prisma.sql`AND EXISTS (SELECT 1 FROM "Runner" r WHERE r."dogId" = d.id)`
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
          ${racedFilter}
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
const DOG_DETAIL_FORM_ENTRY_LIMIT = 64;
const DOG_DETAIL_PROFILE_FORM_LIMIT = 20;
const DOG_DETAIL_RUNNER_LIMIT = 20;
const DOG_DETAIL_OWNERSHIP_LIMIT = 16;

export type DogSearchTallies = {
  dogs: number | null;
  races: number | null;
  results: number | null;
};

// Approximate row counts (pg_class.reltuples) for the dog-search landing page.
// Exact COUNT(*) over 5.6M+ rows is expensive; estimates are effectively free
// and accurate enough for a "national database" headline. Cached per instance.
export async function getDogSearchTallies(): Promise<DogSearchTallies> {
  return cached("dog-search-tallies", DOG_TALLY_TTL_MS, async () => {
    const counts = await getApproximateTableCounts(["Dog", "Race", "Result"]);
    return {
      dogs: counts.get("Dog") ?? null,
      races: counts.get("Race") ?? null,
      results: counts.get("Result") ?? null,
    };
  });
}

export const getDogById = cache(async (id: string) => {
  return safeQuery(async () => {
    const [dog, careerStarts, finishGroups] = await Promise.all([
      prisma.dog.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          earBrand: true,
          colour: true,
          sex: true,
          whelpDate: true,
          prizeMoney: true,
          trainer: { select: { name: true } },
          sire: { select: { name: true } },
          dam: { select: { name: true } },
          formEntries: {
            orderBy: { date: "desc" },
            take: DOG_DETAIL_FORM_ENTRY_LIMIT,
            select: {
              id: true,
              raceId: true,
              date: true,
              boxNumber: true,
              finish: true,
              time: true,
              distance: true,
              grade: true,
              weight: true,
              track: { select: { name: true } },
            },
          },
          profileForms: {
            orderBy: { date: "desc" },
            take: DOG_DETAIL_PROFILE_FORM_LIMIT,
            select: {
              id: true,
              sourceProvider: true,
              raceUrl: true,
              date: true,
              trackCode: true,
              trackName: true,
              finishingPosition: true,
              boxNumber: true,
              weight: true,
              distance: true,
              grade: true,
              runningTime: true,
              firstSectional: true,
              margin: true,
              winnerDogName: true,
              hasVideo: true,
            },
          },
          runners: {
            select: {
              boxNumber: true,
              weight: true,
              race: {
                select: {
                  id: true,
                  raceTime: true,
                  distance: true,
                  grade: true,
                  replayUrl: true,
                  meeting: {
                    select: { track: { select: { name: true } } },
                  },
                },
              },
              result: {
                select: {
                  finishingPosition: true,
                  runningTime: true,
                  splitTime: true,
                  margin: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
            take: DOG_DETAIL_RUNNER_LIMIT,
          },
          ownership: {
            where: { status: "approved" },
            orderBy: [{ verified: "desc" }, { createdAt: "desc" }],
            take: DOG_DETAIL_OWNERSHIP_LIMIT,
            select: {
              id: true,
              role: true,
              status: true,
              profile: {
                select: {
                  displayName: true,
                  kennelName: true,
                  state: true,
                },
              },
            },
          },
        },
      }),
      prisma.formEntry.count({ where: { dogId: id } }),
      prisma.formEntry.groupBy({
        by: ["finish"],
        where: { dogId: id, finish: { in: [1, 2, 3] } },
        _count: { _all: true },
        orderBy: { finish: "asc" },
        take: 3,
      }),
    ]);
    if (!dog) return null;
    return {
      ...dog,
      careerStats: {
        starts: careerStarts,
        wins:
          finishGroups.find((row) => row.finish === 1)?._count._all ?? 0,
        placings: finishGroups.reduce(
          (total, row) => total + row._count._all,
          0,
        ),
      },
    };
  }, null);
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
            take: 32,
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

export type ResultsSort = "newest" | "oldest" | "track";

type RecentResultsFilters = {
  date?: string | null;
  trackId?: string | null;
  sort?: ResultsSort;
  limit?: number;
};
export async function getRecentResults(filters: RecentResultsFilters = {}) {
  const boundedFilters = {
    ...filters,
    limit: Math.min(Math.max(Math.trunc(filters.limit ?? 50), 1), 100),
  };
  // The unfiltered default view is identical for every visitor — cache it.
  if (!boundedFilters.date && !boundedFilters.trackId) {
    return cached(
      `results:recent:${boundedFilters.sort ?? "newest"}:${boundedFilters.limit}`,
      60_000,
      () => fetchRecentResults(boundedFilters)
    );
  }
  return fetchRecentResults(boundedFilters);
}

async function fetchRecentResults(filters: RecentResultsFilters = {}) {
  const selectedDate = normaliseRaceDateInput(filters.date);
  const sort = filters.sort ?? "newest";
  const orderBy: Prisma.RaceOrderByWithRelationInput[] =
    sort === "oldest"
      ? [{ raceTime: "asc" }, { id: "asc" }]
      : sort === "track"
        ? [
            { meeting: { track: { name: "asc" } } },
            { raceTime: "desc" },
            { id: "desc" },
          ]
        : [{ raceTime: "desc" }, { id: "desc" }];
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
            orderBy: { boxNumber: "asc" },
            take: 16,
            select: {
              id: true,
              boxNumber: true,
              weight: true,
              scratched: true,
              dog: {
                select: {
                  id: true,
                  name: true,
                  colour: true,
                  sex: true,
                  trainer: { select: { name: true } },
                  formEntries: {
                    orderBy: { date: "desc" },
                    take: 7,
                    select: {
                      finish: true,
                      date: true,
                      trackId: true,
                      raceId: true,
                    },
                  },
                },
              },
              trainer: { select: { name: true } },
              result: true,
            },
          },
        },
        orderBy,
        take: Math.min(Math.max(Math.trunc(filters.limit ?? 50), 1), 100),
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
            LIMIT 100
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
  const boundedDays = Math.min(Math.max(Math.trunc(days), 1), 31);
  const now = new Date();
  now.setHours(0, 0, 0, 0); // include today's meetings even after some races have run
  const until = new Date();
  until.setDate(until.getDate() + boundedDays);
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
            take: 32,
            include: {
              runners: {
                orderBy: [{ boxNumber: "asc" }, { id: "asc" }],
                take: 16,
              },
            },
          },
        },
        orderBy: { meetingDate: "asc" },
        take: 500,
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
  const load = () =>
    withDbAnonymousQueryDeadline(
      (tx) => fetchRaceExplorerData(filters, tx),
      PUBLIC_RACING_QUERY_DEADLINE,
    );
  if (isDefaultView) {
    return cached("races:explorer:default", 60_000, load);
  }
  return load();
}

async function fetchRaceExplorerData(
  filters: RaceExplorerFilters,
  db: DbContextClient,
) {
  const [latestRace, states, datasetStats, recentRaceDates] = await Promise.all([
    safeQuery(
      () =>
        db.race.findFirst({
          orderBy: { raceTime: "desc" },
          select: { raceTime: true },
        }),
      null
    ),
    getRaceStates(db),
    getDatasetStats(db),
    getRecentRaceDates(db),
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
      }, db)
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

  const rawMeetings = await getRaceExplorerMeetings(
    meetingWhere,
    raceWhere,
    db,
  );
  const [dateSummary, replayRaces] = searchQuery
    ? await Promise.all([
        summarizeRaceExplorerMeetings(rawMeetings, db),
        Promise.resolve(replayRacesFromExplorerMeetings(rawMeetings)),
      ])
    : await Promise.all([
        getRaceDateSummary(raceWhere, meetingWhere, db),
        safeQuery(
          () =>
            db.race.findMany({
              where: {
                ...raceWhere,
                videos: { some: { streamUrl: { not: null } } },
              },
              orderBy: { raceTime: "desc" },
              take: RACE_EXPLORER_REPLAY_LIMIT,
              select: {
                id: true,
                raceNumber: true,
                raceTime: true,
                distance: true,
                grade: true,
                meeting: {
                  select: {
                    id: true,
                    track: { select: { name: true, state: true } },
                  },
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
  resultStatus: string | null;
  _count: { runners: number };
  videos: {
    id: string;
    streamUrl: string | null;
    sourceStatus: number | null;
  }[];
};

async function getRaceExplorerMeetings(
  meetingWhere: Prisma.MeetingWhereInput,
  raceWhere: Prisma.RaceWhereInput,
  db: DbContextClient,
) {
  return safeQuery(async (): Promise<RaceExplorerMeeting[]> => {
    const meetings = await db.meeting.findMany({
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
      take: RACE_EXPLORER_MEETING_LIMIT,
    });
    if (meetings.length === 0) return [];

    const meetingIds = meetings.map((meeting) => meeting.id);
    const races = await db.race.findMany({
      where: { AND: [raceWhere, { meetingId: { in: meetingIds } }] },
      orderBy: { raceTime: "asc" },
      select: {
        id: true,
        meetingId: true,
        raceNumber: true,
        raceTime: true,
        distance: true,
        grade: true,
        resultStatus: true,
      },
      take: RACE_EXPLORER_RACE_LIMIT,
    });
    if (races.length === 0) {
      return meetings.map((meeting) => ({ ...meeting, races: [] }));
    }

    const raceIds = races.map((race) => race.id);
    const [runnerCounts, videos] = await Promise.all([
      db.runner.groupBy({
        by: ["raceId"],
        where: { raceId: { in: raceIds } },
        _count: { _all: true },
        orderBy: { raceId: "asc" },
        take: RACE_EXPLORER_RACE_LIMIT,
      }),
      db.raceVideo.findMany({
        where: { raceId: { in: raceIds } },
        orderBy: [{ fetchedAt: "desc" }, { id: "asc" }],
        take: RACE_EXPLORER_RACE_LIMIT,
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
      if (!videosByRace.has(video.raceId)) {
        videosByRace.set(video.raceId, [
          {
            id: video.id,
            streamUrl: video.streamUrl,
            sourceStatus: video.sourceStatus,
          },
        ]);
      }
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
        resultStatus: race.resultStatus,
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

async function getRaceStates(db: DbContextClient) {
  if (raceStatesCache && raceStatesCache.expiresAt > Date.now()) {
    return raceStatesCache.value;
  }
  const value = await loadRaceStates(db);
  raceStatesCache = {
    expiresAt: Date.now() + RACE_EXPLORER_META_TTL_MS,
    value,
  };
  return value;
}

async function loadRaceStates(db: DbContextClient) {
  const rows = await safeQuery(
    () =>
      db.track.groupBy({
        by: ["state"],
        orderBy: { state: "asc" },
        take: RACE_EXPLORER_STATE_LIMIT,
      }),
    []
  );
  return rows.map((row) => row.state).filter(Boolean);
}

async function getDatasetStats(db: DbContextClient) {
  if (datasetStatsCache && datasetStatsCache.expiresAt > Date.now()) {
    return datasetStatsCache.value;
  }
  const value = await loadDatasetStats(db);
  datasetStatsCache = {
    expiresAt: Date.now() + RACE_EXPLORER_META_TTL_MS,
    value,
  };
  return value;
}

async function loadDatasetStats(db: DbContextClient) {
  type DatasetStats = {
    races: number | null;
    runners: number | null;
    results: number | null;
    dogs: number | null;
    dogProfileForms: number | null;
    videos: number | null;
    videosWithStream: number | null;
    latestRaceTime: string | null;
  };
  const fallback: DatasetStats = {
    races: null,
    runners: null,
    results: null,
    dogs: null,
    dogProfileForms: null,
    videos: null,
    videosWithStream: null,
    latestRaceTime: null as string | null,
  };
  return safeQuery<DatasetStats>(async () => {
    const [tableCounts, videosWithStream, latestRace] = await Promise.all([
      getApproximateTableCounts([
        "Race",
        "Runner",
        "Result",
        "Dog",
        "DogProfileForm",
        "RaceVideo",
      ]),
      db.raceVideo.count({ where: { streamUrl: { not: null } } }),
      db.race.findFirst({
        orderBy: { raceTime: "desc" },
        select: { raceTime: true },
      }),
    ]);

    return {
      races: tableCounts.get("Race") ?? null,
      runners: tableCounts.get("Runner") ?? null,
      results: tableCounts.get("Result") ?? null,
      dogs: tableCounts.get("Dog") ?? null,
      dogProfileForms: tableCounts.get("DogProfileForm") ?? null,
      videos: tableCounts.get("RaceVideo") ?? null,
      videosWithStream,
      latestRaceTime: latestRace?.raceTime.toISOString() ?? null,
    };
  }, fallback);
}

async function getRecentRaceDates(db: DbContextClient) {
  if (recentRaceDatesCache && recentRaceDatesCache.expiresAt > Date.now()) {
    return recentRaceDatesCache.value;
  }
  const value = await loadRecentRaceDates(db);
  recentRaceDatesCache = {
    expiresAt: Date.now() + RACE_EXPLORER_META_TTL_MS,
    value,
  };
  return value;
}

async function loadRecentRaceDates(db: DbContextClient) {
  const rows = await safeQuery(
    () =>
      db.$queryRaw<{ date: string; races: number }[]>`
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
  meetingWhere: Prisma.MeetingWhereInput,
  db: DbContextClient,
) {
  type RaceDateSummary = {
    meetings: number | null;
    races: number | null;
    runners: number | null;
    results: number | null;
    videos: number | null;
    videosWithStream: number | null;
  };
  const fallback: RaceDateSummary = {
    meetings: null,
    races: null,
    runners: null,
    results: null,
    videos: null,
    videosWithStream: null,
  };

  return safeQuery<RaceDateSummary>(async () => {
    const [meetings, races, runners, results, videos, videosWithStream] =
      await Promise.all([
        db.meeting.count({ where: meetingWhere }),
        db.race.count({ where: raceWhere }),
        db.runner.count({ where: { race: raceWhere } }),
        db.result.count({ where: { runner: { race: raceWhere } } }),
        db.raceVideo.count({ where: { race: raceWhere } }),
        db.raceVideo.count({
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
      _count: { runners: number };
      videos: { streamUrl: string | null }[];
    }[];
  }[],
  db: DbContextClient,
) {
  const raceIds = meetings.flatMap((meeting) =>
    meeting.races.map((race) => race.id)
  );
  const results: number | null = raceIds.length
    ? await safeQuery<number | null>(
        () => db.result.count({ where: { raceId: { in: raceIds } } }),
        null
      )
    : 0;

  return meetings.reduce(
    (summary, meeting) => {
      summary.meetings += 1;
      summary.races += meeting.races.length;
      for (const race of meeting.races) {
        summary.runners += race._count.runners;
        summary.videos += race.videos.length;
        summary.videosWithStream += race.videos.filter(
          (video) => video.streamUrl
        ).length;
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

export { resolveRaceSearchDate } from "@/lib/race-search";

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
}, db: DbContextClient) {
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
      }, db);

  if (globalRunnerRows?.length) {
    return globalRunnerRows;
  }

  const fieldRows = await safeQuery(
    () =>
      db.$queryRaw<{ id: string }[]>`
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
      }, db)
    : null;

  if (runnerRows?.length) {
    return runnerRows;
  }

  const exactRows = await safeQuery(
    () =>
      db.$queryRaw<{ id: string }[]>`
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
      db.$queryRaw<{ id: string }[]>`
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
}, db: DbContextClient) {
  if (!parsed.text) return null;
  if (parsed.clockTime && !selectedDate) return null;

  const insensitive = "insensitive" as const;
  const dogRows = await safeQuery(
    () =>
      db.dog.findMany({
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
      db.runner.findMany({
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
                take: 32,
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
        take: 100,
      }),
    []
  );
}

// === STATISTICS (computed from real results) ===

export interface BoxBiasRow {
  box: number;
  starts: number;
  wins: number;
  winRate: number | null;
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
    winRate:
      r.starts > 0 ? parseFloat(((r.wins / r.starts) * 100).toFixed(1)) : null,
  }));
}

export interface TrainerLeaderRow {
  name: string;
  starts: number;
  wins: number;
  places: number;
  winRate: number;
  prizeMoney: number;
}

export async function getTrainerLeaderboard(limit = 10): Promise<TrainerLeaderRow[]> {
  // Served from the non-betting aggregate refreshed by the live results cron.
  return cached(`stats:trainer-performance:${limit}`, 5 * 60_000, () =>
    safeQuery(
      () =>
        prisma.$queryRaw<TrainerLeaderRow[]>`
          SELECT name,
                 starts,
                 wins,
                 places,
                 win_rate AS "winRate",
                 prize_money AS "prizeMoney"
          FROM giq_trainer_performance
          ORDER BY wins DESC, places DESC, prize_money DESC, name ASC
          LIMIT ${limit}
        `,
      []
    )
  );
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
  sireId: string;
  name: string;
  progeny: number;
  winners: number;
  strike: number | null;
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
          { sire_id: string; name: string; progeny: number; winners: number; earnings: number }[]
        >`
          SELECT sire_id, name, progeny, winners, earnings
          FROM giq_sire_leaderboard
          ORDER BY winners DESC, progeny DESC
          LIMIT ${limit}
        `,
      []
    )
  );
  return rows.map((r) => ({
    sireId: r.sire_id,
    name: r.name,
    progeny: r.progeny,
    winners: r.winners,
    strike:
      r.progeny > 0
        ? parseFloat(((r.winners / r.progeny) * 100).toFixed(1))
        : null,
    earnings: r.earnings,
  }));
}

export interface BreedingStats {
  totalDogs: number;
  breedingDogs: number;
  pedigreedDogs: number;
  studbookVolumes: number;
}

export async function getBreedingStats(): Promise<BreedingStats> {
  // Counts over the Dog table (indexed on sourceProvider / sireId / damId).
  // Cached 5min — these move only when the pedigree loader or live sync runs.
  const [row] = await cached("breeding:stats", 5 * 60_000, () =>
    safeQuery(
      () =>
        prisma.$queryRaw<
          { total: bigint; breeding: bigint; pedigreed: bigint }[]
        >`
          SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE "sourceProvider" = 'galtd') AS breeding,
            COUNT(*) FILTER (WHERE "sireId" IS NOT NULL OR "damId" IS NOT NULL)
              + (
                SELECT COUNT(DISTINCT si."dogId")
                FROM "DogSourceIdentity" si
                JOIN "PedigreeAssertion" pa ON pa."subjectIdentityId" = si.id
                WHERE si."dogId" IS NOT NULL
                  AND pa."verificationStatus" IN ('parsed', 'verified')
                  AND NOT EXISTS (
                    SELECT 1 FROM "Dog" d2
                    WHERE d2.id = si."dogId"
                      AND (d2."sireId" IS NOT NULL OR d2."damId" IS NOT NULL)
                  )
              ) AS pedigreed
          FROM "Dog"
        `,
      [{ total: BigInt(0), breeding: BigInt(0), pedigreed: BigInt(0) }]
    )
  );
  return {
    totalDogs: Number(row?.total ?? 0),
    breedingDogs: Number(row?.breeding ?? 0),
    pedigreedDogs: Number(row?.pedigreed ?? 0),
    // 9 distinct GALTD studbook artifacts imported (PedigreeImportRun is
    // system-only under RLS, so this stays a constant; bump on new volumes).
    studbookVolumes: 9,
  };
}

// === BREEDING TOOLS: sire detail, litters, cross ===
// All figures come from the Dog table's stored career aggregates (careerStarts /
// careerWins / prizeMoney), sourced from the racing record. Progeny link through
// the sireId / damId FKs (both indexed). Nothing here is predicted or inferred:
// a progeny with no racing record contributes to the count but never fabricates
// a win or an earning, and metrics with no underlying data return null.

const PROGENY_TOP_LIMIT = 10;
const CROSS_PROGENY_LIMIT = 50;
const LITTER_LIMIT = 20;

type ParentRole = "sire" | "dam";

export interface ProgenyRecord {
  count: number;
  // Progeny that actually carry a racing record (careerStarts is set). Winners
  // and earnings are only meaningful across these; the rest are studbook-only.
  withRacingRecord: number;
  winners: number | null;
  totalEarnings: number | null;
  avgCareerWins: number | null;
}

export interface ProgenySummary {
  id: string;
  name: string;
  sex: string | null;
  colour: string | null;
  whelpYear: number | null;
  careerStarts: number | null;
  careerWins: number | null;
  prizeMoney: number | null;
}

// Capped at the audited collection-query maximum (security/collection-query-
// bound-evidence.ts); the most prolific sire clusters sit under 3k rows.
const PROGENY_FETCH_LIMIT = 5000;

interface ParentProgenyData {
  identity: MergedDogIdentity;
  clusters: DogIdentityRow[][];
  merged: MergedDogIdentity[];
}

// One fetch per (parent, role) request: every progeny row across the parent's
// bridged identity cluster, deduped so a pup imported by both the racing and
// studbook sources counts once. progenyRecord / topProgeny / cross / partners
// all derive from this; react cache() collapses repeat calls per request.
const getParentProgenyData = cache(
  async (parentId: string, role: ParentRole): Promise<ParentProgenyData | null> => {
    const identity = await resolveDogIdentity(parentId);
    if (!identity) return null;
    const where: Prisma.DogWhereInput =
      role === "sire" ? { sireId: { in: identity.ids } } : { damId: { in: identity.ids } };
    const rows = await safeQuery(
      () =>
        prisma.dog.findMany({
          where,
          select: DOG_IDENTITY_SELECT,
          take: PROGENY_FETCH_LIMIT,
        }),
      [] as DogIdentityRow[],
    );
    const clusters = clusterDogRows(rows);
    return { identity, clusters, merged: clusters.map(mergeCluster) };
  },
);

function mergedToProgenySummary(m: MergedDogIdentity): ProgenySummary {
  return {
    id: m.primaryId,
    name: m.name,
    sex: m.sex,
    colour: m.colour,
    whelpYear: m.whelpDate ? m.whelpDate.getUTCFullYear() : null,
    careerStarts: m.careerStarts,
    careerWins: m.careerWins,
    prizeMoney: m.prizeMoney,
  };
}

function identityToParentDog(identity: MergedDogIdentity): SireStats["dog"] {
  return {
    id: identity.primaryId,
    name: identity.name,
    sex: identity.sex,
    colour: identity.colour,
    whelpYear: identity.whelpDate ? identity.whelpDate.getUTCFullYear() : null,
    careerStarts: identity.careerStarts,
    careerWins: identity.careerWins,
    prizeMoney: identity.prizeMoney,
  };
}

function progenyRecordFromMerged(merged: MergedDogIdentity[]): ProgenyRecord {
  const withRecord = merged.filter((m) => m.careerStarts !== null);
  const winners = merged.filter((m) => (m.careerWins ?? 0) > 0).length;
  const earnings = merged.reduce((sum, m) => sum + (m.prizeMoney ?? 0), 0);
  const withWins = merged.filter((m) => m.careerWins !== null);
  const avgCareerWins =
    withWins.length > 0
      ? withWins.reduce((sum, m) => sum + (m.careerWins ?? 0), 0) / withWins.length
      : null;
  return {
    count: merged.length,
    withRacingRecord: withRecord.length,
    winners: withRecord.length > 0 ? winners : null,
    totalEarnings: withRecord.length > 0 ? earnings : null,
    avgCareerWins,
  };
}

async function progenyRecord(
  parentId: string,
  role: ParentRole,
): Promise<ProgenyRecord> {
  const data = await getParentProgenyData(parentId, role);
  if (!data) {
    return { count: 0, withRacingRecord: 0, winners: null, totalEarnings: null, avgCareerWins: null };
  }
  return progenyRecordFromMerged(data.merged);
}

async function topProgeny(
  parentId: string,
  role: ParentRole,
  limit: number,
): Promise<ProgenySummary[]> {
  const data = await getParentProgenyData(parentId, role);
  if (!data) return [];
  return data.merged
    .filter((m) => m.prizeMoney !== null)
    .sort((a, b) => (b.prizeMoney ?? 0) - (a.prizeMoney ?? 0))
    .slice(0, limit)
    .map(mergedToProgenySummary);
}

export interface SireStats {
  dog: {
    id: string;
    name: string;
    sex: string | null;
    colour: string | null;
    whelpYear: number | null;
    careerStarts: number | null;
    careerWins: number | null;
    prizeMoney: number | null;
  };
  progeny: ProgenyRecord;
  topProgeny: ProgenySummary[];
}

// Per-sire detail: the sire's own record plus an aggregate over its progeny.
export const getSireStats = cache(
  async (dogId: string): Promise<SireStats | null> => {
    const identity = await resolveDogIdentity(dogId);
    if (!identity) return null;
    const [progeny, top] = await Promise.all([
      progenyRecord(dogId, "sire"),
      topProgeny(dogId, "sire", PROGENY_TOP_LIMIT),
    ]);
    return { dog: identityToParentDog(identity), progeny, topProgeny: top };
  },
);

// Per-dam detail: the dam's own record plus an aggregate over its progeny.
// Mirrors getSireStats with the dam FK so dam names stop dead-ending at /dogs.
export const getDamStats = cache(
  async (dogId: string): Promise<SireStats | null> => {
    const identity = await resolveDogIdentity(dogId);
    if (!identity) return null;
    const [progeny, top] = await Promise.all([
      progenyRecord(dogId, "dam"),
      topProgeny(dogId, "dam", PROGENY_TOP_LIMIT),
    ]);
    return { dog: identityToParentDog(identity), progeny, topProgeny: top };
  },
);

export interface ParentHeader {
  id: string;
  name: string;
  sex: string | null;
  colour: string | null;
  whelpYear: number | null;
}

export interface CrossRecord {
  sire: ParentHeader;
  dam: ParentHeader;
  progeny: ProgenySummary[];
  sireProgeny: ProgenyRecord;
  damProgeny: ProgenyRecord;
}

// Historical record of a sire x dam pairing — NOT a prediction. Returns the
// progeny that pairing actually produced, plus each parent's overall progeny
// record for context. No genetics or trait modelling.
export const getCrossRecord = cache(
  async (sireId: string, damId: string): Promise<CrossRecord | null> => {
    const [sireData, damData] = await Promise.all([
      getParentProgenyData(sireId, "sire"),
      getParentProgenyData(damId, "dam"),
    ]);
    if (!sireData || !damData) return null;
    // The exact pairing: any progeny row whose dam link lands anywhere in the
    // dam's bridged identity cluster (and vice versa via the sire fetch).
    const damIds = new Set(damData.identity.ids);
    const pairProgeny = sireData.clusters
      .filter((cluster) => cluster.some((row) => row.damId !== null && damIds.has(row.damId)))
      .map(mergeCluster)
      .sort(
        (a, b) =>
          (b.prizeMoney ?? -1) - (a.prizeMoney ?? -1) || a.name.localeCompare(b.name),
      )
      .slice(0, CROSS_PROGENY_LIMIT);
    const toHeader = (identity: MergedDogIdentity): ParentHeader => ({
      id: identity.primaryId,
      name: identity.name,
      sex: identity.sex,
      colour: identity.colour,
      whelpYear: identity.whelpDate ? identity.whelpDate.getUTCFullYear() : null,
    });
    return {
      sire: toHeader(sireData.identity),
      dam: toHeader(damData.identity),
      progeny: pairProgeny.map(mergedToProgenySummary),
      sireProgeny: progenyRecordFromMerged(sireData.merged),
      damProgeny: progenyRecordFromMerged(damData.merged),
    };
  },
);

export interface DamPartner {
  id: string;
  name: string;
  progeny: number;
  winners: number;
}

// Dams this sire has already produced recorded progeny with — real historical
// partners, ranked by litter size then winners. Powers the "top dam picks"
// suggestions once a sire is chosen. NOT a prediction: only pairings that exist
// in the current snapshot. Mirror function (getSirePartnersForDam) narrows the
// other direction when a dam is picked first.
async function getParentPartners(
  parentId: string,
  parentColumn: "sireId" | "damId",
  otherColumn: "sireId" | "damId",
  limit: number,
): Promise<DamPartner[]> {
  const role: ParentRole = parentColumn === "sireId" ? "sire" : "dam";
  const data = await getParentProgenyData(parentId, role);
  if (!data) return [];

  // Resolve the partner side of every progeny row, then group the deduped
  // progeny clusters by partner name so a partner split across racing and
  // studbook rows appears once with its true litter count.
  const otherIdOf = (row: DogIdentityRow) =>
    otherColumn === "damId" ? row.damId : row.sireId;
  const otherIds = [
    ...new Set(
      data.clusters.flatMap((cluster) =>
        cluster.map(otherIdOf).filter((id): id is string => Boolean(id)),
      ),
    ),
  ];
  if (otherIds.length === 0) return [];
  const otherRows = await safeQuery(
    () =>
      prisma.dog.findMany({
        where: { id: { in: otherIds } },
        select: { id: true, name: true },
        take: PROGENY_FETCH_LIMIT,
      }),
    [] as { id: string; name: string }[],
  );
  const nameById = new Map(otherRows.map((row) => [row.id, row.name]));

  const partners = new Map<
    string,
    { name: string; progeny: number; winners: number; idVotes: Map<string, number> }
  >();
  for (const cluster of data.clusters) {
    const merged = mergeCluster(cluster);
    const ids = cluster.map(otherIdOf).filter((id): id is string => Boolean(id));
    const named = ids.find((id) => nameById.has(id));
    if (!named) continue;
    const displayName = nameById.get(named)!;
    const key = displayName.trim().replace(/\s+/g, " ").toLowerCase();
    let entry = partners.get(key);
    if (!entry) {
      entry = { name: displayName, progeny: 0, winners: 0, idVotes: new Map() };
      partners.set(key, entry);
    }
    entry.progeny += 1;
    if ((merged.careerWins ?? 0) > 0) entry.winners += 1;
    for (const id of ids) entry.idVotes.set(id, (entry.idVotes.get(id) ?? 0) + 1);
  }

  return [...partners.values()]
    .map((entry) => ({
      id: [...entry.idVotes.entries()].sort((a, b) => b[1] - a[1])[0][0],
      name: entry.name,
      progeny: entry.progeny,
      winners: entry.winners,
    }))
    .sort(
      (a, b) =>
        b.progeny - a.progeny || b.winners - a.winners || a.name.localeCompare(b.name),
    )
    .slice(0, limit);
}

export const getSireDamPartners = cache(
  (sireId: string, limit = 8): Promise<DamPartner[]> =>
    getParentPartners(sireId, "sireId", "damId", limit),
);

export const getDamSirePartners = cache(
  (damId: string, limit = 8): Promise<DamPartner[]> =>
    getParentPartners(damId, "damId", "sireId", limit),
);

export interface LitterCross {
  sireId: string;
  damId: string;
  sireName: string;
  damName: string;
  progeny: number;
  winners: number;
  earnings: number;
  // Nicking signal (all from Dog aggregates). strike = this cross's winners rate;
  // earningsPerProgeny normalises so big litters don't dominate on totals alone;
  // the baselines are each parent's OVERALL progeny winners rate (careerWins > 0
  // over all mapped progeny) — same definition as `strike`, so they compare.
  strike: number | null;
  earningsPerProgeny: number;
  sireBaselineStrike: number | null;
  damBaselineStrike: number | null;
  topPerformer: { id: string; name: string; prizeMoney: number | null } | null;
}

function round1(value: number | null): number | null {
  return value === null ? null : parseFloat(value.toFixed(1));
}

// Progeny grouped by (sireId, damId) — i.e. actual litters/crosses. Only pairs
// that produced 2+ recorded progeny count as a litter; ranked by progeny
// winners. Winners = progeny with a recorded career win; earnings = summed
// progeny prize money. Optional sireId narrows to one sire's crosses.
export async function getLitters(
  sireId?: string,
  limit = LITTER_LIMIT,
): Promise<LitterCross[]> {
  const bounded = Math.min(Math.max(Math.trunc(limit), 1), 50);
  return cached(`breeding:litters:${sireId ?? "all"}:${bounded}`, 5 * 60_000, () =>
    loadLitters(sireId, bounded),
  );
}

async function loadLitters(
  sireId: string | undefined,
  limit: number,
): Promise<LitterCross[]> {
  // Grouped aggregate over the Dog table (~261k rows). ponytail: full scan +
  // hash aggregate is sub-second and cached 5min; revisit with a matview only
  // if this ever shows up hot.
  const sireFilter = sireId ? Prisma.sql`AND "sireId" = ${sireId}` : Prisma.empty;
  const groups = await safeQuery(
    () =>
      prisma.$queryRaw<
        { sireId: string; damId: string; progeny: number; winners: number; earnings: number }[]
      >(Prisma.sql`
        SELECT "sireId", "damId",
          COUNT(*)::int AS progeny,
          COUNT(*) FILTER (WHERE "careerWins" > 0)::int AS winners,
          COALESCE(SUM("prizeMoney"), 0)::float AS earnings
        FROM "Dog"
        WHERE "sireId" IS NOT NULL AND "damId" IS NOT NULL ${sireFilter}
        GROUP BY "sireId", "damId"
        HAVING COUNT(*) > 1
        ORDER BY winners DESC, progeny DESC, earnings DESC
        LIMIT ${limit}
      `),
    [],
  );
  if (groups.length === 0) return [];

  const parentIds = [...new Set(groups.flatMap((g) => [g.sireId, g.damId]))];
  const sireIds = [...new Set(groups.map((g) => g.sireId))];
  const damIds = [...new Set(groups.map((g) => g.damId))];
  const pairTuples = Prisma.join(
    groups.map((g) => Prisma.sql`(${g.sireId}, ${g.damId})`),
  );
  const [names, tops, sireBase, damBase] = await Promise.all([
    safeQuery(
      () =>
        prisma.dog.findMany({
          where: { id: { in: parentIds } },
          select: { id: true, name: true },
          take: PROGENY_FETCH_LIMIT,
        }),
      [],
    ),
    safeQuery(
      () =>
        prisma.$queryRaw<
          { sireId: string; damId: string; id: string; name: string; prizeMoney: number | null }[]
        >(Prisma.sql`
          SELECT DISTINCT ON ("sireId", "damId")
            "sireId", "damId", id, name, "prizeMoney"
          FROM "Dog"
          WHERE ("sireId", "damId") IN (${pairTuples})
          ORDER BY "sireId", "damId", "prizeMoney" DESC NULLS LAST, name ASC
        `),
      [],
    ),
    // Each involved sire's OVERALL progeny winners rate (indexed scan on sireId,
    // restricted to the few ranked sires). Baseline for the nicking comparison.
    safeQuery(
      () =>
        prisma.$queryRaw<{ pid: string; prog: number; win: number }[]>(Prisma.sql`
          SELECT "sireId" AS pid, COUNT(*)::int AS prog,
            COUNT(*) FILTER (WHERE "careerWins" > 0)::int AS win
          FROM "Dog" WHERE "sireId" IN (${Prisma.join(sireIds)}) GROUP BY "sireId"
        `),
      [],
    ),
    safeQuery(
      () =>
        prisma.$queryRaw<{ pid: string; prog: number; win: number }[]>(Prisma.sql`
          SELECT "damId" AS pid, COUNT(*)::int AS prog,
            COUNT(*) FILTER (WHERE "careerWins" > 0)::int AS win
          FROM "Dog" WHERE "damId" IN (${Prisma.join(damIds)}) GROUP BY "damId"
        `),
      [],
    ),
  ]);

  const nameById = new Map(names.map((d) => [d.id, d.name]));
  const topByPair = new Map(tops.map((t) => [`${t.sireId}|${t.damId}`, t]));
  const baselineStrike = (rows: { pid: string; prog: number; win: number }[]) =>
    new Map(rows.map((r) => [r.pid, r.prog > 0 ? (r.win / r.prog) * 100 : null]));
  const sireStrike = baselineStrike(sireBase);
  const damStrike = baselineStrike(damBase);

  return groups.map((g) => {
    const top = topByPair.get(`${g.sireId}|${g.damId}`) ?? null;
    return {
      sireId: g.sireId,
      damId: g.damId,
      sireName: nameById.get(g.sireId) ?? "Unknown",
      damName: nameById.get(g.damId) ?? "Unknown",
      progeny: g.progeny,
      winners: g.winners,
      earnings: g.earnings,
      strike: g.progeny > 0 ? round1((g.winners / g.progeny) * 100) : null,
      earningsPerProgeny: g.progeny > 0 ? g.earnings / g.progeny : 0,
      sireBaselineStrike: round1(sireStrike.get(g.sireId) ?? null),
      damBaselineStrike: round1(damStrike.get(g.damId) ?? null),
      topPerformer: top
        ? { id: top.id, name: top.name, prizeMoney: top.prizeMoney }
        : null,
    };
  });
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
    async () => {
      const track = await prisma.track.findUnique({ where: { id } });
      if (!track) return null;

      const meetings = await prisma.meeting.findMany({
        where: { trackId: id },
        orderBy: [{ meetingDate: "desc" }, { id: "asc" }],
        take: TRACK_DETAIL_MEETING_LIMIT,
      });
      const meetingIds = meetings.map((meeting) => meeting.id);
      const races = meetingIds.length
        ? await prisma.race.findMany({
            where: { meetingId: { in: meetingIds } },
            orderBy: [{ meetingId: "asc" }, { raceNumber: "asc" }, { id: "asc" }],
            take: TRACK_DETAIL_RACE_QUERY_LIMIT,
          })
        : [];
      const raceIds = races.map((race) => race.id);
      const runners = raceIds.length
        ? await prisma.runner.findMany({
            where: { raceId: { in: raceIds } },
            orderBy: [{ raceId: "asc" }, { boxNumber: "asc" }, { id: "asc" }],
            take: TRACK_DETAIL_RUNNER_QUERY_LIMIT,
            include: { dog: true, result: true },
          })
        : [];
      const runnersByRace = new Map<string, typeof runners>();
      for (const runner of runners) {
        const rows = runnersByRace.get(runner.raceId) ?? [];
        if (rows.length < TRACK_DETAIL_RUNNER_LIMIT) rows.push(runner);
        runnersByRace.set(runner.raceId, rows);
      }
      const racesByMeeting = new Map<
        string,
        Array<(typeof races)[number] & { runners: typeof runners }>
      >();
      for (const race of races) {
        const rows = racesByMeeting.get(race.meetingId) ?? [];
        if (rows.length < TRACK_DETAIL_RACE_LIMIT) {
          rows.push({ ...race, runners: runnersByRace.get(race.id) ?? [] });
        }
        racesByMeeting.set(race.meetingId, rows);
      }

      return {
        ...track,
        meetings: meetings.map((meeting) => ({
          ...meeting,
          races: racesByMeeting.get(meeting.id) ?? [],
        })),
      };
    },
    null
  );
});

export async function getForumOverview() {
  return safeQuery(
    () =>
      prisma.forumCategory.findMany({
        orderBy: { sortOrder: "asc" },
        take: 100,
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
        take: Math.min(Math.max(Math.trunc(limit), 1), 100),
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
            take: 100,
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
            take: 500,
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
  offset?: number;
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
        take: Math.min(Math.max(Math.trunc(limit), 1), 100),
      }),
    []
  );
}

export async function getMarketplaceListings(
  limit = 24,
  filters: MarketplaceListingFilters = {}
) {
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const normalisedFilters = {
    ...filters,
    offset: parseMarketplaceOffset(filters.offset),
  };
  const cacheKey = marketplaceListingsCacheKey(
    boundedLimit,
    normalisedFilters,
  );
  const cached = marketplaceListingsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const pending = pendingMarketplaceListings.get(cacheKey);
  if (pending) return pending;

  const query = fetchMarketplaceListings(boundedLimit, normalisedFilters)
    .then((value) => {
      marketplaceListingsCache.set(cacheKey, {
        expiresAt: Date.now() + MARKETPLACE_LISTINGS_CACHE_MS,
        value,
      });
      return value;
    })
    .finally(() => {
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
  const offset = parseMarketplaceOffset(filters.offset);
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
      Math.max(offset + limit, LISTING_SEARCH_CANDIDATE_LIMIT)
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

  const orderBy: Prisma.ListingOrderByWithRelationInput[] =
    filters.sort === "price"
      ? [{ price: "asc" }, { createdAt: "desc" }, { id: "asc" }]
      : filters.sort === "expires_at"
        ? [{ expiresAt: "asc" }, { createdAt: "desc" }, { id: "asc" }]
        : [{ createdAt: "desc" }, { id: "asc" }];

  const useRankedSearch = Boolean(q && searchCandidateIds && !filters.sort);
  const queryLimit =
    useRankedSearch && searchCandidateIds ? searchCandidateIds.length : limit;
  const listings = await safeQuery(
    () =>
      prisma.listing.findMany({
        where,
        orderBy,
        skip: useRankedSearch ? undefined : offset,
        take: Math.min(Math.max(Math.trunc(queryLimit), 1), 1_000),
        include: marketplaceListingCardInclude,
      }),
    []
  );

  if (useRankedSearch && searchCandidateIds) {
    const rank = new Map(
      searchCandidateIds.map((listingId, index) => [listingId, index])
    );
    return listings
      .toSorted(
        (a, b) =>
          (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
          (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER)
      )
      .slice(offset, offset + limit);
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
    offset: parseMarketplaceOffset(filters.offset),
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
        take: 100,
      }),
    []
  );
}

export async function getDogsForListingSelect(limit = 80) {
  return safeQuery(
    () =>
      prisma.dog.findMany({
        orderBy: { name: "asc" },
        take: Math.min(Math.max(Math.trunc(limit), 1), 200),
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
          socialActor: {
            is: {
              kind: "personal",
              published: true,
            },
          },
          user: {
            AND: [
              ...(excludeEmail ? [{ email: { not: excludeEmail } }] : []),
              { email: { not: { endsWith: "@example.invalid" } } },
            ],
            isBanned: false,
            deletionRequestedAt: null,
          },
          ...(trimmedSearch
            ? {
                OR: [
                  {
                    displayName: {
                      contains: trimmedSearch,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    kennelName: {
                      contains: trimmedSearch,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    kennelPrefix: {
                      contains: trimmedSearch,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              }
            : {}),
        },
        orderBy: [{ verified: "desc" }, { displayName: "asc" }],
        take: Math.min(Math.max(Math.trunc(limit), 1), 100),
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
          take: Math.min(Math.max(Math.trunc(limit), 1), 100),
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
              socialActor: true,
              dogsOwned: {
                orderBy: [{ verified: "desc" }, { createdAt: "desc" }],
                take: 100,
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
