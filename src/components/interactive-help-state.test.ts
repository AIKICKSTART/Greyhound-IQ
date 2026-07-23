import assert from "node:assert/strict";

import {
  DEFAULT_INTERACTIVE_HELP_PROGRESS_STATE,
  DEFAULT_INTERACTIVE_HELP_STATE,
  buildInteractiveHelpIntentStorageKey,
  buildLegacyInteractiveHelpProgressStorageKey,
  buildInteractiveHelpProgressStorageKey,
  listRecentlyCompletedInteractiveHelpTours,
  parseInteractiveHelpProgressStorageKey,
  parseInteractiveHelpProgressState,
  parseInteractiveHelpIntent,
  parseInteractiveHelpState,
  reduceInteractiveHelpProgressState,
  reduceInteractiveHelpState,
  resolveInteractiveHelpProductArea,
  serializeInteractiveHelpProgressState,
  serializeInteractiveHelpState,
} from "./interactive-help-state";

assert.deepEqual(parseInteractiveHelpState(null), {
  completed: false,
  enabled: true,
});
assert.deepEqual(parseInteractiveHelpState("not-json"), DEFAULT_INTERACTIVE_HELP_STATE);
assert.deepEqual(
  parseInteractiveHelpState('{"completed":"yes","enabled":true}'),
  DEFAULT_INTERACTIVE_HELP_STATE
);

const completed = reduceInteractiveHelpState(
  DEFAULT_INTERACTIVE_HELP_STATE,
  "complete"
);
assert.deepEqual(completed, { completed: true, enabled: true });
assert.deepEqual(reduceInteractiveHelpState(completed, "disable"), {
  completed: true,
  enabled: false,
});
assert.deepEqual(reduceInteractiveHelpState(completed, "restart"), {
  completed: false,
  enabled: true,
});
assert.deepEqual(reduceInteractiveHelpState(completed, "enable"), {
  completed: false,
  enabled: true,
});
assert.equal(
  serializeInteractiveHelpState({ completed: true, enabled: false }),
  '{"completed":true,"enabled":false}'
);

assert.equal(parseInteractiveHelpIntent("racing"), "racing");
assert.equal(parseInteractiveHelpIntent("agents"), "agents");
assert.equal(parseInteractiveHelpIntent("admin"), null);
assert.equal(parseInteractiveHelpIntent(null), null);
assert.equal(
  buildInteractiveHelpIntentStorageKey("profile-a"),
  "greyhoundiq.interactive-help.intent:profile-a",
);
assert.equal(
  buildInteractiveHelpIntentStorageKey(null),
  "greyhoundiq.interactive-help.intent:browser",
);

assert.deepEqual(
  parseInteractiveHelpProgressState(null),
  DEFAULT_INTERACTIVE_HELP_PROGRESS_STATE,
);
for (const invalid of [
  "not-json",
  '{"completed":false,"dismissed":false,"enabled":true,"step":-1}',
  '{"completed":false,"dismissed":false,"enabled":true,"step":"1"}',
]) {
  assert.deepEqual(
    parseInteractiveHelpProgressState(invalid),
    DEFAULT_INTERACTIVE_HELP_PROGRESS_STATE,
  );
}

let progress = reduceInteractiveHelpProgressState(
  DEFAULT_INTERACTIVE_HELP_PROGRESS_STATE,
  "next",
);
assert.deepEqual(progress, {
  completed: false,
  completedAt: null,
  dismissed: false,
  enabled: true,
  step: 1,
});
progress = reduceInteractiveHelpProgressState(progress, "dismiss");
assert.equal(progress.dismissed, true);
progress = reduceInteractiveHelpProgressState(progress, "resume");
assert.equal(progress.dismissed, false);
assert.equal(progress.step, 1);
progress = reduceInteractiveHelpProgressState(progress, {
  type: "set-step",
  step: 4,
});
assert.equal(progress.step, 4);
assert.deepEqual(reduceInteractiveHelpProgressState(progress, "restart"), {
  completed: false,
  completedAt: null,
  dismissed: false,
  enabled: true,
  step: 0,
});
assert.equal(
  serializeInteractiveHelpProgressState(progress),
  '{"completed":false,"completedAt":null,"dismissed":false,"enabled":true,"step":4}',
);

const scopedKey = buildInteractiveHelpProgressStorageKey({
  productArea: "administration",
  profileScope: "profile-a",
  role: "admin",
  route: "/admin/users",
  tier: "pro",
  tourId: "tour:administrator:v1",
  version: 1,
});
assert.deepEqual(parseInteractiveHelpProgressStorageKey(scopedKey), {
  productArea: "administration",
  profileScope: "profile-a",
  role: "admin",
  route: "/admin/users",
  tier: "pro",
  tourId: "tour:administrator:v1",
  version: 1,
});
const legacyScopedKey = buildLegacyInteractiveHelpProgressStorageKey({
  profileScope: "profile-a",
  route: "/admin/users",
  tourId: "tour:administrator:v1",
  version: 1,
});
assert.deepEqual(parseInteractiveHelpProgressStorageKey(legacyScopedKey), {
  productArea: null,
  profileScope: "profile-a",
  role: null,
  route: "/admin/users",
  tier: null,
  tourId: "tour:administrator:v1",
  version: 1,
});
for (const invalidKey of [
  "unrelated.preference",
  "greyhoundiq.interactive-help.progress:profile-a:not-a-tour:v1:%2Fadmin",
  "greyhoundiq.interactive-help.progress:profile-a:tour%3Aaccount%3Av1:v0:%2Faccount",
  "greyhoundiq.interactive-help.progress:profile-a:tour%3Aaccount%3Av1:v1:not-a-route",
]) {
  assert.equal(parseInteractiveHelpProgressStorageKey(invalidKey), null);
}
assert.notEqual(
  scopedKey,
  buildInteractiveHelpProgressStorageKey({
    productArea: "administration",
    profileScope: "profile-b",
    role: "admin",
    route: "/admin/users",
    tier: "pro",
    tourId: "tour:administrator:v1",
    version: 1,
  }),
);
assert.notEqual(
  scopedKey,
  buildInteractiveHelpProgressStorageKey({
    productArea: "administration",
    profileScope: "profile-a",
    role: "admin",
    route: "/admin/usage",
    tier: "pro",
    tourId: "tour:administrator:v1",
    version: 1,
  }),
);
assert.notEqual(
  scopedKey,
  buildInteractiveHelpProgressStorageKey({
    productArea: "administration",
    profileScope: "profile-a",
    role: "admin",
    route: "/admin/users",
    tier: "pro",
    tourId: "tour:administrator:v1",
    version: 2,
  }),
);
for (const changedContextKey of [
  buildInteractiveHelpProgressStorageKey({
    productArea: "account",
    profileScope: "profile-a",
    role: "admin",
    route: "/admin/users",
    tier: "pro",
    tourId: "tour:administrator:v1",
    version: 1,
  }),
  buildInteractiveHelpProgressStorageKey({
    productArea: "administration",
    profileScope: "profile-a",
    role: "moderator",
    route: "/admin/users",
    tier: "pro",
    tourId: "tour:administrator:v1",
    version: 1,
  }),
  buildInteractiveHelpProgressStorageKey({
    productArea: "administration",
    profileScope: "profile-a",
    role: "admin",
    route: "/admin/users",
    tier: "premium",
    tourId: "tour:administrator:v1",
    version: 1,
  }),
]) {
  assert.notEqual(scopedKey, changedContextKey);
}

assert.equal(
  resolveInteractiveHelpProductArea("tour:racing-intelligence:v2"),
  "racing",
);
assert.equal(
  resolveInteractiveHelpProductArea("tour:administrator:v2"),
  "administration",
);
assert.equal(resolveInteractiveHelpProductArea("tour:unknown:v1"), "general");

const olderCompletedKey = buildInteractiveHelpProgressStorageKey({
  productArea: "account",
  profileScope: "profile-a",
  role: "member",
  route: "/account",
  tier: "free",
  tourId: "tour:account:v1",
  version: 1,
});
const newestCompletedKey = buildInteractiveHelpProgressStorageKey({
  productArea: "agents",
  profileScope: "profile-a",
  role: "member",
  route: "/agents",
  tier: "free",
  tourId: "tour:agents:v1",
  version: 1,
});
const otherProfileKey = buildInteractiveHelpProgressStorageKey({
  productArea: "account",
  profileScope: "profile-b",
  role: "member",
  route: "/account",
  tier: "free",
  tourId: "tour:account:v1",
  version: 1,
});
const completedAt = Date.UTC(2026, 6, 15, 10, 30);
const completedProgress = reduceInteractiveHelpProgressState(
  DEFAULT_INTERACTIVE_HELP_PROGRESS_STATE,
  { type: "complete", completedAt },
);
assert.deepEqual(completedProgress, {
  completed: true,
  completedAt,
  dismissed: false,
  enabled: true,
  step: 0,
});
assert.deepEqual(
  listRecentlyCompletedInteractiveHelpTours(
    [
      [olderCompletedKey, serializeInteractiveHelpProgressState({
        ...completedProgress,
        completedAt: completedAt - 1_000,
      })],
      [newestCompletedKey, serializeInteractiveHelpProgressState(completedProgress)],
      [otherProfileKey, serializeInteractiveHelpProgressState({
        ...completedProgress,
        completedAt: completedAt + 1_000,
      })],
      [scopedKey, serializeInteractiveHelpProgressState({
        ...completedProgress,
        completed: false,
      })],
    ],
    "profile-a",
  ).map(({ route, completedAt: recordedAt }) => ({ route, recordedAt })),
  [
    { route: "/agents", recordedAt: completedAt },
    { route: "/account", recordedAt: completedAt - 1_000 },
  ],
);
assert.deepEqual(
  listRecentlyCompletedInteractiveHelpTours(
    [[newestCompletedKey, '{"completed":true,"dismissed":false,"enabled":true,"step":4}']],
    "profile-a",
  ),
  [],
  "legacy progress without a completion timestamp must not invent recent history",
);

console.log("interactive help state tests passed");
