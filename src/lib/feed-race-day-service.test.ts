import assert from "node:assert/strict";

import {
  approvedClaimedDogRunnerWhere,
  approvedClaimedTrainerRunnerWhere,
} from "./feed-race-day-service";

const where = approvedClaimedDogRunnerWhere(
  "profile-approved-owner",
  new Date("2026-07-24T01:00:00.000Z"),
);

assert.deepEqual(where, {
  race: {
    raceTime: {
      gte: new Date("2026-07-23T14:00:00.000Z"),
      lt: new Date("2026-07-24T14:00:00.000Z"),
    },
  },
  dog: {
    ownership: {
      some: {
        profileId: "profile-approved-owner",
        status: "approved",
        verified: true,
      },
    },
  },
});

console.log(
  "Feed race-day claim authorization passed: only the signed-in profile's approved and verified dog links are queried.",
);

assert.deepEqual(
  approvedClaimedTrainerRunnerWhere(
    "profile-approved-trainer",
    new Date("2026-07-24T01:00:00.000Z"),
  ),
  {
    race: {
      raceTime: {
        gte: new Date("2026-07-23T14:00:00.000Z"),
        lt: new Date("2026-07-24T14:00:00.000Z"),
      },
    },
    trainer: {
      is: {
        claims: {
          some: {
            profileId: "profile-approved-trainer",
            status: "approved",
            verified: true,
          },
        },
      },
    },
  },
);
