import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  PRODUCTION_SCREEN_STATE_CONTRACTS,
  SCREEN_STATE_EVIDENCE_TEST,
} from "./screen-state-evidence";

// screen-evidence-test-id: SCREEN-STATE-EVIDENCE

const EXPECTED_STATE_IDS = {
  "/": [
    "PRODUCTION.STATE.HOME.LOADING",
    "PRODUCTION.STATE.HOME.EMPTY",
    "PRODUCTION.STATE.HOME.POPULATED",
    "PRODUCTION.STATE.HOME.RECOVERABLE-ERROR",
  ],
  "/pricing": [
    "PRODUCTION.STATE.PRICING.POPULATED",
    "PRODUCTION.STATE.PRICING.DISABLED",
    "PRODUCTION.STATE.PRICING.CHECKOUT-SUCCESS",
    "PRODUCTION.STATE.PRICING.CHECKOUT-CANCELLED",
    "PRODUCTION.STATE.PRICING.BILLING-FIRST-USE",
  ],
  "/races": [
    "PRODUCTION.STATE.RACES.LOADING",
    "PRODUCTION.STATE.RACES.EMPTY",
    "PRODUCTION.STATE.RACES.POPULATED",
    "PRODUCTION.STATE.RACES.RECOVERABLE-ERROR",
  ],
  "/races/[id]": [
    "PRODUCTION.STATE.RACE-DETAIL.LOADING",
    "PRODUCTION.STATE.RACE-DETAIL.MISSING",
    "PRODUCTION.STATE.RACE-DETAIL.EMPTY-RUNNERS",
    "PRODUCTION.STATE.RACE-DETAIL.POPULATED",
    "PRODUCTION.STATE.RACE-DETAIL.RECOVERABLE-ERROR",
  ],
  "/meetings/[id]": [
    "PRODUCTION.STATE.MEETING-DETAIL.LOADING",
    "PRODUCTION.STATE.MEETING-DETAIL.MISSING",
    "PRODUCTION.STATE.MEETING-DETAIL.EMPTY-RACES",
    "PRODUCTION.STATE.MEETING-DETAIL.POPULATED",
  ],
  "/results": [
    "PRODUCTION.STATE.RESULTS.LOADING",
    "PRODUCTION.STATE.RESULTS.EMPTY",
    "PRODUCTION.STATE.RESULTS.POPULATED",
  ],
  "/tracks": [
    "PRODUCTION.STATE.TRACKS.LOADING",
    "PRODUCTION.STATE.TRACKS.EMPTY",
    "PRODUCTION.STATE.TRACKS.POPULATED",
  ],
  "/tracks/[id]": [
    "PRODUCTION.STATE.TRACK-DETAIL.LOADING",
    "PRODUCTION.STATE.TRACK-DETAIL.MISSING",
    "PRODUCTION.STATE.TRACK-DETAIL.EMPTY-RESULTS",
    "PRODUCTION.STATE.TRACK-DETAIL.POPULATED",
  ],
  "/discover": [
    "PRODUCTION.STATE.DISCOVER.LOADING",
    "PRODUCTION.STATE.DISCOVER.FIRST-USE",
    "PRODUCTION.STATE.DISCOVER.NO-MATCHES",
    "PRODUCTION.STATE.DISCOVER.POPULATED",
  ],
  "/forum": [
    "PRODUCTION.STATE.FORUM.LOADING",
    "PRODUCTION.STATE.FORUM.EMPTY-GROUPS",
    "PRODUCTION.STATE.FORUM.EMPTY-THREADS",
    "PRODUCTION.STATE.FORUM.POPULATED",
  ],
  "/messages": [
    "PRODUCTION.STATE.MESSAGES.LOADING",
    "PRODUCTION.STATE.MESSAGES.SIGNED-OUT",
    "PRODUCTION.STATE.MESSAGES.EMPTY",
    "PRODUCTION.STATE.MESSAGES.POPULATED",
    "PRODUCTION.STATE.MESSAGES.RECOVERABLE-ERROR",
  ],
  "/about": ["PRODUCTION.STATE.ABOUT.POPULATED"],
  "/auth/error": [
    "PRODUCTION.STATE.AUTH-ERROR.RECOVERY",
    "PRODUCTION.STATE.AUTH-ERROR.REFERENCE",
  ],
  "/contact": [
    "PRODUCTION.STATE.CONTACT.SIGNED-OUT",
    "PRODUCTION.STATE.CONTACT.SIGNED-IN",
    "PRODUCTION.STATE.CONTACT.TICKET-CREATED",
  ],
  "/privacy": ["PRODUCTION.STATE.PRIVACY.POPULATED"],
  "/responsible-use": ["PRODUCTION.STATE.RESPONSIBLE-USE.POPULATED"],
  "/terms": ["PRODUCTION.STATE.TERMS.POPULATED"],
  "/breeding": [
    "PRODUCTION.STATE.BREEDING.LOADING",
    "PRODUCTION.STATE.BREEDING.POPULATED",
  ],
  "/dogs": ["PRODUCTION.STATE.DOGS.DIRECTORY"],
  "/dogs/[id]": [
    "PRODUCTION.STATE.DOG-DETAIL.LOADING",
    "PRODUCTION.STATE.DOG-DETAIL.MISSING",
    "PRODUCTION.STATE.DOG-DETAIL.EMPTY-OWNERSHIP",
    "PRODUCTION.STATE.DOG-DETAIL.POPULATED",
  ],
  "/statistics": [
    "PRODUCTION.STATE.STATISTICS.LOADING",
    "PRODUCTION.STATE.STATISTICS.POPULATED",
  ],
  "/feed": [
    "PRODUCTION.STATE.FEED.LOADING",
    "PRODUCTION.STATE.FEED.SIGNED-OUT",
    "PRODUCTION.STATE.FEED.SIGNED-IN",
  ],
  "/forum/[slug]": [
    "PRODUCTION.STATE.FORUM-CATEGORY.MISSING",
    "PRODUCTION.STATE.FORUM-CATEGORY.EMPTY",
    "PRODUCTION.STATE.FORUM-CATEGORY.POPULATED",
    "PRODUCTION.STATE.FORUM-CATEGORY.SIGNED-OUT",
  ],
  "/forum/threads/[id]": [
    "PRODUCTION.STATE.FORUM-THREAD.MISSING",
    "PRODUCTION.STATE.FORUM-THREAD.POPULATED",
    "PRODUCTION.STATE.FORUM-THREAD.LOCKED",
    "PRODUCTION.STATE.FORUM-THREAD.SIGNED-OUT",
  ],
  "/groups": [
    "PRODUCTION.STATE.GROUPS.EMPTY-GROUPS",
    "PRODUCTION.STATE.GROUPS.EMPTY-THREADS",
    "PRODUCTION.STATE.GROUPS.POPULATED",
  ],
  "/groups/[slug]": [
    "PRODUCTION.STATE.GROUP-DETAIL.MISSING",
    "PRODUCTION.STATE.GROUP-DETAIL.EMPTY",
    "PRODUCTION.STATE.GROUP-DETAIL.POPULATED",
    "PRODUCTION.STATE.GROUP-DETAIL.SIGNED-OUT",
  ],
  "/groups/threads/[id]": [
    "PRODUCTION.STATE.GROUP-THREAD.MISSING",
    "PRODUCTION.STATE.GROUP-THREAD.POPULATED",
    "PRODUCTION.STATE.GROUP-THREAD.LOCKED",
    "PRODUCTION.STATE.GROUP-THREAD.SIGNED-OUT",
  ],
  "/p/[handle]": [
    "PRODUCTION.STATE.PUBLIC-PROFILE.MISSING",
    "PRODUCTION.STATE.PUBLIC-PROFILE.PERSONAL",
    "PRODUCTION.STATE.PUBLIC-PROFILE.MANAGED-PAGE",
    "PRODUCTION.STATE.PUBLIC-PROFILE.EMPTY-TIMELINE",
  ],
  "/listings": [
    "PRODUCTION.STATE.LISTINGS.LOADING",
    "PRODUCTION.STATE.LISTINGS.SIGNED-OUT",
    "PRODUCTION.STATE.LISTINGS.EMPTY",
    "PRODUCTION.STATE.LISTINGS.POPULATED",
  ],
  "/listings/[id]": [
    "PRODUCTION.STATE.LISTING-DETAIL.MISSING",
    "PRODUCTION.STATE.LISTING-DETAIL.EMPTY-MEDIA",
    "PRODUCTION.STATE.LISTING-DETAIL.POPULATED",
  ],
  "/listings/new": [
    "PRODUCTION.STATE.LISTING-CREATE.SIGNED-OUT",
    "PRODUCTION.STATE.LISTING-CREATE.TIER-BLOCKED",
    "PRODUCTION.STATE.LISTING-CREATE.EDITOR",
  ],
  "/marketplace": [
    "PRODUCTION.STATE.MARKETPLACE.LOADING",
    "PRODUCTION.STATE.MARKETPLACE.SIGNED-OUT",
    "PRODUCTION.STATE.MARKETPLACE.EMPTY",
    "PRODUCTION.STATE.MARKETPLACE.POPULATED",
  ],
  "/marketplace/[id]": [
    "PRODUCTION.STATE.MARKETPLACE-DETAIL.MISSING",
    "PRODUCTION.STATE.MARKETPLACE-DETAIL.EMPTY-MEDIA",
    "PRODUCTION.STATE.MARKETPLACE-DETAIL.POPULATED",
  ],
  "/marketplace/new": [
    "PRODUCTION.STATE.MARKETPLACE-CREATE.SIGNED-OUT",
    "PRODUCTION.STATE.MARKETPLACE-CREATE.TIER-BLOCKED",
    "PRODUCTION.STATE.MARKETPLACE-CREATE.EDITOR",
  ],
} as const;

assert.equal(
  SCREEN_STATE_EVIDENCE_TEST.path,
  "src/components/screen-contracts/screen-state-evidence.test.ts",
);
assert.deepEqual(
  PRODUCTION_SCREEN_STATE_CONTRACTS.map(({ route }) => route),
  Object.keys(EXPECTED_STATE_IDS),
  "The state foundation must remain the exact 34-route source-backed batch.",
);

const allStateIds = new Set<string>();
for (const contract of PRODUCTION_SCREEN_STATE_CONTRACTS) {
  const expectedSourcePath =
    contract.route === "/"
      ? "src/app/page.tsx"
      : `src/app${contract.route}/page.tsx`;
  assert.equal(contract.sourcePath, expectedSourcePath);
  assert.equal(existsSync(contract.sourcePath), true, `${contract.sourcePath} is missing.`);
  assert.match(readFileSync(contract.sourcePath, "utf8"), /export default/);
  assert.deepEqual(
    contract.states.map(({ id }) => id),
    EXPECTED_STATE_IDS[contract.route as keyof typeof EXPECTED_STATE_IDS],
  );

  for (const state of contract.states) {
    assert.match(state.id, /^PRODUCTION\.STATE\.[A-Z0-9-]+\.[A-Z0-9-]+$/);
    assert.equal(allStateIds.has(state.id), false, `${state.id} is duplicated.`);
    allStateIds.add(state.id);
    assert.deepEqual(state.testIds, [SCREEN_STATE_EVIDENCE_TEST.id]);
    assert.equal(
      "fixtureId" in state,
      false,
      `${state.id} must remain source-only until a real fixture is captured.`,
    );
    assert.ok(state.sourceAssertions.length > 0, `${state.id} needs source proof.`);

    for (const sourceAssertion of state.sourceAssertions) {
      assert.equal(
        existsSync(sourceAssertion.sourcePath),
        true,
        `${state.id}: ${sourceAssertion.sourcePath} is missing.`,
      );
      assert.match(sourceAssertion.sourcePath, /^src\/app\//);
      assert.ok(sourceAssertion.orderedText.length > 0);
      assertOrdered(
        readFileSync(sourceAssertion.sourcePath, "utf8"),
        sourceAssertion.orderedText,
        `${state.id}: ${sourceAssertion.sourcePath}`,
      );
    }

    if (state.id.endsWith(".LOADING")) {
      const proof = state.sourceAssertions.flatMap(({ orderedText }) => orderedText);
      assert.equal(
        proof.some((text) => text.includes("SkeletonGroup")),
        true,
        `${state.id} must prove a meaningful skeleton label.`,
      );
    }

    if (state.id.endsWith(".RECOVERABLE-ERROR")) {
      assert.ok(state.recoveryActionId, `${state.id} needs a real recovery action.`);
      const errorProof = state.sourceAssertions.find(({ sourcePath }) =>
        sourcePath.endsWith("/error.tsx"),
      );
      assert.ok(errorProof, `${state.id} must use a route error boundary.`);
      const source = readFileSync(errorProof.sourcePath, "utf8");
      assert.match(source, /^"use client";/);
      assert.match(source, /reset: \(\) => void;/);
      assert.match(source, /onClick=\{reset\}/);
      assert.match(source, /Try again/);
    }

    if (state.id.endsWith(".MISSING")) {
      assert.equal(
        state.sourceAssertions.some(({ orderedText }) =>
          orderedText.some((text) => text.includes("notFound()")),
        ),
        true,
        `${state.id} must prove the missing-record branch.`,
      );
      assert.equal(
        state.sourceAssertions.some(({ sourcePath }) =>
          sourcePath.endsWith("/not-found.tsx"),
        ),
        true,
        `${state.id} must prove the rendered not-found boundary.`,
      );
    }

    if (state.id.endsWith(".DISABLED")) {
      const proof = state.sourceAssertions.flatMap(({ orderedText }) => orderedText);
      assert.equal(proof.includes("<button"), true);
      assert.equal(proof.includes("disabled"), true);
    }
  }
}

assert.equal(PRODUCTION_SCREEN_STATE_CONTRACTS.length, 34);
assert.equal(allStateIds.size, 109);
assert.equal(
  [...allStateIds].filter((id) => id.endsWith(".LOADING")).length,
  16,
);
assert.equal(
  [...allStateIds].filter((id) => id.endsWith(".RECOVERABLE-ERROR")).length,
  4,
);
assert.equal(
  [...allStateIds].filter((id) => id.endsWith(".MISSING")).length,
  11,
);
assert.equal(
  [...allStateIds].filter((id) => id.endsWith(".DISABLED")).length,
  1,
);

console.log(
  "screen state source evidence passed (34 routes, 109 explicit states); no browser or runtime-fixture claim",
);

function assertOrdered(
  source: string,
  orderedText: readonly string[],
  label: string,
) {
  let cursor = 0;
  for (const text of orderedText) {
    const index = source.indexOf(text, cursor);
    assert.notEqual(index, -1, `${label} is missing ordered source text: ${text}`);
    cursor = index + text.length;
  }
}
