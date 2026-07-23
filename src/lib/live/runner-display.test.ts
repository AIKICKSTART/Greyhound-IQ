import assert from "node:assert/strict";

import {
  resolveRunnerTrainerName,
  resolveRunnerWeight,
} from "./runner-display";

assert.equal(
  resolveRunnerTrainerName({
    runnerTrainerName: "Andrea Gurry",
    dogTrainerName: "Fallback Trainer",
    sourceRawJson: JSON.stringify({ trainer: "Raw Trainer" }),
  }),
  "Andrea Gurry",
);
assert.equal(
  resolveRunnerTrainerName({
    sourceRawJson: JSON.stringify({ trainer: "Jason Sharp" }),
  }),
  "Jason Sharp",
);
assert.equal(
  resolveRunnerTrainerName({
    sourceRawJson: JSON.stringify({
      trainerProfileUrl: "/trainers/10792/ashleigh-kay",
    }),
  }),
  "Ashleigh Kay",
);
assert.equal(
  resolveRunnerTrainerName({
    sourceRawJson: JSON.stringify({
      trainerProfileUrl: "https://attacker.example/trainers/1/not-trusted",
    }),
  }),
  null,
);
assert.equal(resolveRunnerTrainerName({ sourceRawJson: "not-json" }), null);

assert.equal(resolveRunnerWeight({ runnerWeight: 31.4, formWeight: 29 }), 31.4);
assert.equal(resolveRunnerWeight({ runnerWeight: null, formWeight: 29 }), 29);
assert.equal(
  resolveRunnerWeight({
    sourceRawJson: JSON.stringify({ resultWeight: "34.9" }),
  }),
  34.9,
);
assert.equal(
  resolveRunnerWeight({
    sourceRawJson: JSON.stringify({ resultWeight: 0, weight: 100 }),
  }),
  null,
);

console.log("runner display recovery tests passed");
