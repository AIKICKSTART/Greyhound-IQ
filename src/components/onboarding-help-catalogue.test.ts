import assert from "node:assert/strict";

import {
  ONBOARDING_HELP_TOUR_CATALOGUE,
  SUPPORT_HELP_TOPICS,
  filterOnboardingHelpTours,
  filterSupportHelpTopics,
  getAvailableOnboardingHelpTours,
  normalizeHelpSearchQuery,
} from "./onboarding-help-catalogue";

assert.equal(ONBOARDING_HELP_TOUR_CATALOGUE.length, 87);
assert.equal(
  new Set(ONBOARDING_HELP_TOUR_CATALOGUE.map(({ route }) => route)).size,
  87,
);
assert.equal(SUPPORT_HELP_TOPICS.length, 10);
assert.equal(
  new Set(SUPPORT_HELP_TOPICS.map(({ title }) => title)).size,
  SUPPORT_HELP_TOPICS.length,
);

const administratorTours = getAvailableOnboardingHelpTours({
  authenticated: true,
  role: "admin",
});
const memberTours = getAvailableOnboardingHelpTours({
  authenticated: true,
  role: "member",
});
const visitorTours = getAvailableOnboardingHelpTours({
  authenticated: false,
  role: "visitor",
});
assert.equal(administratorTours.length, 87);
assert.ok(memberTours.length > visitorTours.length);
assert.equal(memberTours.some(({ route }) => route.startsWith("/admin")), false);
assert.equal(visitorTours.some(({ route }) => route.startsWith("/account")), false);
assert.equal(
  administratorTours.find(({ route }) => route === "/dogs/[id]")?.href,
  null,
);

assert.deepEqual(
  filterSupportHelpTopics("privacy").map(({ title }) => title),
  ["Manage privacy and data requests"],
);
assert.equal(filterSupportHelpTopics("no-such-topic").length, 0);
assert.equal(filterOnboardingHelpTours(memberTours, "billing").length, 1);
assert.equal(filterOnboardingHelpTours(memberTours, "no-such-tour").length, 0);
assert.equal(normalizeHelpSearchQuery(["  race   card  ", "ignored"]), "race card");
assert.equal(normalizeHelpSearchQuery("x".repeat(100)).length, 80);

console.log(
  `Onboarding help catalogue passed: ${administratorTours.length} role-filtered tours and ${SUPPORT_HELP_TOPICS.length} searchable help topics.`,
);
