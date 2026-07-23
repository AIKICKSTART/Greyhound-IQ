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
  PRODUCTION_SCREEN_PUBLIC_NAVIGATION_INTERACTION_CONTRACTS,
  PRODUCTION_SCREEN_PUBLIC_NAVIGATION_INTERACTION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_PUBLIC_NAVIGATION_INTERACTION_ROUTES,
} from "./production-screen-public-navigation-interactions";
import {
  findFormSubmissionSignals,
  findUserActionSignals,
  getLocalSourceClosure,
} from "./screen-contract-source-audit";

// screen-evidence-test-id: PRODUCTION-SCREEN-PUBLIC-NAVIGATION-INTERACTIONS

const TEST_ID =
  PRODUCTION_SCREEN_PUBLIC_NAVIGATION_INTERACTION_EVIDENCE_TEST.id;
const TEST_PATH =
  PRODUCTION_SCREEN_PUBLIC_NAVIGATION_INTERACTION_EVIDENCE_TEST.path;
const actionExclusions = new Set<string>(
  PRODUCTION_SCREEN_ACTION_EXCLUSION_ROUTES,
);
const formExclusions = new Set<string>(PRODUCTION_SCREEN_FORM_EXCLUSION_ROUTES);
const onboardingExclusions = new Set(
  Object.keys(PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS),
);

const EXPECTED_PUBLIC_NAVIGATION_INTERACTIONS = {
  "/": {
    queryParameters: [],
    actionIds: [
      "HOME.ACTION.RACES.JUMP",
      "HOME.ACTION.PRICING.OPEN",
      "HOME.ACTION.FEATURE.OPEN",
      "HOME.ACTION.RACE-EXPLORER.OPEN",
      "HOME.ACTION.TRACK.OPEN",
      "HOME.ACTION.RACE.OPEN",
    ],
    sourceAssertions: [
      "<HomeHero />",
      "const FEATURES = [",
      'href: "/dogs"',
      'href: "/agents"',
      'href: "/breeding"',
      'href: "/statistics"',
      "const meetings = await getTodaysMeetings();",
      'href="/races"',
      "<MeetingCard key={m.id} meeting={m} />",
    ],
  },
  "/about": {
    queryParameters: [],
    actionIds: ["ABOUT.ACTION.CONTACT.OPEN"],
    sourceAssertions: ['href="/contact"'],
  },
  "/auth/error": {
    queryParameters: ["reason", "ref"],
    actionIds: [
      "AUTH-ERROR.ACTION.SIGN-IN.RETRY",
      "AUTH-ERROR.ACTION.CONTACT.OPEN",
      "AUTH-ERROR.ACTION.HOME.OPEN",
    ],
    sourceAssertions: [
      "reason?: string | string[];",
      "ref?: string | string[];",
      "parseAuthCallbackFailureReason(params.reason)",
      "parseAuthCallbackReference(params.ref)",
      "AUTH_CALLBACK_RECOVERY_COPY[reason]",
      'href="/sign-in?returnTo=%2Ffeed"',
      'href="/contact"',
      'href="/"',
    ],
  },
  "/privacy": {
    queryParameters: [],
    actionIds: [
      "PRIVACY.ACTION.COOKIE.DECLINE",
      "PRIVACY.ACTION.COOKIE.ACCEPT",
      "PRIVACY.ACTION.GAMBLING-HELP.OPEN",
      "PRIVACY.ACTION.CONTACT.OPEN",
    ],
    sourceAssertions: [
      "<CookiePreferencePanel />",
      'href="https://www.gamblinghelponline.org.au"',
      'target="_blank"',
      'rel="noopener noreferrer"',
      'href="/contact"',
    ],
  },
  "/responsible-use": {
    queryParameters: [],
    actionIds: [
      "RESPONSIBLE-USE.ACTION.HELP.CALL",
      "RESPONSIBLE-USE.ACTION.HELP.ONLINE",
      "RESPONSIBLE-USE.ACTION.CONTACT.OPEN",
      "RESPONSIBLE-USE.ACTION.TERMS.OPEN",
      "RESPONSIBLE-USE.ACTION.PRIVACY.OPEN",
    ],
    sourceAssertions: [
      'href="tel:1800858858"',
      'href="https://www.gamblinghelponline.org.au"',
      'target="_blank"',
      'rel="noopener noreferrer"',
      'href="/contact"',
      'href="/terms"',
      'href="/privacy"',
    ],
  },
  "/terms": {
    queryParameters: [],
    actionIds: ["TERMS.ACTION.CONTACT.OPEN"],
    sourceAssertions: ['href="/contact"'],
  },
} as const;

assert.deepEqual(
  PRODUCTION_SCREEN_PUBLIC_NAVIGATION_INTERACTION_ROUTES,
  Object.keys(EXPECTED_PUBLIC_NAVIGATION_INTERACTIONS),
  "the public-navigation batch must fail closed on route additions or removals",
);
assert.deepEqual(
  Object.keys(PRODUCTION_SCREEN_PUBLIC_NAVIGATION_INTERACTION_CONTRACTS),
  PRODUCTION_SCREEN_PUBLIC_NAVIGATION_INTERACTION_ROUTES,
  "the owned module may contain only the reviewed public-navigation routes",
);
assert.equal(PRODUCTION_SCREEN_PUBLIC_NAVIGATION_INTERACTION_ROUTES.length, 6);

let actionInventoryCount = 0;

for (const route of PRODUCTION_SCREEN_PUBLIC_NAVIGATION_INTERACTION_ROUTES) {
  const expected = EXPECTED_PUBLIC_NAVIGATION_INTERACTIONS[route];
  const ownedInteraction =
    PRODUCTION_SCREEN_PUBLIC_NAVIGATION_INTERACTION_CONTRACTS[route];
  const interaction = Object.entries(
    PRODUCTION_SCREEN_INTERACTION_CONTRACTS,
  ).find(([candidateRoute]) => candidateRoute === route)?.[1];
  const screen = SCREEN_CONTRACT_BY_ROUTE.get(route);
  assert.ok(screen, `${route}: missing production screen contract`);
  assert.equal(screen.productionEnabled, true);
  assert.equal(screen.authentication, "public");
  assert.equal(onboardingExclusions.has(route), false);
  assert.equal(screen.coverage.onboarding.status, "tested");
  assert.equal(actionExclusions.has(route), false);
  assert.equal(formExclusions.has(route), true);
  assert.ok(interaction, `${route}: missing central interaction contract`);
  assert.equal(interaction, ownedInteraction);

  assert.deepEqual(interaction.queryParameters, expected.queryParameters);
  assert.deepEqual(
    interaction.actions.map((candidate) => candidate.id),
    expected.actionIds,
  );
  assert.deepEqual(interaction.forms, []);
  assert.deepEqual(screen.queryParameters, [...expected.queryParameters]);
  assert.deepEqual(screen.primaryActions, [...expected.actionIds]);
  assert.deepEqual(screen.forms, []);

  const closure = getLocalSourceClosure(screen.sourceFiles[0]);
  const formSignals = [...closure].flatMap(findFormSubmissionSignals);
  const actionSignals = [...closure].flatMap(findUserActionSignals);
  assert.deepEqual(
    formSignals,
    [],
    `${route}: excluded form closure must stay empty`,
  );
  assert.ok(
    actionSignals.length > 0,
    `${route}: verified actions require a source-owned interaction signal`,
  );

  assert.equal(screen.coverage.actions.status, "verified");
  assert.equal(screen.coverage.forms.status, "excluded");
  assert.ok(screen.coverage.actions.evidence.includes(TEST_PATH));
  assert.ok(screen.coverage.forms.evidence.includes(TEST_PATH));
  for (const candidate of interaction.actions) {
    assert.ok(candidate.result.length > 0);
    assert.ok(candidate.enforcement && candidate.enforcement.length > 0);
    assert.deepEqual(candidate.testIds, [TEST_ID]);
  }

  const source = readFileSync(screen.sourceFiles[0], "utf8");
  for (const assertion of expected.sourceAssertions) {
    assert.ok(
      source.includes(assertion),
      `${route}: source assertion is absent: ${assertion}`,
    );
  }

  actionInventoryCount += interaction.actions.length;
}

assert.equal(actionInventoryCount, 20);

const homeHeroSource = readFileSync("src/components/home-hero.tsx", "utf8");
for (const assertion of [
  'primaryHref = "/sign-in?plan=free"',
  "href={primaryHref}",
  'href="#pricing"',
  "Start Free",
]) {
  assert.ok(
    homeHeroSource.includes(assertion),
    `home hero must preserve ${assertion}`,
  );
}

const meetingCardSource = readFileSync(
  "src/components/meeting-card.tsx",
  "utf8",
);
for (const assertion of [
  "href={`/tracks/${track.id}`}",
  "href={`/races/${race.id}`}",
  "href={`/races/${featuredRace.id}`}",
]) {
  assert.ok(
    meetingCardSource.includes(assertion),
    `home meeting card must preserve ${assertion}`,
  );
}

const cookieSource = readFileSync("src/components/cookie-consent.tsx", "utf8");
for (const assertion of [
  'const STORAGE_KEY = "greyhoundiq.cookie-consent.v1";',
  'const CONSENT_EVENT = "greyhoundiq:cookie-consent";',
  'setConsent("declined")',
  'setConsent("accepted")',
  "window.localStorage.setItem(STORAGE_KEY, value);",
  "window.dispatchEvent(new Event(CONSENT_EVENT));",
]) {
  assert.ok(
    cookieSource.includes(assertion),
    `cookie preference controls must preserve ${assertion}`,
  );
}

const authRecoverySource = readFileSync(
  "src/lib/auth-callback-recovery.ts",
  "utf8",
);
for (const assertion of [
  "candidate in AUTH_CALLBACK_RECOVERY_COPY",
  ': "failed";',
  "/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(",
]) {
  assert.ok(
    authRecoverySource.includes(assertion),
    `auth recovery parsing must preserve ${assertion}`,
  );
}

console.log(
  "Public-navigation interaction coverage passed: 6 action routes, 6 exact zero-form exclusions, 20 action entries, public onboarding retained",
);
