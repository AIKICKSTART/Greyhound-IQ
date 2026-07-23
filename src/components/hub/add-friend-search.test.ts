import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const component = readFileSync(
  new URL("./add-friend-search.tsx", import.meta.url),
  "utf8",
);
const queries = readFileSync(
  new URL("../../lib/queries.ts", import.meta.url),
  "utf8",
);
const route = readFileSync(
  new URL("../../app/api/profiles/messaging/route.ts", import.meta.url),
  "utf8",
);
const friendsPage = readFileSync(
  new URL("../../app/messages/friends/page.tsx", import.meta.url),
  "utf8",
);
const friendService = readFileSync(
  new URL("../../lib/friend-service.ts", import.meta.url),
  "utf8",
);
const conversationDock = readFileSync(
  new URL("./hub-conversation-dock.tsx", import.meta.url),
  "utf8",
);
const rootLayout = readFileSync(
  new URL("../../app/layout.tsx", import.meta.url),
  "utf8",
);

// Owner ruling 2026-07-23: the member list stays empty until the user types —
// an empty query must never fetch the browsable directory.
assert.match(component, /if \(!q\) \{/);
assert.match(component, /Start typing a name, kennel or business/);
assert.match(
  component,
  /new Map\(options\.map\(\(option\) => \[option\.id, option\]\)\)/,
);
assert.match(
  queries,
  /socialActor:\s*\{\s*is:\s*\{\s*kind: "personal",\s*published: true,/,
);
assert.match(queries, /kennelName:\s*\{\s*contains: trimmedSearch,/);
assert.match(queries, /kennelPrefix:\s*\{\s*contains: trimmedSearch,/);
assert.match(queries, /name:\s*\{\s*contains: trimmedSearch,/);
assert.match(queries, /customPages:\s*\{\s*some:\s*\{/);
assert.match(queries, /id: \{ not: current\.profileId \}/);
assert.match(
  queries,
  /userBlocksInitiated:\s*\{\s*none: \{ blockedProfileId: current\.profileId \}/,
);
assert.match(queries, /profileVisibility: \{ in: \["public", "members"\] \}/);
assert.match(queries, /profileVisibility: "connections"/);
assert.match(queries, /new Map\(profiles\.map\(\(profile\) => \[profile\.id, profile\]\)\)/);
assert.match(route, /relationshipState: profile\.relationshipState/);
assert.match(component, /relationshipState === "blocked"/);
assert.match(component, /relationshipState === "friends"/);
assert.match(component, /relationshipState === "pending"/);
assert.match(friendsPage, /<AddFriendSearch/);
assert.match(friendsPage, /listFriendRequestsForProfile\(dbContext\)/);
assert.match(friendsPage, /id="requests"/);
assert.match(friendsPage, /Accept friend request from/);
assert.match(friendsPage, /Decline friend request from/);
assert.match(friendService, /href: "\/pulse\/friends#requests"/);
assert.match(conversationDock, /setLauncherTab\("friends"\)/);
assert.match(conversationDock, /setLauncherTab\("requests"\)/);
assert.match(conversationDock, /respondToFriendRequestAction/);
assert.match(rootLayout, /friends=\{friends\}/);
assert.match(rootLayout, /requests=\{requests\}/);

console.log("messenger friend discovery contract passed");
