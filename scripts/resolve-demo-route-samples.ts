import "./load-env";

import { pathToFileURL } from "node:url";

import { prisma } from "../src/lib/db";
import { DEMO_PROVIDER_ROUTE_PATHS } from "../src/lib/demo-route-sample-contract";
import { findDemoProviderRouteSamples } from "../src/lib/demo-route-samples";

async function main() {
  const [provider, thread] = await Promise.all([
    findDemoProviderRouteSamples(prisma),
    prisma.thread.findFirst({
      where: { category: { slug: "general" }, posts: { some: {} } },
      orderBy: [{ pinned: "desc" }, { createdAt: "asc" }, { id: "asc" }],
      select: { id: true, title: true },
    }),
  ]);

  if (!provider || !thread) {
    throw new Error("demo_route_samples.unresolved");
  }

  console.log(
    JSON.stringify(
      {
        dog: { ...provider.dog, path: DEMO_PROVIDER_ROUTE_PATHS.dog },
        meeting: {
          ...provider.meeting,
          path: DEMO_PROVIDER_ROUTE_PATHS.meeting,
        },
        race: { ...provider.race, path: DEMO_PROVIDER_ROUTE_PATHS.race },
        track: { ...provider.track, path: DEMO_PROVIDER_ROUTE_PATHS.track },
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
