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
  PRODUCTION_SCREEN_ADMIN_MODERATION_INTERACTION_CONTRACTS,
  PRODUCTION_SCREEN_ADMIN_MODERATION_INTERACTION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_ADMIN_MODERATION_INTERACTION_ROUTES,
} from "./production-screen-admin-moderation-interactions";
import {
  findFormSubmissionSignals,
  findUserActionSignals,
  getLocalSourceClosure,
} from "./screen-contract-source-audit";

// screen-evidence-test-id: PRODUCTION-SCREEN-ADMIN-MODERATION-INTERACTIONS

const TEST_ID =
  PRODUCTION_SCREEN_ADMIN_MODERATION_INTERACTION_EVIDENCE_TEST.id;
const TEST_PATH =
  PRODUCTION_SCREEN_ADMIN_MODERATION_INTERACTION_EVIDENCE_TEST.path;
const actionExclusions = new Set<string>(
  PRODUCTION_SCREEN_ACTION_EXCLUSION_ROUTES,
);
const formExclusions = new Set<string>(PRODUCTION_SCREEN_FORM_EXCLUSION_ROUTES);
const onboardingExclusions = new Set(
  Object.keys(PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS),
);

const EXPECTED_ADMIN_MODERATION_INTERACTIONS = {
  "/admin/feed": {
    actionIds: [
      "ADMIN-FEED.ACTION.TOPIC.CREATE",
      "ADMIN-FEED.ACTION.TOPIC.ACTIVE.SET",
      "ADMIN-FEED.ACTION.POST.MODERATE",
    ],
    forms: [
      ["ADMIN-FEED.FORM.TOPIC-CREATE", "SERVER ACTION createFeedTopic"],
      [
        "ADMIN-FEED.FORM.TOPIC-ACTIVE",
        "SERVER ACTION setFeedTopicActive",
      ],
      [
        "ADMIN-FEED.FORM.POST-MODERATION",
        "SERVER ACTION moderateFeedPost",
      ],
    ],
    sourceAssertions: [
      "await requireModeratorProfile();",
      "<form action={createFeedTopic}",
      "action={setFeedTopicActive.bind(null, topic.id, !topic.active)}",
      "<form action={moderateFeedPost.bind(null, postId)}",
      'name="action"',
      "maxLength={500}",
    ],
  },
  "/admin/safety": {
    actionIds: [
      "ADMIN-SAFETY.ACTION.PHRASE.CREATE",
      "ADMIN-SAFETY.ACTION.PHRASE.ACTIVE.SET",
      "ADMIN-SAFETY.ACTION.FLAG.RESOLVE",
    ],
    forms: [
      [
        "ADMIN-SAFETY.FORM.PHRASE-CREATE",
        "SERVER ACTION createBannedPhrase",
      ],
      [
        "ADMIN-SAFETY.FORM.PHRASE-ACTIVE",
        "SERVER ACTION setBannedPhraseActive",
      ],
      [
        "ADMIN-SAFETY.FORM.FLAG-RESOLUTION",
        "SERVER ACTION resolveTrustSafetyFlag",
      ],
    ],
    sourceAssertions: [
      "await requireModeratorProfile();",
      "<form action={createBannedPhrase}",
      "action={setBannedPhraseActive.bind(",
      "<form action={resolveTrustSafetyFlag.bind(null, flag.id)}>",
      'name="target"',
      'name="action"',
    ],
  },
  "/admin/listings": {
    actionIds: [
      "ADMIN-LISTINGS.ACTION.LISTING.OPEN",
      "ADMIN-LISTINGS.ACTION.CATEGORY.CREATE",
      "ADMIN-LISTINGS.ACTION.CATEGORY.ACTIVE.SET",
      "ADMIN-LISTINGS.ACTION.LISTING.APPROVE",
      "ADMIN-LISTINGS.ACTION.LISTING.REJECT",
      "ADMIN-LISTINGS.ACTION.LISTING.REMOVE",
    ],
    forms: [
      [
        "ADMIN-LISTINGS.FORM.CATEGORY-CREATE",
        "SERVER ACTION createMarketplaceCategory",
      ],
      [
        "ADMIN-LISTINGS.FORM.CATEGORY-ACTIVE",
        "SERVER ACTION setMarketplaceCategoryActive",
      ],
      ["ADMIN-LISTINGS.FORM.APPROVE", "SERVER ACTION approveListing"],
      ["ADMIN-LISTINGS.FORM.REJECT", "SERVER ACTION rejectListing"],
      ["ADMIN-LISTINGS.FORM.REMOVE", "SERVER ACTION removeListing"],
    ],
    sourceAssertions: [
      "await requireModeratorProfile();",
      "<form action={createMarketplaceCategory}",
      "action={setMarketplaceCategoryActive.bind(",
      "href={`/marketplace/${listing.id}`}",
      "<form action={approveAction}>",
      "<form action={rejectAction}",
      "<form action={removeAction}",
      "minLength={3}",
      "maxLength={500}",
    ],
  },
  "/admin/reports": {
    actionIds: ["ADMIN-REPORTS.ACTION.REPORT.RESOLVE"],
    forms: [
      ["ADMIN-REPORTS.FORM.RESOLUTION", "SERVER ACTION resolveReport"],
    ],
    sourceAssertions: [
      "await requireModeratorProfile();",
      "const action = resolveReport.bind(null, reportId);",
      "<form action={action}",
      '<option value="ban_user">Ban user</option>',
      "maxLength={1000}",
    ],
  },
} as const;

assert.deepEqual(
  PRODUCTION_SCREEN_ADMIN_MODERATION_INTERACTION_ROUTES,
  Object.keys(EXPECTED_ADMIN_MODERATION_INTERACTIONS),
  "the admin-moderation batch must fail closed on route additions or removals",
);
assert.deepEqual(
  Object.keys(PRODUCTION_SCREEN_ADMIN_MODERATION_INTERACTION_CONTRACTS),
  PRODUCTION_SCREEN_ADMIN_MODERATION_INTERACTION_ROUTES,
  "the owned module may contain only the reviewed admin-moderation routes",
);
assert.equal(PRODUCTION_SCREEN_ADMIN_MODERATION_INTERACTION_ROUTES.length, 4);

let actionInventoryCount = 0;
let structuredFormCount = 0;

for (const route of PRODUCTION_SCREEN_ADMIN_MODERATION_INTERACTION_ROUTES) {
  const expected = EXPECTED_ADMIN_MODERATION_INTERACTIONS[route];
  const ownedInteraction =
    PRODUCTION_SCREEN_ADMIN_MODERATION_INTERACTION_CONTRACTS[route];
  const interaction = PRODUCTION_SCREEN_INTERACTION_CONTRACTS[route];
  const screen = SCREEN_CONTRACT_BY_ROUTE.get(route);
  assert.ok(screen, `${route}: missing production screen contract`);
  assert.equal(screen.productionEnabled, true);
  assert.equal(screen.authentication, "required");
  assert.equal(onboardingExclusions.has(route), false);
  assert.equal(
    screen.coverage.onboarding.status,
    "tested",
    `${route}: shared role-aware onboarding must remain tested`,
  );
  assert.equal(actionExclusions.has(route), false);
  assert.equal(formExclusions.has(route), false);
  assert.equal(interaction, ownedInteraction);

  assert.deepEqual(interaction.queryParameters, []);
  assert.deepEqual(
    interaction.actions.map((candidate) => candidate.id),
    expected.actionIds,
  );
  assert.deepEqual(
    interaction.forms.map((candidate) => [candidate.id, candidate.submitsTo]),
    expected.forms,
  );
  assert.deepEqual(screen.queryParameters, []);
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

  assert.equal(screen.coverage.actions.status, "verified");
  assert.equal(screen.coverage.forms.status, "verified");
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

  actionInventoryCount += interaction.actions.length;
  structuredFormCount += interaction.forms.length;
}

assert.equal(actionInventoryCount, 13);
assert.equal(structuredFormCount, 12);

const authSource = readFileSync("src/lib/auth.ts", "utf8");
for (const assertion of [
  "export async function requireModeratorProfile()",
  "if (!isModeratorRole(current.profileRole))",
]) {
  assert.ok(
    authSource.includes(assertion),
    `moderator auth must preserve ${assertion}`,
  );
}

const actionsSource = readFileSync("src/app/actions.ts", "utf8");
for (const assertion of [
  "export async function createFeedTopic(formData: FormData)",
  "const parsed = feedTopicWriteSchema.parse({",
  "export async function moderateFeedPost(postId: string, formData: FormData)",
  "const parsed = feedPostModerationSchema.parse({",
  "export async function createMarketplaceCategory(formData: FormData)",
  "const parsed = marketplaceCategoryWriteSchema.parse({",
  "moderationReason(formData, \"Rejected marketplace item\")",
  "moderationReason(formData, \"Removed marketplace item\")",
  "export async function resolveReport(reportId: string, formData: FormData)",
  "REPORT_RESOLVE_RATE_LIMIT = 30",
  "REPORT_RESOLVE_RATE_LIMIT_WINDOW_MS = 60 * 1000",
  "const parsed = reportResolveSchema.parse({",
  "export async function createBannedPhrase(formData: FormData)",
  "const parsed = bannedPhraseWriteSchema.parse({",
]) {
  assert.ok(
    actionsSource.includes(assertion),
    `moderation action boundary must preserve ${assertion}`,
  );
}
assert.ok(
  actionsSource.match(/const current = await requireModeratorProfile\(\);/g)!
    .length >= 12,
  "the shared moderation actions must continue to require a moderator profile",
);

const feedValidationSource = readFileSync(
  "src/lib/feed-validation.ts",
  "utf8",
);
for (const assertion of [
  "export const feedTopicWriteSchema = z.object({",
  "sortOrder: z.coerce.number().int().min(0).max(9999).default(0)",
  "export const feedPostModerationSchema = z.object({",
  'action: z.enum(["pin", "unpin", "hide", "remove", "restore"])',
  ".max(500)",
]) {
  assert.ok(
    feedValidationSource.includes(assertion),
    `feed validation must preserve ${assertion}`,
  );
}

const feedServiceSource = readFileSync("src/lib/feed-service.ts", "utf8");
for (const assertion of [
  "export async function createFeedTopicForModerator(",
  "export async function setFeedTopicActiveForModerator(",
  "export async function moderateFeedPostForModerator(",
  "if (!isModeratorRole(current.profileRole)) throw new Error(\"auth.forbidden\")",
  'action: "feed.topic.create"',
  'await broadcastFeedRealtimeEvent("topic_updated"',
]) {
  assert.ok(
    feedServiceSource.includes(assertion),
    `feed moderation service must preserve ${assertion}`,
  );
}

const moderationServiceSource = readFileSync(
  "src/lib/moderation-service.ts",
  "utf8",
);
for (const assertion of [
  "export async function createBannedPhraseForModerator(",
  "tx.bannedPhrase.upsert({",
  'action: "moderation.phrase.upsert"',
  "export async function setBannedPhraseActiveForModerator(",
  "export async function resolveTrustSafetyFlagForModerator(",
  'action: "trust_safety_flag.resolve"',
]) {
  assert.ok(
    moderationServiceSource.includes(assertion),
    `trust-and-safety service must preserve ${assertion}`,
  );
}

const listingServiceSource = readFileSync(
  "src/lib/listing-service.ts",
  "utf8",
);
for (const assertion of [
  "export async function createMarketplaceCategoryForModerator(",
  "export async function setMarketplaceCategoryActiveForModerator(",
  "export async function approveListingForModerator(",
  "export async function rejectListingForModerator(",
  "export async function removeListingForModerator(",
  "if (!isModeratorRole(current.profileRole)) throw new Error(\"auth.forbidden\")",
  "await tx.listingStatusHistory.create({",
  "await auditListingModeration(",
]) {
  assert.ok(
    listingServiceSource.includes(assertion),
    `listing moderation service must preserve ${assertion}`,
  );
}

const reportValidationSource = readFileSync(
  "src/lib/report-validation.ts",
  "utf8",
);
for (const assertion of [
  "export const reportResolveSchema = z.object({",
  '"dismiss",',
  '"delete_content",',
  ".max(1000)",
]) {
  assert.ok(
    reportValidationSource.includes(assertion),
    `report validation must preserve ${assertion}`,
  );
}

const reportServiceSource = readFileSync("src/lib/report-service.ts", "utf8");
for (const assertion of [
  "export async function resolveReportForModerator(",
  "withDbRequestContext(",
  "await lockAdminAccessChanges(tx);",
  "assertReportUserBanAllowed({",
  'action: "report.resolve"',
]) {
  assert.ok(
    reportServiceSource.includes(assertion),
    `report moderation service must preserve ${assertion}`,
  );
}

console.log(
  "Admin-moderation interaction coverage passed: 4 action routes, 4 verified form routes, 13 action entries, 12 structured forms, shared onboarding retained",
);
