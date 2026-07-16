import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SCREEN_CONTRACT_BY_ROUTE } from "../demo-experience-registry";
import {
  PRODUCTION_SCREEN_ACTION_EXCLUSION_ROUTES,
  PRODUCTION_SCREEN_FORM_EXCLUSION_ROUTES,
  PRODUCTION_SCREEN_INTERACTION_CONTRACTS,
  PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS,
} from "./production-screen-coverage";
import {
  PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_CONTRACTS,
  PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_ROUTES,
} from "./production-screen-public-racing-interactions";
import {
  findFormSubmissionSignals,
  findUserActionSignals,
  getLocalSourceClosure,
} from "./screen-contract-source-audit";

// screen-evidence-test-id: PRODUCTION-SCREEN-PUBLIC-RACING-INTERACTIONS

const TEST_ID = PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_EVIDENCE_TEST.id;
const TEST_PATH =
  PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_EVIDENCE_TEST.path;
const actionExclusions = new Set<string>(
  PRODUCTION_SCREEN_ACTION_EXCLUSION_ROUTES,
);
const formExclusions = new Set<string>(PRODUCTION_SCREEN_FORM_EXCLUSION_ROUTES);
const onboardingExclusions = new Set(
  Object.keys(PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS),
);

const EXPECTED_PUBLIC_RACING_INTERACTIONS = {
  "/dogs": {
    queryParameters: ["q"],
    actionIds: ["DOGS.ACTION.SEARCH", "DOGS.ACTION.DOG.OPEN"],
    forms: [],
    sourceAssertions: [
      'const initialQuery = Array.isArray(q) ? q[0] : (q ?? "");',
      "<DogSearch initialQuery={initialQuery} />",
    ],
  },
  "/dogs/[id]": {
    queryParameters: [],
    actionIds: [
      "DOG-DETAIL.ACTION.OWNERSHIP.CLAIM",
      "DOG-DETAIL.ACTION.ACCOUNT.OPEN",
      "DOG-DETAIL.ACTION.SIGN-IN.OPEN",
      "DOG-DETAIL.ACTION.PEDIGREE.DOG.OPEN",
      "DOG-DETAIL.ACTION.FORM.EXPAND",
      "DOG-DETAIL.ACTION.REPLAY.OPEN",
    ],
    forms: [
      ["DOG-DETAIL.FORM.OWNERSHIP-CLAIM", "SERVER ACTION claimDogOwnership"],
    ],
    sourceAssertions: [
      "const claimAction = claimDogOwnership.bind(null, dog.id);",
      "<form action={claimAction}",
      'name="role"',
      'name="evidence"',
      "<summary",
      "<PedigreeChart root={pedigree} />",
      "<ReplayLink href={entry.replayHref}",
    ],
  },
  "/races/[id]": {
    queryParameters: [],
    actionIds: [
      "RACE-DETAIL.ACTION.REPLAY.PLAY",
      "RACE-DETAIL.ACTION.DOG.OPEN",
      "RACE-DETAIL.ACTION.PREVIOUS.OPEN",
      "RACE-DETAIL.ACTION.MEETING.OPEN",
      "RACE-DETAIL.ACTION.NEXT.OPEN",
    ],
    forms: [],
    sourceAssertions: [
      "<RaceReplayPlayer",
      "<ReplayEmbed",
      "<RunnerRow",
      "href={`/dogs/${winner.dog.id}`}",
      "<RaceMeetingNavigation",
      "previous={previousRaceTarget}",
      "next={nextRaceTarget}",
      "meetingHref={buildRaceListReturnHref(listContext)}",
      "parseRaceListContext(detailSearchParams)",
      'return parsed.protocol === "http:" || parsed.protocol === "https:"',
    ],
  },
  "/meetings/[id]": {
    queryParameters: [],
    actionIds: [
      "MEETING-DETAIL.ACTION.RACE-DAY.OPEN",
      "MEETING-DETAIL.ACTION.TRACK.OPEN",
      "MEETING-DETAIL.ACTION.RACE.OPEN",
      "MEETING-DETAIL.ACTION.WINNER.OPEN",
    ],
    forms: [],
    sourceAssertions: [
      "href={`/races?date=${dateInput}`}",
      "href={`/tracks/${meeting.track.id}`}",
      "<MeetingDetailRaceCard",
      "getMeetingById(id)",
    ],
  },
  "/tracks/[id]": {
    queryParameters: [],
    actionIds: [
      "TRACK-DETAIL.ACTION.TRACKS.OPEN",
      "TRACK-DETAIL.ACTION.RACE.OPEN",
    ],
    forms: [],
    sourceAssertions: [
      '<Link href="/tracks"',
      "href={`/races/${race.id}`}",
      "getTrackById(id)",
    ],
  },
  "/breeding": {
    queryParameters: [],
    actionIds: ["BREEDING.ACTION.DOGS.OPEN", "BREEDING.ACTION.RACES.OPEN"],
    forms: [],
    sourceAssertions: ['href="/dogs"', 'href="/races"'],
  },
} as const;

assert.deepEqual(
  PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_ROUTES,
  Object.keys(EXPECTED_PUBLIC_RACING_INTERACTIONS),
  "the public/racing batch must fail closed on route additions or removals",
);
assert.deepEqual(
  Object.keys(PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_CONTRACTS),
  PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_ROUTES,
  "the owned module may contain only the reviewed public/racing routes",
);
assert.deepEqual(
  Object.keys(PRODUCTION_SCREEN_INTERACTION_CONTRACTS).filter(
    (route) =>
      route === "/dogs" ||
      route.startsWith("/dogs/") ||
      route === "/breeding" ||
      route === "/races/[id]" ||
      route === "/meetings/[id]" ||
      route === "/tracks/[id]",
  ),
  PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_ROUTES,
  "no unreviewed public/racing detail route may inherit interaction completion",
);
assert.equal(PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_ROUTES.length, 6);

let structuredFormCount = 0;
let actionInventoryCount = 0;

for (const route of PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_ROUTES) {
  const expected = EXPECTED_PUBLIC_RACING_INTERACTIONS[route];
  const ownedInteraction =
    PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_CONTRACTS[route];
  const interaction = PRODUCTION_SCREEN_INTERACTION_CONTRACTS[route];
  const screen = SCREEN_CONTRACT_BY_ROUTE.get(route);
  assert.ok(screen, `${route}: missing production screen contract`);
  assert.equal(
    screen.productionEnabled,
    true,
    `${route}: must be production-enabled`,
  );
  assert.equal(onboardingExclusions.has(route), false);
  assert.equal(
    screen.coverage.onboarding.status,
    "tested",
    `${route}: shared racing onboarding must remain tested`,
  );
  assert.equal(actionExclusions.has(route), false);
  assert.equal(formExclusions.has(route), expected.forms.length === 0);
  assert.equal(interaction, ownedInteraction);

  assert.deepEqual(interaction.queryParameters, expected.queryParameters);
  assert.deepEqual(
    interaction.actions.map((candidate) => candidate.id),
    expected.actionIds,
  );
  assert.deepEqual(
    interaction.forms.map((candidate) => [candidate.id, candidate.submitsTo]),
    expected.forms,
  );
  assert.deepEqual(screen.queryParameters, [...expected.queryParameters]);
  assert.deepEqual(screen.primaryActions, [...expected.actionIds]);
  assert.deepEqual(
    screen.forms,
    expected.forms.map(([id, submitsTo]) => `${id} -> ${submitsTo}`),
  );

  const closure = getLocalSourceClosure(screen.sourceFiles[0]);
  const formSignals = [...closure].flatMap(findFormSubmissionSignals);
  const actionSignals = [...closure].flatMap(findUserActionSignals);
  const sourceForms = formSignals.filter((signal) =>
    signal.endsWith(":<form>"),
  );
  assert.equal(
    sourceForms.length,
    expected.forms.length,
    `${route}: every source-owned form must have exactly one manifest entry\n${sourceForms.join("\n")}`,
  );
  assert.ok(
    actionSignals.length > 0,
    `${route}: verified actions require a source-owned interaction signal`,
  );
  if (expected.forms.length === 0) {
    assert.deepEqual(
      formSignals,
      [],
      `${route}: form exclusion must stay exact`,
    );
  }

  assert.equal(screen.coverage.actions.status, "verified");
  assert.equal(
    screen.coverage.forms.status,
    expected.forms.length === 0 ? "excluded" : "verified",
  );
  assert.ok(screen.coverage.actions.evidence.includes(TEST_PATH));
  assert.ok(screen.coverage.forms.evidence.includes(TEST_PATH));
  for (const candidate of interaction.actions) {
    assert.ok(candidate.result.length > 0);
    assert.ok(candidate.enforcement && candidate.enforcement.length > 0);
    assert.deepEqual(candidate.testIds, [TEST_ID]);
  }
  for (const candidate of interaction.forms) {
    assert.match(candidate.submitsTo, /^SERVER ACTION /);
    assert.ok(candidate.schema && candidate.schema.length > 0);
    assert.deepEqual(candidate.testIds, [TEST_ID]);
  }

  const source = readFileSync(screen.sourceFiles[0], "utf8");
  for (const assertion of expected.sourceAssertions) {
    assert.ok(
      source.includes(assertion),
      `${route}: source assertion is absent: ${assertion}`,
    );
  }

  structuredFormCount += interaction.forms.length;
  actionInventoryCount += interaction.actions.length;
}

assert.equal(structuredFormCount, 1);
assert.equal(actionInventoryCount, 21);

const raceNavigationSource = readFileSync(
  "src/components/race-meeting-navigation.tsx",
  "utf8",
);
for (const assertion of [
  'aria-label="Meeting race navigation"',
  "href={previous.href}",
  "href={next.href}",
  'aria-disabled="true"',
  "First race in meeting",
  "Last race in meeting",
]) {
  assert.ok(
    raceNavigationSource.includes(assertion),
    `race navigation must preserve ${assertion}`,
  );
}

const dogSearchSource = readFileSync("src/components/dog-search.tsx", "utf8");
for (const assertion of [
  "`/api/dogs/search?q=${encodeURIComponent(query)}`",
  "router.push(`/dogs/${results[activeIndex].id}`)",
  "href={`/dogs/${dog.id}`}",
]) {
  assert.ok(
    dogSearchSource.includes(assertion),
    `dog search must preserve ${assertion}`,
  );
}

const dogSearchRouteSource = readFileSync(
  "src/app/api/dogs/search/route.ts",
  "utf8",
);
for (const assertion of [
  "isEmergencyControlActive(process.env.SEARCH_DISABLED)",
  "const rateLimit = await checkRateLimit(",
  'clientIp || "missing-forwarded-for"',
  "const results = await searchDogs(q, 20);",
]) {
  assert.ok(
    dogSearchRouteSource.includes(assertion),
    `dog search endpoint must preserve ${assertion}`,
  );
}

const queriesSource = readFileSync("src/lib/queries.ts", "utf8");
for (const assertion of [
  'query?.trim().replace(/\\s+/g, " ").slice(0, 80)',
  "if (!trimmed) return [];",
]) {
  assert.ok(
    queriesSource.includes(assertion),
    `dog query must preserve ${assertion}`,
  );
}

const actionsSource = readFileSync("src/app/actions.ts", "utf8");
for (const assertion of [
  "export async function claimDogOwnership(dogId: string, formData: FormData)",
  "const current = await requireCurrentUserProfile();",
  "const parsed = dogOwnershipClaimSchema.parse({",
  'if (!rateLimit.allowed) throw new Error("rate_limit.exceeded");',
  'if (!dog) throw new Error("dog.not_found");',
  'if (existing) throw new Error("dog.ownership.already_claimed");',
  'status: "pending"',
  'action: "dog.ownership.claim"',
]) {
  assert.ok(
    actionsSource.includes(assertion),
    `dog claim must preserve ${assertion}`,
  );
}

const validationSource = readFileSync("src/lib/account-validation.ts", "utf8");
for (const assertion of [
  'z.enum([\n  "owner",\n  "breeder",\n  "trainer",\n  "co-owner",\n])',
  "evidence: optionalText(1000)",
]) {
  assert.ok(
    validationSource.includes(assertion),
    `dog claim validation must preserve ${assertion}`,
  );
}

const statistics = SCREEN_CONTRACT_BY_ROUTE.get("/statistics");
assert.ok(statistics);
assert.equal("/statistics" in PRODUCTION_SCREEN_INTERACTION_CONTRACTS, false);
assert.equal(actionExclusions.has("/statistics"), true);
assert.equal(formExclusions.has("/statistics"), true);
assert.equal(statistics.coverage.actions.status, "excluded");
assert.equal(statistics.coverage.forms.status, "excluded");
assert.equal(statistics.coverage.onboarding.status, "tested");

console.log(
  "Public/racing interaction coverage passed: 6 action routes, 1 verified form route, 5 exact zero-form exclusions, 21 action entries, 1 structured form, racing onboarding retained",
);
