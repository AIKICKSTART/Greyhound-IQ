import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "[id]", "page.tsx"), "utf8");

// The conversation view consolidated onto the shared dock surface. The call
// panel is reused as a banner, still gate-driven (Pro+ initiate) and only shown
// when a call is active, ringing, or intended.
assert.ok(
  source.includes("<PulseThreadSurface"),
  "Pulse thread must render the consolidated dock surface",
);
assert.ok(
  source.includes("<ConversationCallPanel") &&
    source.includes("canStartCall={canStartCall}"),
  "The reused call panel must receive the server-derived entitlement",
);
assert.ok(
  source.includes('hasTier(user.tier, "pro_plus")'),
  "Starting a call must require Pro+",
);
assert.ok(
  source.includes(
    "callableIntent !== null ||\n    activeCallRoom !== null ||\n    pendingCallInvite !== null",
  ),
  "Direct call actions, active rooms, and pending invites must surface the call banner",
);

console.log("Pulse call panel placement tests passed");
