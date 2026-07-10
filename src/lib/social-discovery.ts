import "server-only";

import { Prisma } from "@prisma/client";
import type { CurrentUserProfile } from "@/lib/auth-types";
import {
  type DbContextClient,
  withDbAnonymousContext,
  withDbRequestContext,
} from "@/lib/db-context";

const DISCOVERY_GROUP_LIMIT = 8;

export async function discoverSocialActorsAndDogs(
  rawQuery: string,
  current: CurrentUserProfile | null
) {
  const query = rawQuery.trim().replace(/\s+/g, " ").slice(0, 80);
  if (query.length < 2) return emptyDiscovery(query);

  const read = async (tx: DbContextClient) => {
    const actorWhere = {
      published: true,
      ownerProfile: {
        user: { isBanned: false, deletionRequestedAt: null },
      },
      OR: [
        { displayName: { contains: query, mode: "insensitive" } },
        { handle: { contains: query, mode: "insensitive" } },
      ],
    } satisfies Prisma.SocialActorWhereInput;
    const actorSelect = {
      id: true,
      kind: true,
      handle: true,
      displayName: true,
      avatarUrl: true,
      profile: { select: { verified: true, state: true } },
      page: { select: { pageType: true, tagline: true } },
    } satisfies Prisma.SocialActorSelect;
    const actorQuery = (where: Prisma.SocialActorWhereInput) =>
      tx.socialActor.findMany({
        where: { ...actorWhere, ...where },
        orderBy: [{ displayName: "asc" }, { id: "asc" }],
        take: DISCOVERY_GROUP_LIMIT,
        select: actorSelect,
      });

    const [people, trainers, dogPages, businesses, punters, dogs] =
      await Promise.all([
        actorQuery({ kind: "personal" }),
        actorQuery({ kind: "page", page: { pageType: "trainer" } }),
        actorQuery({ kind: "page", page: { pageType: "dog" } }),
        actorQuery({ kind: "page", page: { pageType: "business" } }),
        actorQuery({ kind: "page", page: { pageType: "punter" } }),
        tx.dog.findMany({
          where: {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { earBrand: { contains: query, mode: "insensitive" } },
            ],
          },
          orderBy: [{ name: "asc" }, { id: "asc" }],
          take: DISCOVERY_GROUP_LIMIT,
          select: {
            id: true,
            name: true,
            earBrand: true,
            colour: true,
            sex: true,
            trainer: { select: { name: true } },
          },
        }),
      ]);

    return {
      query,
      people,
      trainers,
      dogPages,
      businesses,
      punters,
      dogs,
    };
  };

  return current
    ? withDbRequestContext(current, read)
    : withDbAnonymousContext(read);
}

function emptyDiscovery(query: string) {
  return {
    query,
    people: [],
    trainers: [],
    dogPages: [],
    businesses: [],
    punters: [],
    dogs: [],
  };
}
