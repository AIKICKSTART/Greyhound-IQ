import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  PRODUCT_COMMUNITY_PRIVACY_HIDE_EVIDENCE_FILE,
  PRODUCT_COMMUNITY_PRIVACY_HIDE_EXPECTED_GAIN,
  PRODUCT_COMMUNITY_PRIVACY_HIDE_MASTER_EVIDENCE,
  PRODUCT_COMMUNITY_PRIVACY_HIDE_REQUIREMENT_IDS,
  PRODUCT_COMMUNITY_PRIVACY_HIDE_SCOPE,
  PRODUCT_COMMUNITY_PRIVACY_HIDE_TEST_FILE,
} from "./product-community-privacy-hide-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-COMMUNITY-PRIVACY-HIDE

const expectedRequirements = {
  "ROUTE.COMMUNITY.private-profile": "Represent a private profile safely.",
  "ROUTE.COMMUNITY.hide": "Support hiding.",
} as const;

assert.deepEqual(
  PRODUCT_COMMUNITY_PRIVACY_HIDE_REQUIREMENT_IDS,
  Object.keys(expectedRequirements),
);
assert.equal(PRODUCT_COMMUNITY_PRIVACY_HIDE_EXPECTED_GAIN, 2);
assert.deepEqual(
  Object.keys(PRODUCT_COMMUNITY_PRIVACY_HIDE_MASTER_EVIDENCE),
  Object.keys(expectedRequirements),
);

for (const [id, requirementText] of Object.entries(expectedRequirements)) {
  const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
    (candidate) => candidate.id === id,
  );
  assert.ok(requirement, id);
  assert.equal(requirement.requirement, requirementText);

  const evidence =
    PRODUCT_COMMUNITY_PRIVACY_HIDE_MASTER_EVIDENCE[
      id as keyof typeof PRODUCT_COMMUNITY_PRIVACY_HIDE_MASTER_EVIDENCE
    ];
  assert.equal(evidence.status, "tested", id);
  assert.deepEqual(evidence.evidence.slice(0, 2), [
    PRODUCT_COMMUNITY_PRIVACY_HIDE_EVIDENCE_FILE,
    PRODUCT_COMMUNITY_PRIVACY_HIDE_TEST_FILE,
  ]);
  assert.equal(new Set(evidence.evidence).size, evidence.evidence.length, id);
  evidence.evidence.forEach((path) => assert.equal(existsSync(path), true, path));
}

assert.match(PRODUCT_COMMUNITY_PRIVACY_HIDE_SCOPE, /source and unit/i);
assert.match(PRODUCT_COMMUNITY_PRIVACY_HIDE_SCOPE, /before protected relations are read/i);
assert.match(PRODUCT_COMMUNITY_PRIVACY_HIDE_SCOPE, /strictly validated API mutation/i);
assert.match(PRODUCT_COMMUNITY_PRIVACY_HIDE_SCOPE, /server-side/i);
assert.match(PRODUCT_COMMUNITY_PRIVACY_HIDE_SCOPE, /does not prove deployed database behavior/i);
assert.match(PRODUCT_COMMUNITY_PRIVACY_HIDE_SCOPE, /does not prove[\s\S]*browser interaction/i);

const profileService = source("src/lib/social-actor-service.ts");
const profileGuard = profileService.slice(
  profileService.indexOf("const profileAudience"),
  profileService.indexOf("const timelineRows"),
);
for (const signal of [
  "canViewAudience(profileAudience",
  "if (!canViewProfile)",
  "avatarUrl: null",
  "coverUrl: null",
  "profile: null",
  "contact: null",
  "timeline: []",
  "gallery: []",
  "friends: []",
  "canViewProfile: false",
]) {
  assert.ok(profileGuard.includes(signal), `private profile: ${signal}`);
}
assert.ok(profileGuard.length > 0, "private profile guard must precede timeline query");

const profileRoute = source("src/app/p/[handle]/page.tsx");
for (const signal of [
  "if (!profile.viewer.canViewProfile)",
  "<PrivateProfileView",
  'data-private-profile="true"',
  "Timeline posts, media, contact details, friends, and follower counts are hidden.",
  "robots: { index: false, follow: false }",
]) {
  assert.ok(profileRoute.includes(signal), `private profile route: ${signal}`);
}

const control = source("src/components/instant-feed-controls.tsx");
const muteControl = control.slice(
  control.indexOf("export function InstantFeedMuteButton"),
  control.indexOf("export function InstantFeedBlockButton"),
);
for (const signal of [
  "if (busy) return",
  "setBusy(true)",
  "fetch(`/api/actors/${mutedActorId}/mute`",
  'method: "POST"',
  "body: JSON.stringify({ muterActorId })",
  "setMuted(Boolean(payload.item?.muted))",
  "requestFeedReset()",
  "disabled={busy}",
  "aria-pressed={muted}",
  '{muted ? "Muted" : "Mute"}',
]) {
  assert.ok(muteControl.includes(signal), `mute control: ${signal}`);
}

const muteRoute = source("src/app/api/actors/[actorId]/mute/route.ts");
for (const signal of [
  "requireCurrentUserProfile()",
  "`actor:mute:${current.dbUserId}:${actorId}`",
  "rateLimitExceededResponse(",
  "muteSchema.parse(await readBoundedOptionalJsonRequest(request))",
  "toggleActorMuteForCurrentUser(",
  'jsonError(err, "Could not update muted actor")',
]) {
  assert.ok(muteRoute.includes(signal), `mute route: ${signal}`);
}

const feedService = source("src/lib/feed-service.ts");
const toggleService = feedService.slice(
  feedService.indexOf("export async function toggleActorMuteForCurrentUser"),
  feedService.indexOf("export async function toggleActorTopicFollowForCurrentUser"),
);
for (const signal of [
  "withDbRequestContext(current",
  "requireOwnedActor(current, muterActorId, tx)",
  'if (!target) throw new Error("actor.not_found")',
  'if (muter.id === target.id) throw new Error("actor.cannot_mute_self")',
  "tx.actorMute.findUnique",
  "tx.actorMute.delete",
  "tx.actorMute.create",
]) {
  assert.ok(toggleService.includes(signal), `mute service: ${signal}`);
}
assert.match(feedService, /mutedActorIds[\s\S]*authorActorId:\s*\{ notIn: mutedActorIds \}/);

const evidenceSource = source(PRODUCT_COMMUNITY_PRIVACY_HIDE_EVIDENCE_FILE);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Community privacy and hide evidence passed in isolation: explicit non-leaking private profile and authenticated, rate-limited, owned-actor mute path are ready for exact +2 central wiring.",
);

function source(path: string) {
  return readFileSync(path, "utf8");
}
