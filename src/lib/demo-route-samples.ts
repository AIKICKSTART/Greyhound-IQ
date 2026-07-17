import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { isFullAccessDemo, type DemoAccessEnv } from "@/lib/demo-access";
import {
  DEMO_PROVIDER_ROUTE_IDS,
  type DemoProviderRouteKind,
} from "@/lib/demo-route-sample-contract";

type DemoProviderRouteClient = Pick<Prisma.TransactionClient, "race">;

export async function findDemoProviderRouteSamples(
  db: DemoProviderRouteClient,
) {
  const race = await db.race.findFirst({
    where: {
      sourceProvider: { not: "greyhoundiq-demo" },
      sourceId: { not: null },
      meeting: {
        sourceProvider: { not: "greyhoundiq-demo" },
        sourceId: { not: null },
      },
      runners: {
        some: {
          sourceProvider: { not: "greyhoundiq-demo" },
          sourceId: { not: null },
        },
      },
    },
    orderBy: [
      { raceTime: "desc" },
      { sourceProvider: "asc" },
      { sourceId: "asc" },
      { id: "asc" },
    ],
    select: {
      id: true,
      meeting: { select: { id: true, track: { select: { id: true } } } },
      runners: {
        where: {
          sourceProvider: { not: "greyhoundiq-demo" },
          sourceId: { not: null },
        },
        orderBy: { boxNumber: "asc" },
        take: 1,
        select: { dog: { select: { id: true } } },
      },
    },
  });
  const dog = race?.runners[0]?.dog;
  if (!race || !dog) return null;

  return {
    dog,
    meeting: { id: race.meeting.id },
    race: { id: race.id },
    track: { id: race.meeting.track.id },
  };
}

export async function resolveDemoProviderRouteId(
  kind: DemoProviderRouteKind,
  id: string,
  options: {
    db?: DemoProviderRouteClient;
    env?: DemoAccessEnv;
  } = {},
) {
  if (!isFullAccessDemo(options.env) || id !== DEMO_PROVIDER_ROUTE_IDS[kind]) {
    return id;
  }
  const samples = await findDemoProviderRouteSamples(options.db ?? prisma);
  return samples?.[kind].id ?? id;
}
