import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  getAgentRunPresentation,
  isAgentRunCancellable,
} from "./agent-run-lifecycle";

assert.deepEqual(
  ["pending", "running", "completed", "cancelled", "failed"].map(
    (status) => getAgentRunPresentation(status).state,
  ),
  ["pending", "running", "completed", "interrupted", "failed"],
);
assert.equal(getAgentRunPresentation("canceled").state, "interrupted");
assert.equal(getAgentRunPresentation("unknown-provider-state").state, "failed");
assert.equal(isAgentRunCancellable("pending"), true);
assert.equal(isAgentRunCancellable("running"), true);
assert.equal(isAgentRunCancellable("completed"), false);
assert.equal(isAgentRunCancellable("cancelled"), false);
assert.equal(isAgentRunCancellable("failed"), false);

const buttonSource = readFileSync(
  "src/components/agent-run-cancel-button.tsx",
  "utf8",
);
const pageSource = readFileSync("src/app/agents/page.tsx", "utf8");
const cancelRouteSource = readFileSync(
  "src/app/api/agents/runs/[id]/cancel/route.ts",
  "utf8",
);
const runRouteSource = readFileSync(
  "src/app/api/agents/[type]/run/route.ts",
  "utf8",
);
const serviceSource = readFileSync("src/lib/agent-service.ts", "utf8");

for (const contract of [
  /encodeURIComponent\(runId\)/,
  /method: "POST"/,
  /credentials: "same-origin"/,
  /payload\?\.item\?\.id !== runId/,
  /requestState === "submitting" \|\| requestState === "success"/,
  /router\.refresh\(\)/,
  /role=\{requestState === "error" \? "alert" : "status"\}/,
  /Could not cancel this run\. Refresh its status and try again\./,
]) {
  assert.match(buttonSource, contract);
}
assert.match(pageSource, /<AgentRunCancelButton runId=\{run\.id\} status=\{run\.status\} \/>/);
assert.match(pageSource, /getAgentRunPresentation\(run\.status\)/);

assert.match(cancelRouteSource, /requireCurrentUserProfile\(\)/);
assert.match(cancelRouteSource, /agent-run:cancel:\$\{current\.dbUserId\}/);
assert.match(cancelRouteSource, /cancelAgentRunForCurrentUser\(current, id\)/);
assert.match(cancelRouteSource, /item:\s*\{[\s\S]*?id: cancelled\.id,/);
assert.doesNotMatch(cancelRouteSource, /item: cancelled\s*\}/);
for (const forbiddenField of ["inputJson", "outputJson", "harnessSessionId"] as const) {
  assert.doesNotMatch(cancelRouteSource, new RegExp(forbiddenField));
  assert.doesNotMatch(runRouteSource, new RegExp(forbiddenField));
  assert.doesNotMatch(pageSource, new RegExp(`run\\.${forbiddenField}`));
}

assert.match(serviceSource, /run\.userId !== current\.dbUserId/);
assert.match(serviceSource, /run\.status !== "pending" && run\.status !== "running"/);

console.log(
  "Agent run lifecycle passed: pending, running, completed, interrupted and failed states plus an ownership-scoped cancel control.",
);
