import { cache } from "react";
import { prisma } from "@/lib/db";
import { safeQuery } from "@/lib/db";

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
  const until = new Date();
  until.setDate(until.getDate() + days);

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
