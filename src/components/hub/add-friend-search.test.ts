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

assert.doesNotMatch(component, /if \(!q\) return/);
assert.match(
  component,
  /const visibleOptions = options\.filter\(\(option\) => !excluded\.has\(option\.id\)\)/,
);
assert.match(
  queries,
  /socialActor:\s*\{\s*is:\s*\{\s*kind: "personal",\s*published: true,/,
);
assert.match(queries, /kennelName:\s*\{\s*contains: trimmedSearch,/);
assert.match(queries, /kennelPrefix:\s*\{\s*contains: trimmedSearch,/);
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
