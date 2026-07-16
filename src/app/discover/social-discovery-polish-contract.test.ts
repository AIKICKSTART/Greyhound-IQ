import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const discoverSource = readFileSync(join(__dirname, "page.tsx"), "utf8");
const forumSource = readFileSync(
  join(__dirname, "..", "forum", "page.tsx"),
  "utf8"
);
const groupsSource = readFileSync(
  join(__dirname, "..", "groups", "page.tsx"),
  "utf8"
);
const discoverLoadingSource = readFileSync(
  join(__dirname, "loading.tsx"),
  "utf8"
);
const forumLoadingSource = readFileSync(
  join(__dirname, "..", "forum", "loading.tsx"),
  "utf8"
);

for (const discoveryContract of [
  "discoverSocialActorsAndDogs(q, current)",
  'action="/discover"',
  'name="q"',
  'minLength={2}',
  'maxLength={80}',
  'href={`/p/${actor.handle}`}',
  'href={`/dogs/${dog.id}`}',
  'role="search"',
]) {
  assert.ok(
    discoverSource.includes(discoveryContract),
    `Discovery must preserve: ${discoveryContract}`
  );
}
for (const groupLabel of [
  "People",
  "Trainer pages",
  "Dog pages",
  "Businesses",
  "Punter pages",
  "Greyhounds",
]) {
  assert.ok(
    discoverSource.includes(groupLabel),
    `Discovery must retain the ${groupLabel} result group`
  );
}

assert.ok(
  forumSource.includes("getCurrentUser()") &&
    forumSource.includes("signedIn ? (") &&
    forumSource.includes("<CommunityMemberHeader") &&
    forumSource.includes("<PageHero"),
  "Groups must keep compact member and cinematic signed-out headers"
);
for (const signedOutContract of [
  'image="/images/feed/posts/lisa-community-night.webp"',
  "GreyhoundIQ Groups.",
  "Signal over noise.",
  "Join public community groups for races, breeding, ownership, marketplace discussion, and track intelligence with the same clean, data-first experience as the racing tools.",
]) {
  assert.ok(
    forumSource.includes(signedOutContract),
    `Signed-out Groups hero must preserve: ${signedOutContract}`
  );
}
for (const communityContract of [
  "getForumOverview()",
  "getRecentThreads(8)",
  'href={`/groups/${category.slug}`}',
  'href={`/groups/threads/${thread.id}`}',
  'href="/marketplace"',
  "Math.max(thread._count.posts - 1, 0)",
]) {
  assert.ok(
    forumSource.includes(communityContract),
    `Groups must preserve: ${communityContract}`
  );
}
assert.ok(
  !forumSource.includes("overflow-y-auto") &&
    !discoverSource.includes("overflow-y-auto"),
  "Community pages must leave scrolling to the app shell"
);
for (const loadingSource of [discoverLoadingSource, forumLoadingSource]) {
  assert.ok(
    loadingSource.includes("<SkeletonGroup") &&
      loadingSource.includes("h-11") &&
      !loadingSource.includes("overflow-y-auto"),
    "Community loading states must stay responsive and shell-scroll safe"
  );
}
assert.ok(
  forumLoadingSource.includes("[.giq-member-shell_&]:block") &&
    forumLoadingSource.includes("[.giq-public-shell_&]:flex") &&
    forumLoadingSource.includes("min-h-[420px]"),
  "Groups loading must match compact member and cinematic public header geometry"
);
assert.ok(
  groupsSource.includes('from "../forum/page"') &&
    groupsSource.includes("export default GroupsPage"),
  "/groups must continue to share the audited forum page implementation"
);

console.log("Social discovery and community polish contract tests passed");
