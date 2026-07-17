import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const searchSource = readFileSync(
  join(__dirname, "add-friend-search.tsx"),
  "utf8"
);
const friendsSource = readFileSync(
  join(__dirname, "hub-friends-list.tsx"),
  "utf8"
);

for (const searchContract of [
  "const [requestingId, setRequestingId]",
  "const requesting = requestingId === option.id",
  'setSearchError("Member search is unavailable. Please try again.")',
  "searchedQuery === query.trim()",
]) {
  assert.ok(
    searchSource.includes(searchContract),
    `Friend search must preserve: ${searchContract}`
  );
}
assert.ok(
  !searchSource.includes("max-h-60") &&
    !searchSource.includes("overscroll-contain"),
  "Friend search must let its containing messenger rail own scrolling"
);
for (const friendContract of [
  'aria-label="Verified member"',
  "Friend",
  'role="group"',
  "createClientCallRoom(",
  'name="profileId"',
  'name="senderActorId"',
]) {
  assert.ok(
    friendsSource.includes(friendContract),
    `Friend rail must preserve: ${friendContract}`
  );
}
for (const prohibitedPresenceContract of [
  "Online now",
  "presenceState",
  "ensureBrowserRealtimeAuthorization",
]) {
  assert.ok(
    !friendsSource.includes(prohibitedPresenceContract),
    `Friend rail must not claim or subscribe to global presence: ${prohibitedPresenceContract}`
  );
}

console.log("Friend search and rail polish contract tests passed");
