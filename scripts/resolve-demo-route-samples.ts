import "./load-env";

import { pathToFileURL } from "node:url";

import { prisma } from "../src/lib/db";
import { trackMediaPathForName } from "../src/lib/track-media";

async function main() {
  const [dog, race, trackCandidates, thread] = await Promise.all([
    prisma.dog.findFirst({
      where: { formEntries: { some: {} } },
      orderBy: [
        { careerStarts: { sort: "desc", nulls: "last" } },
        { name: "asc" },
        { id: "asc" },
      ],
      select: { id: true, name: true },
    }),
    prisma.race.findFirst({
      where: { runners: { some: {} } },
      orderBy: [{ raceTime: "desc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        raceNumber: true,
        meeting: { select: { track: { select: { name: true } } } },
      },
    }),
    prisma.track.findMany({
      where: { meetings: { some: { races: { some: {} } } } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
      take: 100,
    }),
    prisma.thread.findFirst({
      where: { category: { slug: "general" }, posts: { some: {} } },
      orderBy: [{ pinned: "desc" }, { createdAt: "asc" }, { id: "asc" }],
      select: { id: true, title: true },
    }),
  ]);
  const track = trackCandidates.find((candidate) =>
    trackMediaPathForName(candidate.name)
  );

  if (!dog || !race || !track || !thread) {
    throw new Error("demo_route_samples.unresolved");
  }

  console.log(
    JSON.stringify(
      {
        dog: { ...dog, path: `/dogs/${dog.id}` },
        race: {
          id: race.id,
          name: race.name,
          raceNumber: race.raceNumber,
          trackName: race.meeting.track.name,
          path: `/races/${race.id}`,
        },
        track: { ...track, path: `/tracks/${track.id}` },
        thread: { ...thread, path: `/groups/threads/${thread.id}` },
      },
      null,
      2
    )
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
