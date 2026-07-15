import { databaseConfigurationError, safeQuery } from "@/lib/db";
import { withDbSystemContext } from "@/lib/db-context";
import { getApproximateTableCounts } from "@/lib/db-stats";
import { formatRaceDateInput, raceDateWindow } from "@/lib/race-time";
import { getLiveProviderConfig } from "./provider";

export async function getLiveFeedStatus() {
  const now = new Date();
  const todayInput = formatRaceDateInput(now);
  const today = raceDateWindow(todayInput).gte;
  const nextWeekInput = new Date(`${todayInput}T00:00:00.000Z`);
  nextWeekInput.setUTCDate(nextWeekInput.getUTCDate() + 7);
  const nextWeek = raceDateWindow(nextWeekInput.toISOString().slice(0, 10)).gte;

  const databaseReady =
    isDatabaseConfigured() &&
    await safeQuery(
      () => withDbSystemContext((tx) => tx.track.count()).then(() => true),
      false
    );
  const freshness = databaseReady
    ? await getDataFreshness(today, nextWeek)
    : emptyFreshness();
  const providerConfig = getLiveProviderConfig();
  const missingEnv = providerConfig.feeds.flatMap((feed) =>
    feed.blocking ? feed.missingEnv : []
  );

  return {
    status: missingEnv.length === 0 ? "configured" : "waiting_for_credentials",
    activeProvider: providerConfig.activeProvider,
    feeds: providerConfig.feeds,
    scheduler: {
      primary: "cloud_scheduler",
      primarySchedule: "*/5 * * * *",
      backup: "github_actions",
      backupSchedule: "manual_or_repository_schedule",
    },
    data: {
      database: databaseReady ? "ok" : "error",
      ...freshness,
    },
    blockers: missingEnv.length > 0 ? missingEnv.map((name) => `${name} missing`) : [],
    timestamp: now.toISOString(),
  };
}

async function getDataFreshness(today: Date, nextWeek: Date) {
  const [windowCounts, liveProviders, tableCounts, latestRace, latestResult] =
    await Promise.all([
      getWindowCounts(today, nextWeek),
      safeQuery(
        () =>
          withDbSystemContext((tx) =>
            tx.meeting.groupBy({
              by: ["sourceProvider"],
              where: {
                meetingDate: { gte: today, lte: nextWeek },
                sourceProvider: { not: null },
              },
              _count: { _all: true },
              orderBy: { sourceProvider: "asc" },
              take: 100,
            })
          ),
        []
      ),
      getApproximateTableCounts(["Result"]),
      safeQuery(
        () =>
          withDbSystemContext((tx) =>
            tx.race.findFirst({
              orderBy: { raceTime: "desc" },
              select: { raceTime: true },
            })
          ),
        null
      ),
      safeQuery(
        () =>
          withDbSystemContext((tx) =>
            tx.result.findFirst({
              where: { lastSyncedAt: { not: null } },
              orderBy: { lastSyncedAt: "desc" },
              select: { lastSyncedAt: true },
            })
          ),
        null
      ),
    ]);

  return {
    upcomingMeetings: windowCounts?.upcomingMeetings ?? null,
    upcomingRaces: windowCounts?.upcomingRaces ?? null,
    upcomingRunners: windowCounts?.upcomingRunners ?? null,
    liveSourcedMeetings: windowCounts?.liveSourcedMeetings ?? null,
    liveSourcedRaces: windowCounts?.liveSourcedRaces ?? null,
    liveProviders: liveProviders.map((provider) => ({
      name: provider.sourceProvider,
      meetings: provider._count._all,
    })),
    totalResults: tableCounts.get("Result") ?? null,
    latestRaceTime: latestRace?.raceTime?.toISOString() ?? null,
    latestResultAt: latestResult?.lastSyncedAt?.toISOString() ?? null,
  };
}

async function getWindowCounts(today: Date, nextWeek: Date) {
  const rows = await safeQuery(
    () =>
      withDbSystemContext(
        (tx) =>
          tx.$queryRaw<
            {
              upcomingMeetings: number;
              upcomingRaces: number;
              upcomingRunners: number;
              liveSourcedMeetings: number;
              liveSourcedRaces: number;
            }[]
          >`
        WITH meeting_scope AS (
          SELECT id, "sourceProvider"
          FROM "Meeting"
          WHERE "meetingDate" >= ${today}
            AND "meetingDate" <= ${nextWeek}
        ),
        race_scope AS (
          SELECT id, "sourceProvider"
          FROM "Race"
          WHERE "raceTime" >= ${today}
            AND "raceTime" <= ${nextWeek}
        )
        SELECT
          (SELECT COUNT(*)::int FROM meeting_scope) AS "upcomingMeetings",
          (SELECT COUNT(*)::int FROM race_scope) AS "upcomingRaces",
          (
            SELECT COUNT(*)::int
            FROM "Runner" rn
            JOIN race_scope rs ON rs.id = rn."raceId"
          ) AS "upcomingRunners",
          (
            SELECT COUNT(*)::int
            FROM meeting_scope
            WHERE "sourceProvider" IS NOT NULL
          ) AS "liveSourcedMeetings",
          (
            SELECT COUNT(*)::int
            FROM race_scope
            WHERE "sourceProvider" IS NOT NULL
          ) AS "liveSourcedRaces"
      `
      ),
    []
  );

  return rows[0] ?? null;
}

function emptyFreshness() {
  return {
    upcomingMeetings: null,
    upcomingRaces: null,
    upcomingRunners: null,
    liveSourcedMeetings: null,
    liveSourcedRaces: null,
    liveProviders: [],
    totalResults: null,
    latestRaceTime: null,
    latestResultAt: null,
  };
}

function isDatabaseConfigured() {
  return databaseConfigurationError() === null;
}
