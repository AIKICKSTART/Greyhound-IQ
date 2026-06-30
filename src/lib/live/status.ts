import { prisma, safeQuery } from "@/lib/db";
import { getLiveProviderConfig } from "./provider";

export async function getLiveFeedStatus() {
  const now = new Date();
  const today = startOfDay(now);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const databaseReady = await safeQuery(
    () => prisma.track.count().then(() => true),
    false
  );
  const freshness = databaseReady
    ? await getDataFreshness(today, nextWeek)
    : emptyFreshness();
  const providerConfig = getLiveProviderConfig();
  const missingEnv = providerConfig.feeds.flatMap((feed) => feed.missingEnv);

  return {
    status: missingEnv.length === 0 ? "configured" : "waiting_for_credentials",
    activeProvider: providerConfig.activeProvider,
    feeds: providerConfig.feeds,
    scheduler: {
      primary: "github_actions",
      primarySchedule: "*/5 * * * *",
      backup: "vercel_cron",
      backupSchedule: "0 16 * * *",
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
  const upcomingMeetings = await safeQuery(
    () =>
      prisma.meeting.count({
        where: { meetingDate: { gte: today, lte: nextWeek } },
      }),
    null
  );
  const upcomingRaces = await safeQuery(
    () =>
      prisma.race.count({
        where: { raceTime: { gte: today, lte: nextWeek } },
      }),
    null
  );
  const upcomingRunners = await safeQuery(
    () =>
      prisma.runner.count({
        where: { race: { raceTime: { gte: today, lte: nextWeek } } },
      }),
    null
  );
  const totalResults = await safeQuery(() => prisma.result.count(), null);
  const latestRace = await safeQuery(
    () =>
      prisma.race.findFirst({
        orderBy: { raceTime: "desc" },
        select: { raceTime: true },
      }),
    null
  );
  const latestResult = await safeQuery(
    () =>
      prisma.result.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      null
  );

  return {
    upcomingMeetings,
    upcomingRaces,
    upcomingRunners,
    totalResults,
    latestRaceTime: latestRace?.raceTime?.toISOString() ?? null,
    latestResultAt: latestResult?.createdAt?.toISOString() ?? null,
  };
}

function emptyFreshness() {
  return {
    upcomingMeetings: null,
    upcomingRaces: null,
    upcomingRunners: null,
    totalResults: null,
    latestRaceTime: null,
    latestResultAt: null,
  };
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
