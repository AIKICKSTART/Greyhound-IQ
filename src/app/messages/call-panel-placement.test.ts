import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "[id]", "page.tsx"), "utf8");
const thread = source.indexOf(
  '<section className="giq-social-thread-panel giq-panel">'
);
const priorityPanel = source.indexOf(
  "{prioritizeCallPanel && callPanel}",
  thread
);
const history = source.indexOf('<div className="space-y-4 p-5">', thread);
const defaultPanel = source.indexOf(
  "{!prioritizeCallPanel && callPanel}",
  history
);

assert.ok(thread >= 0, "Pulse must render the conversation thread");
assert.ok(
  source.includes(
    "callableIntent !== null ||\n    activeCallRoom !== null ||\n    pendingCallInvite !== null"
  ),
  "Direct call actions, active rooms, and pending invites must receive priority"
);
assert.ok(
  priorityPanel > thread && priorityPanel < history,
  "Priority call surfaces must render before message history"
);
assert.ok(
  defaultPanel > history,
  "Idle call controls must remain after message history"
);

console.log("Pulse call panel placement tests passed");
