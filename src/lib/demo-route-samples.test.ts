import assert from "node:assert/strict";

import { DEMO_PROVIDER_ROUTE_IDS } from "./demo-route-sample-contract";
import {
  findDemoProviderRouteSamples,
  resolveDemoProviderRouteId,
} from "./demo-route-samples";

const selected = {
  id: "provider-race-id",
  meeting: { id: "provider-meeting-id", track: { id: "provider-track-id" } },
  runners: [{ dog: { id: "provider-dog-id" } }],
};
const selectedIds = {
  dog: selected.runners[0].dog.id,
  meeting: selected.meeting.id,
  race: selected.id,
  track: selected.meeting.track.id,
};
let queries = 0;
let query: unknown;
const db = {
  race: {
    async findFirst(args: unknown) {
      queries += 1;
      query = args;
      return selected;
    },
  },
};
const demo = { APP_ENV: "demo", DEMO_AUTH_MODE: "full-access" };

async function main() {
  assert.deepEqual(await findDemoProviderRouteSamples(db as never), {
    dog: { id: "provider-dog-id" },
    meeting: { id: "provider-meeting-id" },
    race: { id: "provider-race-id" },
    track: { id: "provider-track-id" },
  });
  assert.deepEqual(
    (query as { orderBy: unknown }).orderBy,
    [
      { raceTime: "desc" },
      { sourceProvider: "asc" },
      { sourceId: "asc" },
      { id: "asc" },
    ],
  );
  for (const kind of Object.keys(DEMO_PROVIDER_ROUTE_IDS) as Array<
    keyof typeof DEMO_PROVIDER_ROUTE_IDS
  >) {
    assert.equal(
      await resolveDemoProviderRouteId(kind, DEMO_PROVIDER_ROUTE_IDS[kind], {
        db: db as never,
        env: demo,
      }),
      selectedIds[kind],
    );
  }
  assert.equal(
    await resolveDemoProviderRouteId("dog", "real-dog-id", {
      db: db as never,
      env: demo,
    }),
    "real-dog-id",
  );
  assert.equal(
    await resolveDemoProviderRouteId("dog", DEMO_PROVIDER_ROUTE_IDS.dog, {
      db: db as never,
      env: { APP_ENV: "production", DEMO_AUTH_MODE: "full-access" },
    }),
    DEMO_PROVIDER_ROUTE_IDS.dog,
  );
  assert.equal(queries, 5);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

console.log("demo provider route sample tests passed");
