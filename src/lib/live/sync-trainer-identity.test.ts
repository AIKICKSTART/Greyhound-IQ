import assert from "node:assert/strict";

import { ensureTrainers } from "./sync";
import type { LiveFeedQuarantineInput } from "./quarantine";

void main();

async function main() {
  const quarantine: LiveFeedQuarantineInput[] = [];
  const createdIdentities: Record<string, unknown>[] = [];
  const created = await ensureTrainers(
    {
      trainer: {
        findMany: async () => [],
        create: async () => ({ id: "trainer-canonical-1" }),
      },
      trainerProviderIdentity: {
        findMany: async () => [],
        create: async ({ data }: { data: Record<string, unknown> }) => {
          createdIdentities.push(data);
          return data;
        },
        update: async () => {
          throw new Error("new identity must not update an existing mapping");
        },
      },
    } as never,
    [
      {
        sourceProvider: "thedogs",
        runner: {
          sourceProvider: "thedogs",
          trainerSourceId: "10792",
          trainerName: "Exact Trainer",
          trainerProfileUrl:
            "https://www.thedogs.com.au/trainers/10792/exact-trainer",
        },
      },
    ] as never,
    { requestId: "trainer-test" } as never,
    quarantine,
  );
  assert.equal(created.get("thedogs:10792"), "trainer-canonical-1");
  assert.equal(createdIdentities[0]?.sourceId, "10792");
  assert.equal(createdIdentities[0]?.verificationStatus, "verified");
  assert.equal(quarantine.length, 0);

  const conflictQueue: LiveFeedQuarantineInput[] = [];
  let createCalls = 0;
  const blocked = await ensureTrainers(
    {
      trainer: {
        findMany: async () => [{ id: "same-name-without-provider-proof" }],
        create: async () => {
          createCalls += 1;
          return { id: "must-not-create" };
        },
      },
      trainerProviderIdentity: {
        findMany: async () => [],
        create: async () => {
          throw new Error("name-only candidate must not receive an identity");
        },
        update: async () => ({}),
      },
    } as never,
    [
      {
        sourceProvider: "watchdog",
        runner: {
          sourceProvider: "watchdog",
          trainerSourceId: "44",
          trainerName: "Possible Existing Trainer",
        },
      },
    ] as never,
    { requestId: "trainer-test" } as never,
    conflictQueue,
  );
  assert.equal(blocked.size, 0);
  assert.equal(createCalls, 0);
  assert.equal(conflictQueue[0]?.reasonCode, "possible_existing_candidate");

  console.log("live trainer identity sync tests passed");
}
