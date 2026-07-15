import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SCREEN_CONTRACT_BY_ROUTE } from "../src/components/demo-experience-registry";
import { DATABASE_OPERATIONS } from "./database-operations";
import {
  MANDATORY_PUBLIC_RACING_TRACE_BINDINGS,
  MANDATORY_PUBLIC_RACING_TRACE_MASTER_EVIDENCE,
  MANDATORY_PUBLIC_RACING_TRACE_REQUIREMENT_IDS,
  MANDATORY_PUBLIC_RACING_TRACE_RESIDUALS,
} from "./mandatory-public-racing-trace-evidence";
import { SECURITY_TRACES } from "./traces";

const EXPECTED_BINDINGS = {
  "security.trace.01.homepage-read": "PUBLIC.HOME.READ",
  "security.trace.02.contact-submit": "SUPPORT.TICKET.CREATE",
  "security.trace.03.sign-in-start": "AUTH.SIGN_IN.START",
  "security.trace.05.signed-out-protected-route":
    "ACCOUNT.PROTECTED.SIGNED_OUT_DENY",
  "security.trace.06.race-search": "RACING.RACE.SEARCH",
  "security.trace.07.open-race": "RACING.RACE.OPEN",
  "security.trace.08.open-dog": "RACING.DOG.OPEN",
  "security.trace.09.open-track": "RACING.TRACK.OPEN",
} as const;

assert.deepEqual(MANDATORY_PUBLIC_RACING_TRACE_BINDINGS, EXPECTED_BINDINGS);
assert.deepEqual(
  MANDATORY_PUBLIC_RACING_TRACE_REQUIREMENT_IDS.toSorted(),
  Object.keys(EXPECTED_BINDINGS).toSorted(),
);
assert.equal(MANDATORY_PUBLIC_RACING_TRACE_REQUIREMENT_IDS.length, 8);

for (const requirementId of MANDATORY_PUBLIC_RACING_TRACE_REQUIREMENT_IDS) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) =>
      candidate.prompt === "security" && candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: immutable requirement missing`);
  assert.equal(requirement.section, "mandatory-trace");
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    MANDATORY_PUBLIC_RACING_TRACE_MASTER_EVIDENCE[requirementId],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
  assert.ok(
    MANDATORY_PUBLIC_RACING_TRACE_RESIDUALS[requirementId].length > 0,
    `${requirementId}: exact residuals must remain exported`,
  );

  for (const evidencePath of
    MANDATORY_PUBLIC_RACING_TRACE_MASTER_EVIDENCE[requirementId].evidence) {
    assert.ok(existsSync(evidencePath), `${requirementId}: missing ${evidencePath}`);
  }
}

const targetTraceIds = new Set(Object.values(EXPECTED_BINDINGS));
const targetTraces = SECURITY_TRACES.filter((trace) =>
  targetTraceIds.has(trace.traceId as (typeof EXPECTED_BINDINGS)[keyof typeof EXPECTED_BINDINGS]),
);
assert.equal(targetTraces.length, 8);
assert.equal(new Set(targetTraces.map((trace) => trace.traceId)).size, 8);

for (const trace of targetTraces) {
  assert.equal(trace.verificationStatus, "Partially verified");
  assert.ok(trace.userStoryIds.length > 0, `${trace.traceId}: user story`);
  assert.ok(trace.routePatterns.length > 0, `${trace.traceId}: route`);
  assert.ok(trace.server.entryFiles.length > 0, `${trace.traceId}: entry`);
  assert.ok(trace.server.handlers.length > 0, `${trace.traceId}: handler`);
  assert.ok(trace.server.authorizationPolicy.trim(), `${trace.traceId}: authz`);
  assert.ok(trace.server.requestValidationSchema.trim(), `${trace.traceId}: validation`);
  assert.ok(trace.server.outputSchema.trim(), `${trace.traceId}: output`);
  assert.ok(trace.server.businessService.trim(), `${trace.traceId}: service`);
  assert.ok(trace.server.repositoryMethods.length > 0, `${trace.traceId}: repository/N-A`);
  assert.ok(trace.response.responseSchema.trim(), `${trace.traceId}: response`);
  assert.ok(trace.tests.includes("security/mandatory-public-racing-trace-evidence.test.ts"));
  assert.ok(
    trace.evidence.some((entry) => entry.startsWith("Residual:")),
    `${trace.traceId}: residual must remain explicit`,
  );

  for (const sourcePath of [
    ...trace.frontend.sourceFiles,
    ...trace.server.entryFiles,
    ...trace.tests,
  ]) {
    assert.ok(existsSync(sourcePath), `${trace.traceId}: missing ${sourcePath}`);
  }

  for (const screenId of trace.screenIds) {
    const route = screenId.replace(/^screen:/, "");
    assert.ok(SCREEN_CONTRACT_BY_ROUTE.has(route), `${trace.traceId}: ${screenId}`);
  }
}

const expectedDatabaseQueryIds = {
  "PUBLIC.HOME.READ": ["DB.PUBLIC.HOME.RACE_MEETINGS.READ_BUNDLE"],
  "SUPPORT.TICKET.CREATE": ["DB.SUPPORT.TICKET.CREATE.TRANSACTION"],
  "AUTH.SIGN_IN.START": [],
  "ACCOUNT.PROTECTED.SIGNED_OUT_DENY": [],
  "RACING.RACE.SEARCH": ["DB.RACING.RACE.SEARCH.READ_BUNDLE"],
  "RACING.RACE.OPEN": ["DB.RACING.RACE.OPEN.DETAIL_BUNDLE"],
  "RACING.DOG.OPEN": [
    "DB.RACING.DOG.OPEN.PUBLIC_DETAIL_BUNDLE",
    "DB.RACING.DOG.OPEN.OWNERSHIP.SELECT",
  ],
  "RACING.TRACK.OPEN": ["DB.RACING.TRACK.OPEN.DETAIL_BUNDLE"],
} as const;

for (const trace of targetTraces) {
  assert.deepEqual(
    trace.databaseOperations.map((operation) => operation.queryId),
    expectedDatabaseQueryIds[
      trace.traceId as keyof typeof expectedDatabaseQueryIds
    ],
    `${trace.traceId}: exact datastore path`,
  );
}

const targetOperations = DATABASE_OPERATIONS.filter((operation) =>
  targetTraceIds.has(operation.traceId as (typeof EXPECTED_BINDINGS)[keyof typeof EXPECTED_BINDINGS]),
);
assert.equal(targetOperations.length, 7);
assert.equal(new Set(targetOperations.map((operation) => operation.queryId)).size, 7);
assert.deepEqual(
  Object.fromEntries(
    targetOperations.map((operation) => [
      operation.queryId,
      operation.verificationStatus,
    ]),
  ),
  {
    "DB.PUBLIC.HOME.RACE_MEETINGS.READ_BUNDLE": "Verified",
    "DB.RACING.RACE.SEARCH.READ_BUNDLE": "Verified",
    "DB.RACING.RACE.OPEN.DETAIL_BUNDLE": "Verified",
    "DB.RACING.DOG.OPEN.PUBLIC_DETAIL_BUNDLE": "Verified",
    "DB.RACING.DOG.OPEN.OWNERSHIP.SELECT": "Verified",
    "DB.RACING.TRACK.OPEN.DETAIL_BUNDLE": "Verified",
    "DB.SUPPORT.TICKET.CREATE.TRANSACTION": "Verified",
  },
);
assert.ok(targetOperations.every((operation) => operation.parameterized));
assert.ok(targetOperations.every((operation) => operation.evidence.length > 0));

for (const traceId of [
  "AUTH.SIGN_IN.START",
  "ACCOUNT.PROTECTED.SIGNED_OUT_DENY",
]) {
  const trace = requiredTrace(traceId);
  assert.deepEqual(trace.databaseOperations, []);
  assert.match(trace.server.repositoryMethods.join(" "), /No application datastore operation/);
  assert.ok(
    trace.evidence.some((entry) => entry.startsWith("No application database step exists")),
  );
}

const homepage = source("src/app/page.tsx");
assert.match(homepage, /async function TodaysRacesSection\(\)/);
assert.match(homepage, /const meetings = await getTodaysMeetings\(\)/);
assert.match(homepage, /No meetings are available for this race day yet/);

const actions = source("src/app/actions.ts");
const supportAction = between(
  actions,
  "export async function createSupportTicket",
  "export async function markNotificationRead",
);
assertOrdered(supportAction, [
  "requireCurrentUserProfile()",
  "checkRateLimit(",
  "supportTicketSchema.parse",
  "withDbRequestContext(current",
  "tx.supportTicket.create",
  "tx.supportMessage.create",
  "cleanText(parsed.body)",
  'redirect("/account/support?ticket=created")',
]);
assert.match(actions, /body: z\.string\(\)\.trim\(\)\.min\(20\)\.max\(5_000\)/);
assert.match(actions, /const SUPPORT_TICKET_RATE_LIMIT = 3/);
assert.match(actions, /const SUPPORT_TICKET_RATE_LIMIT_WINDOW_MS = 60 \* 60 \* 1000/);

const supportRls = source(
  "prisma/migrations/20260708190000_add_rls_remaining_tables/migration.sql",
);
assert.match(supportRls, /CREATE POLICY giq_support_ticket_insert/);
assert.match(supportRls, /CREATE POLICY giq_support_message_insert/);
assert.match(supportRls, /"userId" = public\.giq_current_user_id\(\)/);

const signInRoute = source("src/app/sign-in/route.ts");
assertOrdered(signInRoute, [
  "resolveWorkosReturnTo({",
  "resolveWorkosRedirectUri(request.url)",
  "getSignInUrl({",
  "redirect(signInUrl)",
]);
const workosRedirect = source("src/lib/workos-redirect.ts");
for (const guard of [
  'candidate.startsWith("//")',
  'candidate.includes("\\\\")',
  "/%(?:25)*(?:2f|5c)/i",
  'path === "/sign-in"',
  'path === "/callback"',
]) {
  assert.ok(workosRedirect.includes(guard), `return-path guard missing: ${guard}`);
}

const notificationsPage = source("src/app/account/notifications/page.tsx");
const notificationsHandler = between(
  notificationsPage,
  "export default async function AccountNotificationsPage",
  "async function requireNotificationsProfile",
);
assertOrdered(notificationsHandler, [
  "requireNotificationsProfile()",
  "listNotificationsForUser(current.dbUserId)",
  "getMarketingPreferences(current)",
]);
const notificationsGuard = between(
  notificationsPage,
  "async function requireNotificationsProfile",
  "function getMarketingPreferences",
);
assertOrdered(notificationsGuard, [
  "requireCurrentUserProfile()",
  'err.message === "auth.unauthorized"',
  'redirect("/sign-in")',
  "throw err",
]);
const auth = source("src/lib/auth.ts");
const requiredAuth = between(
  auth,
  "export async function requireCurrentUserProfile",
  "async function getDemoCurrentUserProfile",
);
assertOrdered(requiredAuth, [
  "withAuth()",
  "if (!user)",
  'throw new Error("auth.unauthorized")',
  "syncAuthUser(user)",
]);

const racePage = source("src/app/races/page.tsx");
assert.match(racePage, /const data = await getRaceExplorerData\(\{/);
for (const field of ["date", "state", "q", "status", "sort"]) {
  assert.match(racePage, new RegExp(`firstParam\\(params\\.${field}\\)`));
}
const queries = source("src/lib/queries.ts");
assert.match(queries, /\.slice\(0, 80\)/);
assert.match(queries, /const RACE_SEARCH_RESULT_LIMIT = 120/);
assert.match(queries, /const RACE_SEARCH_DOG_MATCH_LIMIT = 80/);
assert.match(queries, /const RACE_SEARCH_RUNNER_RESULT_LIMIT = 48/);
assert.match(queries, /const RACE_EXPLORER_STATE_LIMIT = 16/);
assert.match(queries, /take: RACE_EXPLORER_STATE_LIMIT/);

const raceDetail = source("src/app/races/[id]/page.tsx");
assertOrdered(raceDetail, [
  "const { id } = await params",
  "getRaceById(id)",
  "if (!race) notFound()",
  "resolveProviderReplay({",
  "proxiedStreamPath(",
  "getPreviousRaceVideoRunners(race.id)",
]);
assert.match(raceDetail, /const MAX_PREVIOUS_RACE_VIDEO_RESOLVES = 2/);
assert.match(source("src/lib/live/race-replay.ts"), /REPLAY_FETCH_TIMEOUT_MS = 15_000/);
assert.match(source("src/lib/live/thedogs-replay.ts"), /absoluteTheDogsUrl/);
assert.match(source("src/lib/live/replay-proxy.ts"), /ALLOWED_STREAM_HOSTS/);

const dogDetail = source("src/app/dogs/[id]/page.tsx");
assertOrdered(dogDetail, [
  "getDogById(id)",
  "getCurrentUser()",
  "getDogPedigree(id)",
  "if (!dog) notFound()",
  "getMyDogOwnership(",
]);
const getDogById = between(
  queries,
  "export const getDogById",
  "export async function getMyDogOwnership",
);
assert.doesNotMatch(getDogById, /email:\s*true|subscriptionTier:\s*true/);
for (const bound of [
  "take: DOG_DETAIL_FORM_ENTRY_LIMIT",
  "take: DOG_DETAIL_PROFILE_FORM_LIMIT",
  "take: DOG_DETAIL_RUNNER_LIMIT",
  "take: DOG_DETAIL_OWNERSHIP_LIMIT",
  'where: { status: "approved" }',
]) {
  assert.ok(getDogById.includes(bound), bound);
}
assert.match(
  MANDATORY_PUBLIC_RACING_TRACE_RESIDUALS["security.trace.08.open-dog"].join(" "),
  /Representative production volume.*sustained-load p99/,
);

const trackDetail = source("src/app/tracks/[id]/page.tsx");
assertOrdered(trackDetail, [
  "const { id } = await params",
  "getTrackById(id)",
  "if (!track) notFound()",
]);
const getTrackById = between(
  queries,
  "export const getTrackById",
  "export async function getForumOverview",
);
for (const limit of [
  "TRACK_DETAIL_MEETING_LIMIT = 8",
  "TRACK_DETAIL_RACE_LIMIT = 16",
  "TRACK_DETAIL_RUNNER_LIMIT = 12",
]) {
  assert.match(queries, new RegExp(limit));
}
for (const usage of [
  "take: TRACK_DETAIL_MEETING_LIMIT",
  "take: TRACK_DETAIL_RACE_QUERY_LIMIT",
  "take: TRACK_DETAIL_RUNNER_QUERY_LIMIT",
]) {
  assert.ok(getTrackById.includes(usage), usage);
}

console.log(
  "mandatory public/racing trace evidence passed: exactly 8 gates, 8 source traces, 7 linked datastore records, four verified public-racing reads and explicit residuals",
);

function requiredTrace(traceId: string) {
  const trace = SECURITY_TRACES.find((candidate) => candidate.traceId === traceId);
  assert.ok(trace, `${traceId}: trace missing`);
  return trace;
}

function source(path: string) {
  return readFileSync(path, "utf8");
}

function between(value: string, start: string, end: string) {
  const startIndex = value.indexOf(start);
  const endIndex = value.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0, `missing start marker: ${start}`);
  assert.ok(endIndex > startIndex, `missing end marker: ${end}`);
  return value.slice(startIndex, endIndex);
}

function assertOrdered(value: string, markers: readonly string[]) {
  let offset = -1;
  for (const marker of markers) {
    const next = value.indexOf(marker, offset + 1);
    assert.ok(next > offset, `missing/out-of-order marker: ${marker}`);
    offset = next;
  }
}
