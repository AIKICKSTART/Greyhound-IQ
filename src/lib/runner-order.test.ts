import assert from "node:assert/strict";

import { orderRunners, type RunnerTailSort } from "./runner-order";

const runners = [
  runner("unknown", 2, null),
  runner("third", 7, 3, 30.8),
  runner("scratched", 1, null, null, true),
  runner("fifth", 3, 5, 31.2),
  runner("winner", 8, 1, 30.1),
  runner("fourth", 6, 4, 30.9),
  runner("second", 4, 2, 30.4),
];

for (const sort of ["finish", "box", "time", "name"] satisfies RunnerTailSort[]) {
  const ordered = orderRunners(runners, sort);
  assert.deepEqual(ordered.slice(0, 3).map((row) => row.name), [
    "winner",
    "second",
    "third",
  ]);
  assert.equal(ordered.at(-2)?.name, "unknown");
  assert.equal(ordered.at(-1)?.name, "scratched");
}

assert.deepEqual(orderRunners(runners, "finish").map((row) => row.name), [
  "winner",
  "second",
  "third",
  "fourth",
  "fifth",
  "unknown",
  "scratched",
]);

console.log("runner ordering tests passed");

function runner(
  name: string,
  boxNumber: number,
  finishingPosition: number | null,
  runningTime: number | null = null,
  scratched = false
) {
  return {
    name,
    boxNumber,
    scratched,
    dog: { name },
    result:
      finishingPosition == null && runningTime == null
        ? null
        : { finishingPosition, runningTime },
  };
}
