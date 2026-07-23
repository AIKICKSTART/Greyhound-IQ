import assert from "node:assert/strict";

import { runFeedReadTasks } from "./feed-read-tasks";

async function main() {
  let active = 0;
  let peak = 0;
  const task = (value: string) => async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise<void>((resolve) => setImmediate(resolve));
    active -= 1;
    return value;
  };

  const sequential = await runFeedReadTasks(
    [task("topics"), task("feed"), task("friends")] as const,
    true
  );
  assert.deepEqual(sequential, ["topics", "feed", "friends"]);
  assert.equal(peak, 1, "demo reads must not compete for the one-connection pool");

  active = 0;
  peak = 0;
  const parallel = await runFeedReadTasks(
    [task("topics"), task("feed"), task("friends")] as const,
    false
  );
  assert.deepEqual(parallel, ["topics", "feed", "friends"]);
  assert.equal(peak, 3, "non-demo Feed reads must retain parallel loading");

  console.log("feed read task scheduling tests passed");
}

void main();
