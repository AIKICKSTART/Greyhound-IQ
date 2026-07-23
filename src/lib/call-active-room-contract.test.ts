import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("./call-service.ts", import.meta.url),
  "utf8",
);

const start = source.indexOf("function findActiveCallRoom(");
const end = source.indexOf("\n}", start);
assert.ok(start >= 0 && end > start, "findActiveCallRoom must exist");

const activeRoomQuery = source.slice(start, end);
assert.match(activeRoomQuery, /status: "active"/);
assert.match(activeRoomQuery, /status: "pending"/);
assert.match(activeRoomQuery, /expiresAt: \{ gt: now \}/);
assert.match(activeRoomQuery, /CALL_ROOM_JOIN_TTL_MS/);
assert.match(activeRoomQuery, /joinedAt: \{ not: null \}/);
assert.match(activeRoomQuery, /leftAt: null/);
assert.doesNotMatch(activeRoomQuery, /status: "accepted"/);

const tokenStart = source.indexOf(
  "export async function createCallTokenForCurrentUser(",
);
const tokenEnd = source.indexOf(
  "\nexport async function endCallRoomForCurrentUser(",
  tokenStart,
);
const tokenIssue = source.slice(tokenStart, tokenEnd);
assert.match(tokenIssue, /data: \{ lastTokenIssuedAt: issuedAt \}/);
assert.doesNotMatch(tokenIssue, /data: \{[\s\S]*joinedAt: issuedAt/);

console.log("Active call room freshness contract passed");
