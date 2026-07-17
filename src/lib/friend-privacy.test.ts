import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const service = readFileSync(join(__dirname, "friend-service.ts"), "utf8");
const inbox = readFileSync(join(__dirname, "..", "app", "messages", "page.tsx"), "utf8");
const friends = readFileSync(
  join(__dirname, "..", "app", "messages", "friends", "page.tsx"),
  "utf8"
);

assert.ok(
  !service.includes("email: friend.user") && !service.includes("email: true"),
  "Friend list queries and DTOs must not expose private account email"
);
assert.ok(
  !inbox.includes("friend.email") && !friends.includes("friend.email"),
  "Pulse friend surfaces must use public profile metadata instead of account email"
);

console.log("friend list privacy tests passed");
