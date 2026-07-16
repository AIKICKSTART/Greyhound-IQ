import type { DatabaseOperationContract } from "./database-operations";

function capturedDogDetailSelect(
  variant: string,
  normalizedSql: string,
  parameterCount: number,
) {
  return {
    variant,
    normalizedSql,
    boundParameters: [
      `Captured parameterized binds (${parameterCount}); values are not persisted in evidence.`,
    ],
    explainPlanEvidence:
      "Sanitized PostgreSQL JSON COSTS plan with ANALYZE/BUFFERS disabled and a 5 s statement timeout.",
  };
}

/**
 * Source-static datastore contracts for mandatory traces 01-03 and 05-09.
 *
 * A bundle record is used where one page service deliberately issues several
 * related Prisma reads. The evidence does not claim generated SQL, plans,
 * runtime row counts, or deployed-role parity that has not been captured.
 */
export const MANDATORY_PUBLIC_RACING_DATABASE_OPERATIONS = [
  {
    queryId: "DB.PUBLIC.HOME.RACE_MEETINGS.READ_BUNDLE",
    traceId: "PUBLIC.HOME.READ",
    sourceFile: "src/lib/queries.ts",
    sourceSymbol: "getTodaysMeetings -> getRaceExplorerMeetings",
    ormOrDriver: "Prisma",
    ormOperation:
      "meeting.findMany, race.findMany, runner.groupBy and raceVideo.findMany for the current Australia/Sydney race-day window",
    normalizedSql:
      'SELECT "public"."Meeting"."id", "public"."Meeting"."meetingDate", "public"."Meeting"."sourceProvider", "public"."Meeting"."trackId" FROM "public"."Meeting" LEFT JOIN "public"."Track" AS "orderby_1" ON ("orderby_1"."id") = ("public"."Meeting"."trackId") LEFT JOIN "public"."Track" AS "orderby_2" ON ("orderby_2"."id") = ("public"."Meeting"."trackId") WHERE EXISTS(SELECT "t0"."meetingId" FROM "public"."Race" AS "t0" WHERE ("t0"."raceTime" >= $1 AND "t0"."raceTime" < $2 AND ("public"."Meeting"."id") = ("t0"."meetingId") AND "t0"."meetingId" IS NOT NULL)) ORDER BY "orderby_1"."state" ASC, "orderby_2"."name" ASC LIMIT $3 OFFSET $4',
    normalizedSqlVariants: [
      {
        variant: "meetings",
        normalizedSql:
          'SELECT "public"."Meeting"."id", "public"."Meeting"."meetingDate", "public"."Meeting"."sourceProvider", "public"."Meeting"."trackId" FROM "public"."Meeting" LEFT JOIN "public"."Track" AS "orderby_1" ON ("orderby_1"."id") = ("public"."Meeting"."trackId") LEFT JOIN "public"."Track" AS "orderby_2" ON ("orderby_2"."id") = ("public"."Meeting"."trackId") WHERE EXISTS(SELECT "t0"."meetingId" FROM "public"."Race" AS "t0" WHERE ("t0"."raceTime" >= $1 AND "t0"."raceTime" < $2 AND ("public"."Meeting"."id") = ("t0"."meetingId") AND "t0"."meetingId" IS NOT NULL)) ORDER BY "orderby_1"."state" ASC, "orderby_2"."name" ASC LIMIT $3 OFFSET $4',
        boundParameters: [
          "current Australia/Sydney race-day gte ($1)",
          "current Australia/Sydney race-day lt ($2)",
          "meeting take=128 ($3)",
          "meeting offset=0 ($4)",
        ],
        explainPlanEvidence:
          "Sanitized PostgreSQL JSON COSTS Limit plan for the Meeting/Track/Race existence query with ANALYZE/BUFFERS disabled and a 5 s statement timeout.",
      },
      {
        variant: "tracks",
        normalizedSql:
          'SELECT "public"."Track"."id", "public"."Track"."name", "public"."Track"."state", "public"."Track"."hasIsolynx" FROM "public"."Track" WHERE "public"."Track"."id" IN ($1) OFFSET $2',
        boundParameters: [
          "selected track IDs from at most 128 meetings ($1..$128)",
          "track offset=0 (last bind)",
        ],
        explainPlanEvidence:
          "Sanitized PostgreSQL JSON COSTS primary-key-bound Track plan with ANALYZE/BUFFERS disabled and a 5 s statement timeout; the captured fixture uses one track ID and the parent meeting limit bounds production cardinality to 128.",
      },
      {
        variant: "races",
        normalizedSql:
          'SELECT "public"."Race"."id", "public"."Race"."meetingId", "public"."Race"."raceNumber", "public"."Race"."raceTime", "public"."Race"."distance", "public"."Race"."grade", "public"."Race"."resultStatus" FROM "public"."Race" WHERE ("public"."Race"."raceTime" >= $1 AND "public"."Race"."raceTime" < $2 AND "public"."Race"."meetingId" IN ($3)) ORDER BY "public"."Race"."raceTime" ASC LIMIT $4 OFFSET $5',
        boundParameters: [
          "current Australia/Sydney race-day gte ($1)",
          "current Australia/Sydney race-day lt ($2)",
          "selected meeting IDs (captured $3; at most 128 IDs)",
          "race take=2048 (penultimate bind)",
          "race offset=0 (last bind)",
        ],
        explainPlanEvidence:
          "Sanitized PostgreSQL JSON COSTS Limit plan for Race with ANALYZE/BUFFERS disabled and a 5 s statement timeout.",
      },
      {
        variant: "runner-groups",
        normalizedSql:
          'SELECT COUNT(*) AS "_count$_all", "public"."Runner"."raceId" FROM "public"."Runner" WHERE "public"."Runner"."raceId" IN ($1,$2) GROUP BY "public"."Runner"."raceId" ORDER BY "public"."Runner"."raceId" ASC LIMIT $3 OFFSET $4',
        boundParameters: [
          "selected race IDs (captured $1,$2; at most 2048 IDs)",
          "runner-group take=2048 (penultimate bind)",
          "runner-group offset=0 (last bind)",
        ],
        explainPlanEvidence:
          "Sanitized PostgreSQL JSON COSTS Limit/Aggregate plan for Runner with ANALYZE/BUFFERS disabled and a 5 s statement timeout.",
      },
      {
        variant: "latest-videos",
        normalizedSql:
          'SELECT "public"."RaceVideo"."id", "public"."RaceVideo"."raceId", "public"."RaceVideo"."streamUrl", "public"."RaceVideo"."sourceStatus" FROM "public"."RaceVideo" WHERE "public"."RaceVideo"."raceId" IN ($1,$2) ORDER BY "public"."RaceVideo"."fetchedAt" DESC, "public"."RaceVideo"."id" ASC LIMIT $3 OFFSET $4',
        boundParameters: [
          "selected race IDs (captured $1,$2; at most 2048 IDs)",
          "latest-video take=2048 (penultimate bind)",
          "latest-video offset=0 (last bind)",
        ],
        explainPlanEvidence:
          "Sanitized PostgreSQL JSON COSTS Limit plan for RaceVideo with ANALYZE/BUFFERS disabled and a 5 s statement timeout; application projection keeps the first fetchedAt-desc row per race.",
      },
    ],
    databaseRole: "greyhoundiq_runtime",
    databaseName: "greyhoundiq",
    schemaName: "public",
    operationType: "select",
    tables: ["Meeting", "Track", "Race", "Runner", "RaceVideo"],
    views: [],
    columnsRead: [
      "Meeting.id",
      "Meeting.meetingDate",
      "Meeting.sourceProvider",
      "Track.id",
      "Track.name",
      "Track.state",
      "Track.hasIsolynx",
      "Race.id",
      "Race.meetingId",
      "Race.raceNumber",
      "Race.raceTime",
      "Race.distance",
      "Race.grade",
      "Race.resultStatus",
      "Runner.raceId count",
      "RaceVideo.id",
      "RaceVideo.raceId",
      "RaceVideo.streamUrl",
      "RaceVideo.sourceStatus",
      "RaceVideo.fetchedAt (ordering only)",
    ],
    columnsWritten: [],
    boundParameters: [
      "current Australia/Sydney race-day gte",
      "current Australia/Sydney race-day lt",
      "selected meeting IDs",
      "selected race IDs",
    ],
    parameterized: true,
    visibilityPredicate:
      "Race.raceTime is within the current Australia/Sydney race-day window; racing reference rows are public-read data.",
    rowLevelSecurityPolicies: [
      "giq_track_read",
      "giq_meeting_read",
      "giq_race_read",
      "giq_runner_read",
      "giq_race_video_read",
    ],
    expectedRowCount:
      "Zero to 128 meetings, zero to 128 referenced tracks, zero to 2048 races, zero to 2048 runner-count groups and zero to 2048 fetched video rows for one race day.",
    maximumRowCount: 6_400,
    paginationRequired: false,
    transactionBoundary:
      "One withDbAnonymousQueryDeadline interactive transaction covers the bounded meeting, race, runner-count and video reads.",
    isolationLevel:
      "PostgreSQL read committed in one anonymous request transaction; cross-statement repeatable-read consistency is not claimed.",
    concurrencyControl:
      "Meetings are capped at 128 and races, runner groups and fetched videos at 2048. Track reads are primary-key IN reads derived from the bounded meeting set. Runner counts and video metadata run in parallel only after bounded IDs are known.",
    indexesExpected: [
      "Race_raceTime_idx",
      "Race_meetingId_idx",
      "Runner_raceId_idx",
      "RaceVideo_raceId_idx",
      "RaceVideo_fetchedAt_idx",
    ],
    constraintsReliedOn: [
      "Meeting_pkey",
      "Track_pkey",
      "Race_pkey",
      "Race_meetingId_fkey",
      "Runner_raceId_fkey",
      "RaceVideo_raceId_fkey",
    ],
    triggersInvoked: [],
    timeoutMilliseconds: 30_000,
    explainPlanEvidence:
      "output/database-audit/home-race-meetings-read.json schema v1 proof.statements contains sanitized PostgreSQL JSON cost plans for all five generated SELECTs with ANALYZE/BUFFERS disabled and a 5 s statement timeout.",
    sensitiveColumns: [],
    returnedDataShape:
      "RaceExplorerMeeting[] projected into today's meeting cards with runner counts and replay availability.",
    notFoundBehaviour: "An empty result renders the explicit no-meetings homepage state.",
    unauthorizedBehaviour:
      "The public racing policies intentionally allow anonymous reads. Exact SQL replay inside withDbAnonymousContext returned only the controlled public fixture rows as non-BYPASSRLS greyhoundiq_runtime.",
    conflictBehaviour: "Not applicable to read.",
    failureBehaviour:
      "PostgreSQL cancels any statement after ten seconds and Prisma aborts the read bundle after thirty seconds. Production safeQuery fails closed; development may render the no-meetings state.",
    tests: [
      "security/mandatory-public-racing-trace-evidence.test.ts",
      "scripts/check-home-race-meetings-postgres.test.ts",
    ],
    evidence: [
      "Source inspection binds HomePage -> TodaysRacesSection -> getTodaysMeetings -> getRaceExplorerMeetings.",
      "output/database-audit/home-race-meetings-read.json schema v1 is source-bound to the query implementation, race-day clock, RLS migration and verifier. It proves the populated and empty bundles as login-capable, non-superuser, non-BYPASSRLS greyhoundiq_runtime on literal-loopback port 55734; exact anonymous replay of five SELECTs; reviewed limit/parent-key bounds; cost plans; latest-video projection; no mutation; and exact cleanup. Representative-volume planning, production deployment parity, page-level overload controls and query-failure telemetry remain separate trace/release residuals.",
      "src/lib/queries.ts executes getTodaysMeetings through withDbAnonymousQueryDeadline; src/lib/db-context.ts applies a parameterized 10 s PostgreSQL statement_timeout inside a 30 s Prisma transaction.",
    ],
    verificationStatus: "Verified",
  },
  {
    queryId: "DB.SUPPORT.TICKET.CREATE.TRANSACTION",
    traceId: "SUPPORT.TICKET.CREATE",
    sourceFile: "src/app/actions.ts",
    sourceSymbol: "createSupportTicket",
    ormOrDriver: "Prisma",
    ormOperation:
      "withDbRequestContext transaction containing supportTicket.create followed by supportMessage.create",
    normalizedSql:
      'INSERT INTO "public"."SupportTicket" ("id","userId","status","priority","category","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING "public"."SupportTicket"."id", "public"."SupportTicket"."userId", "public"."SupportTicket"."status", "public"."SupportTicket"."priority", "public"."SupportTicket"."category", "public"."SupportTicket"."createdAt", "public"."SupportTicket"."updatedAt"',
    normalizedSqlVariants: [
      {
        variant: "support-ticket-insert",
        normalizedSql:
          'INSERT INTO "public"."SupportTicket" ("id","userId","status","priority","category","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING "public"."SupportTicket"."id", "public"."SupportTicket"."userId", "public"."SupportTicket"."status", "public"."SupportTicket"."priority", "public"."SupportTicket"."category", "public"."SupportTicket"."createdAt", "public"."SupportTicket"."updatedAt"',
        boundParameters: [
          "generated SupportTicket.id ($1)",
          "current.dbUserId ($2)",
          "default open status ($3)",
          "default normal priority ($4)",
          "parsed category ($5)",
          "Prisma createdAt and updatedAt ($6, $7)",
        ],
        explainPlanEvidence:
          "Sanitized PostgreSQL JSON COSTS ModifyTable plan over SupportTicket with ANALYZE/BUFFERS disabled and a 5 s statement timeout.",
      },
      {
        variant: "support-message-insert",
        normalizedSql:
          'INSERT INTO "public"."SupportMessage" ("id","ticketId","userId","body","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6) RETURNING "public"."SupportMessage"."id", "public"."SupportMessage"."ticketId", "public"."SupportMessage"."userId", "public"."SupportMessage"."body", "public"."SupportMessage"."createdAt", "public"."SupportMessage"."updatedAt"',
        boundParameters: [
          "generated SupportMessage.id ($1)",
          "created SupportTicket.id ($2)",
          "current.dbUserId ($3)",
          "cleanText(parsed.body) ($4)",
          "Prisma createdAt and updatedAt ($5, $6)",
        ],
        explainPlanEvidence:
          "Sanitized PostgreSQL JSON COSTS ModifyTable plan over SupportMessage plus SupportTicket_pkey policy checks with ANALYZE/BUFFERS disabled and a 5 s statement timeout.",
      },
    ],
    databaseRole: "greyhoundiq_runtime",
    databaseName: "greyhoundiq",
    schemaName: "public",
    operationType: "transaction",
    tables: ["SupportTicket", "SupportMessage"],
    views: [],
    columnsRead: [
      "SupportTicket.id returned from insert",
      "SupportTicket.id/userId read by giq_support_message_insert ownership check",
    ],
    columnsWritten: [
      "SupportTicket.userId",
      "SupportTicket.category",
      "SupportMessage.ticketId",
      "SupportMessage.userId",
      "SupportMessage.body",
    ],
    boundParameters: [
      "current.dbUserId",
      "parsed.category",
      "created SupportTicket.id",
      "cleanText(parsed.body)",
    ],
    parameterized: true,
    ownershipPredicate:
      "Both inserted userId values equal authenticated current.dbUserId, and giq_support_message_insert also requires the referenced SupportTicket.userId to equal that request-context user.",
    rowLevelSecurityPolicies: [
      "giq_support_ticket_insert",
      "giq_support_message_insert",
    ],
    expectedRowCount: "Exactly one SupportTicket and one initial SupportMessage.",
    maximumRowCount: 2,
    paginationRequired: false,
    transactionBoundary: "withDbRequestContext Prisma transaction",
    isolationLevel:
      "PostgreSQL read committed, captured inside the exact request-context transaction configuration.",
    locks: [
      "PostgreSQL INSERT and foreign-key/policy locks are bounded to the new SupportTicket, new SupportMessage and referenced owner rows; a separate lock sample is not retained.",
    ],
    concurrencyControl:
      "The per-user 3/hour limiter executes before the transaction; no idempotency key prevents a permitted duplicate submit.",
    indexesExpected: [
      "SupportTicket_pkey",
      "SupportTicket_userId_idx",
      "SupportMessage_ticketId_idx",
      "SupportMessage_userId_idx",
    ],
    constraintsReliedOn: [
      "SupportTicket_pkey",
      "SupportMessage_pkey",
      "SupportMessage_ticketId_fkey",
      "SupportMessage_userId_fkey",
    ],
    triggersInvoked: [],
    timeoutMilliseconds: 30_000,
    explainPlanEvidence:
      "output/database-audit/support-ticket-create.json schema v1 proof.statements contains sanitized PostgreSQL JSON cost plans for both exact INSERT statements with ANALYZE/BUFFERS disabled and a 5 s statement timeout.",
    sensitiveColumns: ["SupportTicket.userId", "SupportMessage.userId", "SupportMessage.body"],
    returnedDataShape: "No database row is returned to the browser; the action redirects after commit.",
    notFoundBehaviour: "Not applicable to create.",
    unauthorizedBehaviour:
      "requireCurrentUserProfile rejects before the limiter or writes. Disposable runtime-role replay proves anonymous and cross-account SupportTicket inserts fail, and a caller cannot add a self-authored message to another member's ticket.",
    conflictBehaviour:
      "A repeated permitted form submit creates another ticket; an idempotency contract is not implemented.",
    failureBehaviour:
      "The request-context transaction rolls back both inserts and no success redirect is returned; forced post-message failure replay proves neither row remains.",
    tests: [
      "security/mandatory-public-racing-trace-evidence.test.ts",
      "src/components/screen-contracts/screen-permission-evidence.test.ts",
      "scripts/check-rls-policies.ts",
      "scripts/check-support-ticket-create-postgres.test.ts",
    ],
    evidence: [
      "Source inspection proves authentication, per-user 3/hour limiting, category/body parsing, cleanText sanitization and the two-write request-context transaction order.",
      "output/database-audit/support-ticket-create.json schema v1 is source-bound to the action, context, RLS migrations and verifier. As login-capable, non-superuser, non-BYPASSRLS greyhoundiq_runtime on literal-loopback port 55734 it proves exactly one ticket plus one initial message commit, sanitization, both-row rollback, the intentional distinct duplicate pair, exact SQL/parameter coverage, cost plans, anonymous/cross-account denial and exact cleanup. Production deployment parity, byte-level request caps, persisted audit events, idempotency and support-specific safe logging remain separate trace/release residuals.",
    ],
    verificationStatus: "Verified",
  },
  {
    queryId: "DB.RACING.RACE.SEARCH.READ_BUNDLE",
    traceId: "RACING.RACE.SEARCH",
    sourceFile: "src/lib/queries.ts",
    sourceSymbol: "getRaceExplorerData -> fetchRaceExplorerData",
    ormOrDriver: "Prisma and parameterized Prisma $queryRaw templates",
    ormOperation:
      "bounded ranked race-ID search plus meeting, race, runner-count, replay and summary reads",
    normalizedSql:
      'SELECT "public"."Track"."state" FROM "public"."Track" WHERE 1=1 GROUP BY "public"."Track"."state" ORDER BY "public"."Track"."state" ASC LIMIT $1 OFFSET $2',
    databaseRole: "greyhoundiq_runtime",
    databaseName: "greyhoundiq",
    schemaName: "public",
    operationType: "select",
    tables: [
      "Track",
      "Meeting",
      "Race",
      "Runner",
      "Result",
      "Dog",
      "DogProfileForm",
      "RaceVideo",
    ],
    views: ["PostgreSQL pg_class approximate table statistics"],
    columnsRead: [
      "Track.id/name/state/hasIsolynx",
      "Meeting.id/meetingDate/sourceProvider",
      "Race.id/meetingId/raceNumber/raceTime/distance/grade/name",
      "Runner.raceId/dogId counts",
      "Result.raceId existence/count",
      "Dog.id/name",
      "RaceVideo.id/raceId/streamUrl/sourceStatus",
      "bounded distinct Track.state metadata",
      "bounded pg_class table estimates and aggregate summary counts",
    ],
    columnsWritten: [],
    boundParameters: [
      "normalized q (trimmed, whitespace collapsed, max 80 characters)",
      "normalized date",
      "allowlisted state",
      "allowlisted status",
      "allowlisted sort",
      "race-day gte/lt",
      "RACE_SEARCH_RESULT_LIMIT=120",
      "RACE_SEARCH_DOG_MATCH_LIMIT=80",
      "RACE_SEARCH_RUNNER_RESULT_LIMIT=48",
      "RACE_EXPLORER_STATE_LIMIT=16",
      "RACE_EXPLORER_MEETING_LIMIT=128",
      "RACE_EXPLORER_RACE_LIMIT=2048",
      "RACE_EXPLORER_REPLAY_LIMIT=8",
    ],
    parameterized: true,
    visibilityPredicate:
      "Only public racing reference rows matching the normalized date/state/status/search filters are returned.",
    rowLevelSecurityPolicies: [
      "giq_track_read",
      "giq_meeting_read",
      "giq_race_read",
      "giq_runner_read",
      "giq_result_read",
      "giq_dog_read",
      "giq_dog_form_read",
      "giq_race_video_read",
    ],
    expectedRowCount:
      "A conservative 7,053-row materialization ceiling covers 116 metadata rows, all mutually exclusive ranked-search fallbacks summed to 536 rows, the 6,400-row meeting/race/runner-count/video bundle and one search-result summary row.",
    maximumRowCount: 7_053,
    paginationRequired: false,
    transactionBoundary:
      "One withDbAnonymousQueryDeadline interactive transaction covers the public race-search reads; cached metadata may avoid individual statements.",
    isolationLevel:
      "PostgreSQL read committed in one anonymous request transaction; cross-statement repeatable-read consistency is not claimed.",
    concurrencyControl:
      "Read-only search; one-minute metadata caches and the default-view cache reduce repeated work, while filtered searches bypass the default-view cache.",
    indexesExpected: [
      "Race_raceTime_idx",
      "Race_meetingId_idx",
      "Track_state_idx",
      "Runner_raceId_idx",
      "Runner_dogId_idx",
      "RaceVideo_raceId_idx",
      "Dog_name_idx",
    ],
    constraintsReliedOn: [
      "Race_pkey",
      "Meeting_pkey",
      "Track_pkey",
      "Runner_pkey",
      "Dog_pkey",
    ],
    triggersInvoked: [],
    timeoutMilliseconds: 30_000,
    explainPlanEvidence:
      "output/database-audit/race-search-read.json schema v1 contains sanitized PostgreSQL JSON cost plans for all 31 exact generated SELECT/CTE variants with ANALYZE and BUFFERS disabled and a 5 s EXPLAIN statement timeout.",
    sensitiveColumns: [],
    returnedDataShape:
      "Normalized filters, summary counts, recent dates, RaceExplorerMeeting[] and at most eight replay cards.",
    notFoundBehaviour: "No matches return empty meetings and render the explicit no-racecards state.",
    unauthorizedBehaviour: "The route is a public reference-data read; no private fields are intended in its projection.",
    conflictBehaviour: "Not applicable to read.",
    failureBehaviour:
      "PostgreSQL cancels any statement after ten seconds and Prisma aborts the read bundle after thirty seconds. Production safeQuery fails closed; development fallbacks may degrade metadata stages to empty or zero values.",
    tests: [
      "scripts/check-race-search-postgres.test.ts",
      "security/mandatory-public-racing-trace-evidence.test.ts",
      "src/lib/queries.test.ts",
    ],
    evidence: [
      "Source inspection and regression tests prove q normalization to 80 characters, 120/80/48 ranked-ID caps, 128/2048 meeting/race caps, a SQL-enforced 16-state cap and an eight-race presentation-only replay projection.",
      "output/database-audit/race-search-read.json schema v1 is source-bound to the query service, page, database context/statistics helpers, RLS migration, verifier/test and this registry record. As login-capable, non-superuser, non-BYPASSRLS greyhoundiq_runtime on literal-loopback port 55734 it exercises default/date, global-dog, date-field and complete miss fallback paths, captures 31 exact SQL variants and sanitized plans, anonymously replays every statement, excludes raw-provider canaries, preserves all seven fixture rows through reads and performs exact cleanup without provider contact.",
      "The first disposable run showed Prisma distinct+take did not emit SQL LIMIT; production now uses grouped Track.state SQL with LIMIT 16, and the regenerated plan proves a Limit node. Deployed parity, route abuse limiting, representative-volume latency and partial-degradation telemetry remain separate gates.",
      "src/lib/queries.ts executes fetchRaceExplorerData and its transaction-client helpers through withDbAnonymousQueryDeadline; src/lib/db-context.ts applies a parameterized 10 s PostgreSQL statement_timeout inside a 30 s Prisma transaction.",
    ],
    verificationStatus: "Verified",
  },
  {
    queryId: "DB.RACING.RACE.OPEN.DETAIL_BUNDLE",
    traceId: "RACING.RACE.OPEN",
    sourceFile: "src/lib/queries.ts",
    sourceSymbol: "getRaceById + getPreviousRaceVideoRunners",
    ormOrDriver: "Prisma and parameterized Prisma $queryRaw templates",
    ormOperation:
      "exact-projection race detail reads, per-dog LATERAL form reads, bounded previous-runner lookup and per-race LATERAL replay reads",
    normalizedSql:
      'SELECT "public"."Race"."id", "public"."Race"."raceNumber", "public"."Race"."name", "public"."Race"."raceTime", "public"."Race"."distance", "public"."Race"."grade", "public"."Race"."prizeMoney", "public"."Race"."resultStatus", "public"."Race"."replayUrl", "public"."Race"."sourceProvider", "public"."Race"."sourceId", "public"."Race"."meetingId" FROM "public"."Race" WHERE ("public"."Race"."id" = $1 AND 1=1) LIMIT $2 OFFSET $3',
    databaseRole: "greyhoundiq_runtime",
    databaseName: "greyhoundiq",
    schemaName: "public",
    operationType: "select",
    tables: [
      "Race",
      "Meeting",
      "Track",
      "Runner",
      "Dog",
      "Trainer",
      "Result",
      "FormEntry",
      "DogProfileForm",
      "RaceVideo",
    ],
    views: [],
    columnsRead: [
      "Race detail and replay provenance fields",
      "Meeting and Track identity fields",
      "Runner box/weight/scratched fields",
      "Dog identity, trainer, recent form and profile-form fields",
      "Result finishing and timing fields",
      "RaceVideo provider/page/stream/status/title fields",
    ],
    columnsWritten: [],
    boundParameters: [
      "route race id",
      "route race id exclusion",
      "loaded runner dog IDs (at most 12)",
      "previous race time",
      "current runner limit=12",
      "meeting-race limit=24",
      "per-dog form limit=6",
      "per-dog video-form limit=8",
      "per-race video limit=16",
      "previous-runner limit=24",
    ],
    parameterized: true,
    visibilityPredicate: "The route selects public racing reference data for one race identifier.",
    rowLevelSecurityPolicies: [
      "giq_race_read",
      "giq_meeting_read",
      "giq_track_read",
      "giq_runner_read",
      "giq_dog_read",
      "giq_result_read",
      "giq_form_entry_read",
      "giq_dog_form_read",
      "giq_race_video_read",
    ],
    expectedRowCount:
      "Zero or one current race. The conservative 812-row materialization ceiling covers 271 current-detail rows and 541 seed/candidate/previous-video rows while preserving every per-parent source bound.",
    maximumRowCount: 812,
    paginationRequired: false,
    transactionBoundary:
      "getRaceById and getPreviousRaceVideoRunners each run in a withDbAnonymousQueryDeadline interactive transaction; page-level parallel calls remain separate transactions.",
    isolationLevel:
      "PostgreSQL read committed within each anonymous read transaction; cross-call snapshot consistency is not claimed.",
    concurrencyControl:
      "Read-only React-cache wrapped detail query; metadata and page calls are deduplicated within a render, and relation fan-out is capped before parallel form reads. The public feed tolerates read-committed changes between the base and bounded child queries.",
    indexesExpected: [
      "Race_pkey",
      "Runner_raceId_idx",
      "Runner_dogId_idx",
      "RaceVideo_raceId_idx",
      "FormEntry_dogId_idx",
      "DogProfileForm_dogId_idx",
    ],
    constraintsReliedOn: [
      "Race_pkey",
      "Runner_raceId_fkey",
      "Runner_dogId_fkey",
      "Result_runnerId_fkey",
      "RaceVideo_raceId_fkey",
    ],
    triggersInvoked: [],
    timeoutMilliseconds: 30_000,
    explainPlanEvidence:
      "output/database-audit/race-detail-read.json schema v1 contains sanitized PostgreSQL JSON cost plans for all 20 exact generated SELECT variants with ANALYZE and BUFFERS disabled and a 5 s EXPLAIN statement timeout.",
    sensitiveColumns: [],
    returnedDataShape: "Race detail, ordered runners/results, replay metadata and previous replay candidates.",
    notFoundBehaviour: "A null current race invokes Next notFound().",
    unauthorizedBehaviour: "The route is a public reference-data read; private account rows are not selected.",
    conflictBehaviour: "Not applicable to read.",
    failureBehaviour: "PostgreSQL cancels any statement after ten seconds and Prisma aborts each race-detail read bundle after thirty seconds. Production safeQuery fails closed; development may render not-found or omit previous replay candidates.",
    tests: [
      "scripts/check-race-detail-postgres.test.ts",
      "security/mandatory-public-racing-trace-evidence.test.ts",
      "src/components/screen-contracts/production-screen-public-racing-interactions.test.ts",
    ],
    evidence: [
      "Source inspection binds the dynamic id through getRaceById/notFound, exact public projections, 12 current runners, 24 meeting races, six form rows and eight video-form rows per dog, 16 videos per race and 24 previous runner candidates.",
      "output/database-audit/race-detail-read.json schema v1 is source-bound to the query service, route, runner component, database context, RLS migration, verifier/test and this registry record. As login-capable, non-superuser, non-BYPASSRLS greyhoundiq_runtime on literal-loopback port 55734 it captures 20 exact SQL variants and sanitized plans, anonymously replays every statement, excludes provider-raw/account canaries, preserves all 19 fixture rows through populated and not-found reads and performs exact cleanup without provider contact.",
      "The first disposable run proved Prisma's nested per-dog take did not emit SQL LIMIT. Production now uses parameterized per-dog and per-race LATERAL subqueries whose generated SQL carries the six/eight/sixteen-row limits. Deployed parity, representative-volume latency and replay-provider telemetry remain separate gates.",
      "src/lib/queries.ts executes getRaceById and getPreviousRaceVideoRunners through withDbAnonymousQueryDeadline using only the transaction client for database work; src/lib/db-context.ts applies a parameterized 10 s PostgreSQL statement_timeout inside a 30 s Prisma transaction.",
    ],
    verificationStatus: "Verified",
  },
  {
    queryId: "DB.RACING.DOG.OPEN.PUBLIC_DETAIL_BUNDLE",
    traceId: "RACING.DOG.OPEN",
    sourceFile: "src/lib/queries.ts",
    sourceSymbol: "getDogById plus src/lib/pedigree.ts#getDogPedigree",
    ormOrDriver: "Prisma",
    ormOperation:
      "dog.findUnique explicit detail projection, bounded form aggregates, and bounded breadth-first dog pedigree reads",
    normalizedSql:
      'SELECT "public"."Dog"."id", "public"."Dog"."name", "public"."Dog"."earBrand", "public"."Dog"."colour", "public"."Dog"."sex", "public"."Dog"."whelpDate", "public"."Dog"."prizeMoney", "public"."Dog"."trainerId", "public"."Dog"."sireId", "public"."Dog"."damId" FROM "public"."Dog" WHERE ("public"."Dog"."id" = $1 AND 1=1) LIMIT $2 OFFSET $3',
    normalizedSqlVariants: [
      capturedDogDetailSelect(
        "detail-01",
        'SELECT "public"."Dog"."id", "public"."Dog"."name" FROM "public"."Dog" WHERE "public"."Dog"."id" IN ($1) OFFSET $2',
        2,
      ),
      capturedDogDetailSelect(
        "detail-02",
        'SELECT "public"."Dog"."id", "public"."Dog"."name", "public"."Dog"."earBrand", "public"."Dog"."colour", "public"."Dog"."sex", "public"."Dog"."whelpDate", "public"."Dog"."prizeMoney", "public"."Dog"."trainerId", "public"."Dog"."sireId", "public"."Dog"."damId" FROM "public"."Dog" WHERE ("public"."Dog"."id" = $1 AND 1=1) LIMIT $2 OFFSET $3',
        3,
      ),
      capturedDogDetailSelect(
        "detail-03",
        'SELECT "public"."DogOwnership"."id", "public"."DogOwnership"."role", "public"."DogOwnership"."status", "public"."DogOwnership"."profileId", "public"."DogOwnership"."dogId" FROM "public"."DogOwnership" WHERE ("public"."DogOwnership"."status" = $1 AND "public"."DogOwnership"."dogId" IN ($2)) ORDER BY "public"."DogOwnership"."verified" DESC, "public"."DogOwnership"."createdAt" DESC LIMIT $3 OFFSET $4',
        4,
      ),
      capturedDogDetailSelect(
        "detail-04",
        'SELECT "public"."DogProfileForm"."id", "public"."DogProfileForm"."sourceProvider", "public"."DogProfileForm"."raceUrl", "public"."DogProfileForm"."date", "public"."DogProfileForm"."trackCode", "public"."DogProfileForm"."trackName", "public"."DogProfileForm"."finishingPosition", "public"."DogProfileForm"."boxNumber", "public"."DogProfileForm"."weight", "public"."DogProfileForm"."distance", "public"."DogProfileForm"."grade", "public"."DogProfileForm"."runningTime", "public"."DogProfileForm"."firstSectional", "public"."DogProfileForm"."margin", "public"."DogProfileForm"."winnerDogName", "public"."DogProfileForm"."hasVideo", "public"."DogProfileForm"."dogId" FROM "public"."DogProfileForm" WHERE "public"."DogProfileForm"."dogId" IN ($1) ORDER BY "public"."DogProfileForm"."date" DESC LIMIT $2 OFFSET $3',
        3,
      ),
      capturedDogDetailSelect(
        "detail-05",
        'SELECT "public"."FormEntry"."id", "public"."FormEntry"."raceId", "public"."FormEntry"."date", "public"."FormEntry"."boxNumber", "public"."FormEntry"."finish", "public"."FormEntry"."time", "public"."FormEntry"."distance", "public"."FormEntry"."grade", "public"."FormEntry"."weight", "public"."FormEntry"."trackId", "public"."FormEntry"."dogId" FROM "public"."FormEntry" WHERE "public"."FormEntry"."dogId" IN ($1) ORDER BY "public"."FormEntry"."date" DESC LIMIT $2 OFFSET $3',
        3,
      ),
      capturedDogDetailSelect(
        "detail-06",
        'SELECT "public"."Meeting"."id", "public"."Meeting"."trackId" FROM "public"."Meeting" WHERE "public"."Meeting"."id" IN ($1) OFFSET $2',
        2,
      ),
      capturedDogDetailSelect(
        "detail-07",
        'SELECT "public"."Profile"."id", "public"."Profile"."displayName", "public"."Profile"."kennelName", "public"."Profile"."state" FROM "public"."Profile" WHERE "public"."Profile"."id" IN ($1) OFFSET $2',
        2,
      ),
      capturedDogDetailSelect(
        "detail-08",
        'SELECT "public"."Race"."id", "public"."Race"."raceTime", "public"."Race"."distance", "public"."Race"."grade", "public"."Race"."replayUrl", "public"."Race"."meetingId" FROM "public"."Race" WHERE "public"."Race"."id" IN ($1) OFFSET $2',
        2,
      ),
      capturedDogDetailSelect(
        "detail-09",
        'SELECT "public"."Result"."id", "public"."Result"."finishingPosition", "public"."Result"."runningTime", "public"."Result"."splitTime", "public"."Result"."margin", "public"."Result"."runnerId" FROM "public"."Result" WHERE "public"."Result"."runnerId" IN ($1) OFFSET $2',
        2,
      ),
      capturedDogDetailSelect(
        "detail-10",
        'SELECT "public"."Runner"."id", "public"."Runner"."boxNumber", "public"."Runner"."weight", "public"."Runner"."raceId", "public"."Runner"."dogId" FROM "public"."Runner" WHERE "public"."Runner"."dogId" IN ($1) ORDER BY "public"."Runner"."createdAt" DESC LIMIT $2 OFFSET $3',
        3,
      ),
      capturedDogDetailSelect(
        "detail-11",
        'SELECT "public"."Track"."id", "public"."Track"."name" FROM "public"."Track" WHERE "public"."Track"."id" IN ($1) OFFSET $2',
        2,
      ),
      capturedDogDetailSelect(
        "detail-12",
        'SELECT "public"."Trainer"."id", "public"."Trainer"."name" FROM "public"."Trainer" WHERE "public"."Trainer"."id" IN ($1) OFFSET $2',
        2,
      ),
      capturedDogDetailSelect(
        "detail-13",
        'SELECT COUNT(*) AS "_count$_all" FROM (SELECT "public"."FormEntry"."id" FROM "public"."FormEntry" WHERE "public"."FormEntry"."dogId" = $1 OFFSET $2) AS "sub"',
        2,
      ),
      capturedDogDetailSelect(
        "detail-14",
        'SELECT COUNT(*) AS "_count$_all", "public"."FormEntry"."finish" FROM "public"."FormEntry" WHERE ("public"."FormEntry"."dogId" = $1 AND "public"."FormEntry"."finish" IN ($2,$3,$4)) GROUP BY "public"."FormEntry"."finish" ORDER BY "public"."FormEntry"."finish" ASC LIMIT $5 OFFSET $6',
        6,
      ),
      capturedDogDetailSelect(
        "pedigree-01",
        'SELECT "public"."Dog"."id", "public"."Dog"."name", "public"."Dog"."sex", "public"."Dog"."colour", "public"."Dog"."whelpDate", "public"."Dog"."sireId", "public"."Dog"."damId" FROM "public"."Dog" WHERE "public"."Dog"."id" IN ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32) ORDER BY "public"."Dog"."id" ASC LIMIT $33 OFFSET $34',
        34,
      ),
      capturedDogDetailSelect(
        "pedigree-02",
        'SELECT "public"."Dog"."id", "public"."Dog"."name", "public"."Dog"."sex", "public"."Dog"."colour", "public"."Dog"."whelpDate", "public"."Dog"."sireId", "public"."Dog"."damId" FROM "public"."Dog" WHERE "public"."Dog"."id" IN ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ORDER BY "public"."Dog"."id" ASC LIMIT $17 OFFSET $18',
        18,
      ),
      capturedDogDetailSelect(
        "pedigree-03",
        'SELECT "public"."Dog"."id", "public"."Dog"."name", "public"."Dog"."sex", "public"."Dog"."colour", "public"."Dog"."whelpDate", "public"."Dog"."sireId", "public"."Dog"."damId" FROM "public"."Dog" WHERE "public"."Dog"."id" IN ($1,$2,$3,$4,$5,$6,$7,$8) ORDER BY "public"."Dog"."id" ASC LIMIT $9 OFFSET $10',
        10,
      ),
      capturedDogDetailSelect(
        "pedigree-04",
        'SELECT "public"."Dog"."id", "public"."Dog"."name", "public"."Dog"."sex", "public"."Dog"."colour", "public"."Dog"."whelpDate", "public"."Dog"."sireId", "public"."Dog"."damId" FROM "public"."Dog" WHERE "public"."Dog"."id" IN ($1,$2,$3,$4) ORDER BY "public"."Dog"."id" ASC LIMIT $5 OFFSET $6',
        6,
      ),
      capturedDogDetailSelect(
        "pedigree-05",
        'SELECT "public"."Dog"."id", "public"."Dog"."name", "public"."Dog"."sex", "public"."Dog"."colour", "public"."Dog"."whelpDate", "public"."Dog"."sireId", "public"."Dog"."damId" FROM "public"."Dog" WHERE "public"."Dog"."id" IN ($1,$2) ORDER BY "public"."Dog"."id" ASC LIMIT $3 OFFSET $4',
        4,
      ),
      capturedDogDetailSelect(
        "pedigree-06",
        'SELECT "public"."Dog"."id", "public"."Dog"."name", "public"."Dog"."sex", "public"."Dog"."colour", "public"."Dog"."whelpDate", "public"."Dog"."sireId", "public"."Dog"."damId" FROM "public"."Dog" WHERE ("public"."Dog"."id" = $1 AND 1=1) LIMIT $2 OFFSET $3',
        3,
      ),
      capturedDogDetailSelect(
        "pedigree-07",
        'SELECT "public"."Dog"."id", "public"."Dog"."name", "public"."Dog"."sex", "public"."Dog"."colour", "public"."Dog"."whelpDate", "public"."Dog"."sireId", "public"."Dog"."damId" FROM "public"."Dog" WHERE ("public"."Dog"."sourceProvider" = $1 AND "public"."Dog"."name" ILIKE $2 AND ("public"."Dog"."sireId" IS NOT NULL OR "public"."Dog"."damId" IS NOT NULL)) ORDER BY "public"."Dog"."id" ASC LIMIT $3 OFFSET $4',
        4,
      ),
    ],
    databaseRole: "greyhoundiq_runtime",
    databaseName: "greyhoundiq",
    schemaName: "public",
    operationType: "select",
    tables: [
      "Dog",
      "Trainer",
      "FormEntry",
      "Track",
      "DogProfileForm",
      "Runner",
      "Race",
      "Meeting",
      "Result",
      "DogOwnership",
      "Profile",
    ],
    views: [],
    columnsRead: [
      "Dog id/name/earBrand/colour/sex/whelpDate/prizeMoney and pedigree linkage",
      "Trainer.name",
      "bounded FormEntry presentation fields and Track.name",
      "bounded DogProfileForm presentation/replay fields",
      "bounded Runner/Race/Meeting/Result presentation fields",
      "approved DogOwnership id/role/status and relation keys",
      "Profile displayName/kennelName/state",
      "bounded FormEntry count and finish-group aggregates",
    ],
    columnsWritten: [],
    boundParameters: [
      "route dog id",
      "approved ownership status",
      "64/20/20/16 relation limits",
      "aggregate finish positions 1/2/3 and group cap 3",
      "pedigree generations clamped to 0..5",
      "pedigree frontier dog IDs",
      "galtd source/name and twin cap 8 when bridging",
    ],
    parameterized: true,
    visibilityPredicate:
      "Public dog/racing rows plus an explicit status=approved ownership predicate; claimant-only ownership state is loaded separately under request context.",
    rowLevelSecurityPolicies: [
      "giq_dog_read",
      "giq_dog_form_read",
      "giq_runner_read",
      "giq_race_read",
      "giq_meeting_read",
      "giq_track_read",
      "giq_result_read",
      "giq_form_entry_read",
      "giq_dog_ownership_select",
      "giq_profile_select",
      "giq_trainer_read",
    ],
    expectedRowCount:
      "Zero or one root dog; detail relations are capped at 64 form entries, 20 profile forms, 20 runners and 16 approved owners; aggregates return at most one count plus three finish groups; pedigree is clamped to five generations with at most eight galtd twin candidates.",
    maximumRowCount: 359,
    paginationRequired: false,
    concurrencyControl:
      "Read-only React-cache wrapped detail and pedigree queries execute in parallel at the page boundary; every materialized relation and pedigree frontier is source-bounded.",
    indexesExpected: [
      "Dog_pkey",
      "Dog_sireId_idx",
      "Dog_damId_idx",
      "FormEntry_dogId_idx",
      "DogProfileForm_dogId_idx",
      "Runner_dogId_idx",
      "DogOwnership_dogId_profileId_key",
    ],
    constraintsReliedOn: [
      "Dog_pkey",
      "Dog_sireId_fkey",
      "Dog_damId_fkey",
      "Runner_dogId_fkey",
      "DogOwnership_dogId_profileId_key",
    ],
    triggersInvoked: [],
    timeoutMilliseconds: 5_000,
    explainPlanEvidence:
      "Twenty-one exact generated SELECT variants were replayed anonymously and captured with sanitized PostgreSQL JSON cost plans on disposable loopback PostgreSQL as greyhoundiq_runtime; ANALYZE and BUFFERS were disabled.",
    sensitiveColumns: [
      "DogOwnership.profileId (internal relation key; not returned in the presentation shape)",
    ],
    returnedDataShape: "Dog profile, form, pedigree, racing history and approved ownership presentation data.",
    notFoundBehaviour: "A null root dog invokes Next notFound().",
    unauthorizedBehaviour:
      "Public RLS permits racing rows and only approved ownership rows; own pending/rejected state requires the separate request-context query.",
    conflictBehaviour: "Not applicable to read.",
    failureBehaviour: "safeQuery returns null, causing not-found, or returns no pedigree for an unavailable pedigree graph.",
    tests: [
      "scripts/check-dog-public-detail-postgres.test.ts",
      "security/mandatory-public-racing-trace-evidence.test.ts",
      "src/components/screen-contracts/production-screen-public-racing-interactions.test.ts",
    ],
    evidence: [
      "output/database-audit/dog-public-detail.json is source-bound to the query, pedigree service, page, RLS migrations, verifier/test and this registry record.",
      "Disposable loopback proof as non-superuser greyhoundiq_runtime captured 21 exact SQL variants and sanitized non-ANALYZE cost plans, replayed every statement anonymously, and returned only the approved ownership row to both anonymous and unrelated pending-claimant contexts.",
      "The proof exercised the populated, missing and galtd-bridge pedigree paths, clamped a 999-generation request to five, preserved all 81 fixture rows through reads, and deleted exactly 65 dogs plus 16 related fixture rows without provider contact.",
      "Representative production volume, deployed-role parity, page overload controls and sustained-load p99 remain separate production gates.",
    ],
    verificationStatus: "Verified",
  },
  {
    queryId: "DB.RACING.DOG.OPEN.OWNERSHIP.SELECT",
    traceId: "RACING.DOG.OPEN",
    sourceFile: "src/lib/queries.ts",
    sourceSymbol: "getMyDogOwnership",
    ormOrDriver: "Prisma",
    ormOperation: "withDbRequestContext dogOwnership.findUnique",
    normalizedSql:
      'SELECT "public"."DogOwnership"."id", "public"."DogOwnership"."role", "public"."DogOwnership"."status", "public"."DogOwnership"."rejectionReason" FROM "public"."DogOwnership" WHERE (("public"."DogOwnership"."dogId" = $1 AND "public"."DogOwnership"."profileId" = $2) AND 1=1) LIMIT $3 OFFSET $4',
    databaseRole: "greyhoundiq_runtime",
    databaseName: "greyhoundiq",
    schemaName: "public",
    operationType: "select",
    tables: ["DogOwnership"],
    views: [],
    columnsRead: ["id", "role", "status", "rejectionReason"],
    columnsWritten: [],
    boundParameters: [
      "route dog id ($1)",
      "current.profileId ($2)",
      "Prisma take=1 ($3)",
      "Prisma offset=0 ($4)",
    ],
    parameterized: true,
    ownershipPredicate: "dogId = :dogId AND profileId = current.profileId",
    visibilityPredicate: "The current claimant may read their own row at any status.",
    rowLevelSecurityPolicies: ["giq_dog_ownership_select"],
    expectedRowCount: "Zero or one compound-key ownership row.",
    maximumRowCount: 1,
    paginationRequired: false,
    transactionBoundary: "withDbRequestContext Prisma transaction",
    isolationLevel:
      "PostgreSQL default inside the withDbRequestContext transaction; the service does not override it.",
    locks: [],
    concurrencyControl: "Read-only compound unique lookup.",
    indexesExpected: [
      "DogOwnership_dogId_profileId_key",
      "DogOwnership_profileId_status_createdAt_idx",
    ],
    constraintsReliedOn: ["DogOwnership_dogId_profileId_key"],
    triggersInvoked: [],
    timeoutMilliseconds: 30_000,
    explainPlanEvidence:
      "output/database-audit/demo-fixture-idempotency.json: sanitized PostgreSQL JSON COSTS Limit -> Index Scan on DogOwnership_profileId_status_createdAt_idx; ANALYZE and BUFFERS disabled with a 5 s EXPLAIN statement timeout.",
    sensitiveColumns: ["profileId", "status", "rejectionReason"],
    returnedDataShape: "Current claimant ownership status projection only.",
    notFoundBehaviour: "Null means the current profile has no ownership claim.",
    unauthorizedBehaviour: "The page does not call this query without a complete current user/profile context; RLS rechecks profile ownership.",
    conflictBehaviour: "Not applicable to read.",
    failureBehaviour: "safeQuery returns null and the page withholds claimant-only state.",
    tests: [
      "security/mandatory-public-racing-trace-evidence.test.ts",
      "scripts/check-rls-policies.ts",
      "scripts/check-demo-route-fixture-idempotency.ts",
      "scripts/check-demo-route-fixture-evidence.test.ts",
    ],
    evidence: [
      "output/database-audit/demo-fixture-idempotency.json captures the real getMyDogOwnership SQL under login-capable greyhoundiq_runtime with superuser=false and bypassRls=false.",
      "The disposable proof returns only id/role/status/rejectionReason for the claimant's rejected row, returns null for another profile and a missing dog, and repeats without mutation or SQL-shape drift.",
      "Exact captured-SQL replay returns zero rows under another profile and anonymous context, one under system context, and cleanup removes the exact rejected-claim probe. This is local disposable evidence only; deployed role and catalog parity remain separate gates.",
    ],
    verificationStatus: "Verified",
  },
  {
    queryId: "DB.RACING.TRACK.OPEN.DETAIL_BUNDLE",
    traceId: "RACING.TRACK.OPEN",
    sourceFile: "src/lib/queries.ts",
    sourceSymbol: "getTrackById",
    ormOrDriver: "Prisma parameterized reads",
    ormOperation:
      "one track.findUnique followed by explicitly bounded meeting, race and runner reads; runner relations load bounded dog and result IDs",
    normalizedSql:
      'SELECT "public"."Track"."id", "public"."Track"."name", "public"."Track"."state", "public"."Track"."surface", "public"."Track"."circumference", "public"."Track"."straightLength", "public"."Track"."boxCount", "public"."Track"."hasIsolynx", "public"."Track"."createdAt" FROM "public"."Track" WHERE ("public"."Track"."id" = $1 AND 1=1) LIMIT $2 OFFSET $3',
    normalizedSqlVariants: [
      {
        variant: "track",
        normalizedSql:
          'SELECT "public"."Track"."id", "public"."Track"."name", "public"."Track"."state", "public"."Track"."surface", "public"."Track"."circumference", "public"."Track"."straightLength", "public"."Track"."boxCount", "public"."Track"."hasIsolynx", "public"."Track"."createdAt" FROM "public"."Track" WHERE ("public"."Track"."id" = $1 AND 1=1) LIMIT $2 OFFSET $3',
        boundParameters: [
          "route track id ($1)",
          "Prisma take=1 ($2)",
          "Prisma skip=0 ($3)",
        ],
        explainPlanEvidence:
          "Schema-v16 disposable proof: Limit -> Seq Scan on the one-row Track fixture; plan SHA-256 6dbe41d0787a1b1a52829a3a163ca5c75b6aadefa2084644ff43060b2a5d41f4.",
      },
      {
        variant: "meetings",
        normalizedSql:
          'SELECT "public"."Meeting"."id", "public"."Meeting"."trackId", "public"."Meeting"."meetingDate", "public"."Meeting"."meetingType", "public"."Meeting"."sourceProvider", "public"."Meeting"."sourceId", "public"."Meeting"."sourceRawJson", "public"."Meeting"."lastSyncedAt", "public"."Meeting"."createdAt" FROM "public"."Meeting" WHERE "public"."Meeting"."trackId" = $1 ORDER BY "public"."Meeting"."meetingDate" DESC, "public"."Meeting"."id" ASC LIMIT $2 OFFSET $3',
        boundParameters: [
          "route track id ($1)",
          "meeting limit=8 ($2)",
          "Prisma skip=0 ($3)",
        ],
        explainPlanEvidence:
          "Schema-v16 disposable proof: Limit -> Sort -> Seq Scan on the one-row Meeting fixture; plan SHA-256 6a4e2aad16bead4fcf2a8fda713ac9898025d1920b1642730121193fb672a449.",
      },
      {
        variant: "races",
        normalizedSql:
          'SELECT "public"."Race"."id", "public"."Race"."meetingId", "public"."Race"."raceNumber", "public"."Race"."name", "public"."Race"."raceTime", "public"."Race"."distance", "public"."Race"."grade", "public"."Race"."prizeMoney", "public"."Race"."resultStatus", "public"."Race"."replayUrl", "public"."Race"."photoFinishUrl", "public"."Race"."sourceProvider", "public"."Race"."sourceId", "public"."Race"."sourceRawJson", "public"."Race"."lastSyncedAt", "public"."Race"."createdAt" FROM "public"."Race" WHERE "public"."Race"."meetingId" IN ($1) ORDER BY "public"."Race"."meetingId" ASC, "public"."Race"."raceNumber" ASC, "public"."Race"."id" ASC LIMIT $2 OFFSET $3',
        boundParameters: [
          "loaded meeting ID ($1)",
          "global race query limit=128 ($2)",
          "Prisma skip=0 ($3)",
        ],
        explainPlanEvidence:
          "Schema-v16 disposable proof: Limit -> Sort -> Seq Scan on the two-row racing probe; plan SHA-256 bd05f65701db6c8d1e37df96bca985c4e54c9af8b350a02a1e766438e6d9f0fe.",
      },
      {
        variant: "runners",
        normalizedSql:
          'SELECT "public"."Runner"."id", "public"."Runner"."raceId", "public"."Runner"."dogId", "public"."Runner"."boxNumber", "public"."Runner"."weight", "public"."Runner"."trainerId", "public"."Runner"."startingPrice", "public"."Runner"."scratched", "public"."Runner"."sourceProvider", "public"."Runner"."sourceId", "public"."Runner"."sourceRawJson", "public"."Runner"."createdAt" FROM "public"."Runner" WHERE "public"."Runner"."raceId" IN ($1,$2) ORDER BY "public"."Runner"."raceId" ASC, "public"."Runner"."boxNumber" ASC, "public"."Runner"."id" ASC LIMIT $3 OFFSET $4',
        boundParameters: [
          "loaded race IDs ($1, $2)",
          "global runner query limit=1536 ($3)",
          "Prisma skip=0 ($4)",
        ],
        explainPlanEvidence:
          "Schema-v16 disposable proof: Limit -> Sort -> Seq Scan on the two-row runner probe; plan SHA-256 d7f3900feac1b1549e7cc048420b81be9f5e4db4e45377e203a81866b50da177.",
      },
      {
        variant: "dogs",
        normalizedSql:
          'SELECT "public"."Dog"."id", "public"."Dog"."name", "public"."Dog"."earBrand", "public"."Dog"."colour", "public"."Dog"."sex", "public"."Dog"."whelpDate", "public"."Dog"."sireId", "public"."Dog"."damId", "public"."Dog"."trainerId", "public"."Dog"."sourceProvider", "public"."Dog"."sourceId", "public"."Dog"."profileUrl", "public"."Dog"."ownerName", "public"."Dog"."careerStarts", "public"."Dog"."careerWins", "public"."Dog"."careerSeconds", "public"."Dog"."careerThirds", "public"."Dog"."prizeMoney", "public"."Dog"."winPercentage", "public"."Dog"."placePercentage", "public"."Dog"."profileStatsJson", "public"."Dog"."bestTimesJson", "public"."Dog"."boxHistoryJson", "public"."Dog"."distanceHistoryJson", "public"."Dog"."profileSourceRawJson", "public"."Dog"."lastProfileSyncedAt", "public"."Dog"."retiredAt", "public"."Dog"."createdAt", "public"."Dog"."updatedAt" FROM "public"."Dog" WHERE "public"."Dog"."id" IN ($1) OFFSET $2',
        boundParameters: ["loaded dog IDs ($1)", "Prisma skip=0 ($2)"],
        explainPlanEvidence:
          "Schema-v16 disposable proofs observed either an Index Scan on Dog_pkey (fresh IPv6 replay plan SHA-256 d5d21a85b8436a49e00b3214a5e42a7e2a4d783518fe15f5652282aac35ca096) or a Seq Scan on the same one-row fixture (original plan SHA-256 3534b3791c3900f0c1994c65e6243b2e6969362e507495fd8d1a343ff2631053); the tiny-fixture planner choice is non-semantic.",
      },
      {
        variant: "results",
        normalizedSql:
          'SELECT "public"."Result"."id", "public"."Result"."runnerId", "public"."Result"."raceId", "public"."Result"."finishingPosition", "public"."Result"."runningTime", "public"."Result"."margin", "public"."Result"."prizeMoneyWon", "public"."Result"."splitTime", "public"."Result"."sectionals", "public"."Result"."gpsData", "public"."Result"."sourceProvider", "public"."Result"."sourceId", "public"."Result"."sourceRawJson", "public"."Result"."lastSyncedAt", "public"."Result"."createdAt" FROM "public"."Result" WHERE "public"."Result"."runnerId" IN ($1,$2) OFFSET $3',
        boundParameters: [
          "loaded runner IDs ($1, $2)",
          "Prisma skip=0 ($3)",
        ],
        explainPlanEvidence:
          "Schema-v16 disposable proof: Seq Scan on the two-row Result probe; plan SHA-256 1fc3da58f3bfe0ad4c64610a7e8f73fb64585684d4b4e85c25b90a273d281322.",
      },
    ],
    databaseRole: "greyhoundiq_runtime",
    databaseName: "greyhoundiq",
    schemaName: "public",
    operationType: "select",
    tables: ["Track", "Meeting", "Race", "Runner", "Dog", "Result"],
    views: [],
    columnsRead: [
      "Track profile fields",
      "Meeting recent date/provider fields",
      "Race identity/time/distance/grade fields",
      "Runner box/dog fields",
      "Dog identity fields",
      "Result finish/timing fields",
    ],
    columnsWritten: [],
    boundParameters: [
      "route track id ($1)",
      "Prisma take=1 ($2)",
      "Prisma skip=0 ($3)",
    ],
    parameterized: true,
    visibilityPredicate: "The route selects public racing reference data for one track identifier.",
    rowLevelSecurityPolicies: [
      "giq_track_read",
      "giq_meeting_read",
      "giq_race_read",
      "giq_runner_read",
      "giq_dog_read",
      "giq_result_read",
    ],
    expectedRowCount:
      "Per statement: zero/one Track; at most 8 Meetings, 128 Races and 1,536 Runners; returned composition additionally caps each meeting to 16 races and each race to 12 runners. Dog and Result relation reads are bounded by the loaded runner IDs.",
    maximumRowCount: 1_536,
    paginationRequired: false,
    concurrencyControl:
      "Read-only React-cache wrapper; deterministic ID ordering plus explicit global SQL limits bound every to-many database stage before per-parent composition.",
    indexesExpected: [
      "Track_pkey",
      "Meeting_trackId_idx",
      "Meeting_meetingDate_idx",
      "Race_meetingId_idx",
      "Runner_raceId_idx",
    ],
    constraintsReliedOn: [
      "Track_pkey",
      "Meeting_trackId_fkey",
      "Race_meetingId_fkey",
      "Runner_raceId_fkey",
      "Runner_dogId_fkey",
    ],
    triggersInvoked: [],
    timeoutMilliseconds: 30_000,
    explainPlanEvidence:
      "output/database-audit/demo-fixture-idempotency.json schema v16 proves six exact parameterized SELECT variants under anonymous context with ANALYZE/BUFFERS disabled and a 5 s EXPLAIN timeout. Primary Track plan root is Limit; SQL SHA-256 is 4a4c594564f2779cce03a0933a339a1612cf069c6070419ef1acb85008432b23 and plan SHA-256 is 6dbe41d0787a1b1a52829a3a163ca5c75b6aadefa2084644ff43060b2a5d41f4. Tiny-fixture sequential scans are not representative-volume index evidence.",
    sensitiveColumns: [],
    returnedDataShape: "Track profile with eight recent meetings, race rows, runners, dogs and results.",
    notFoundBehaviour: "A null track invokes Next notFound().",
    unauthorizedBehaviour: "The route is a public reference-data read; private account rows are not selected.",
    conflictBehaviour: "Not applicable to read.",
    failureBehaviour: "safeQuery returns null and the route renders not-found.",
    tests: [
      "security/mandatory-public-racing-trace-evidence.test.ts",
      "src/components/screen-contracts/production-screen-public-racing-interactions.test.ts",
      "scripts/check-demo-route-fixture-idempotency.test.ts",
      "scripts/check-demo-route-fixture-evidence.test.ts",
    ],
    evidence: [
      "output/database-audit/demo-fixture-idempotency.json schema v16 source-binds getTrackById and executes its full populated Track -> Meeting -> Race -> Runner -> Dog/Result graph using login-capable, non-superuser, non-BYPASSRLS greyhoundiq_runtime on literal loopback port 55734.",
      "The proof captures six exact normalized SQL shapes and sanitized cost plans, replays every statement under anonymous RLS with reviewed row counts [1,1,2,2,1,2], proves the missing-track one-query null path, and cleans the exact trainer/form/runner/result/video/previous-race probe graph. Global SQL caps are 8 meetings, 128 races and 1,536 runners; returned composition caps 16 races per meeting and 12 runners per race. Representative-volume plans, deployed parity and page-level load tests remain open.",
    ],
    verificationStatus: "Verified",
  },
  {
    queryId: "DB.RACING.PROVIDER.INGEST.TRANSACTION",
    traceId: "RACING.PROVIDER.INGEST",
    sourceFile: "src/lib/live/sync.ts",
    sourceSymbol: "syncLiveMeetings/upsertSystemMeetings",
    ormOrDriver: "Prisma transaction, CRUD methods and tagged SQL bulk upserts",
    ormOperation:
      "system-context transaction that normalizes and upserts provider Track, Meeting, Race, RaceVideo, Dog, Trainer, Runner, Result and FormEntry rows",
    normalizedSqlArtifact:
      "output/database-audit/live-provider-ingest.json",
    databaseRole: "greyhoundiq_runtime",
    databaseName: "greyhoundiq",
    schemaName: "public",
    operationType: "transaction",
    tables: [
      "Track",
      "Meeting",
      "Race",
      "RaceVideo",
      "Dog",
      "Trainer",
      "Runner",
      "Result",
      "FormEntry",
    ],
    views: [],
    columnsRead: [
      "provider and natural identity keys",
      "existing racing rows needed to resolve relations and merge corrections",
    ],
    columnsWritten: [
      "normalized public racing fields",
      "sourceProvider",
      "sourceId",
      "sourceRawJson",
      "lastSyncedAt",
    ],
    boundParameters: [
      "validated provider meeting graph",
      "server-selected provider identity",
      "server-generated IDs and timestamps",
      "tagged-SQL values in write chunks of at most 100 rows",
    ],
    parameterized: true,
    tenantPredicate: "Not tenant scoped; only the internal system context may mutate public racing reference data.",
    ownershipPredicate: "public.giq_is_system() must be true for every write policy.",
    visibilityPredicate: "Normalized racing rows become public-readable; raw payload fields are retained server-side and excluded from public projections.",
    rowLevelSecurityPolicies: [
      "giq_track_system_write",
      "giq_meeting_system_write",
      "giq_race_system_write",
      "giq_race_video_system_write",
      "giq_dog_system_write",
      "giq_trainer_system_write",
      "giq_runner_system_write",
      "giq_result_system_write",
      "giq_form_entry_system_write",
    ],
    expectedRowCount:
      "Provider-dependent and source-bounded; lookup chunks are at most 500 keys, total lookup sets at most 5,000 keys and tagged-SQL write chunks at most 100 rows.",
    maximumRowCount: 100,
    paginationRequired: false,
    transactionBoundary:
      "One Prisma transaction per fetched provider meeting batch with 30 s max wait and 240 s transaction timeout.",
    isolationLevel:
      "PostgreSQL default; the source transaction does not override isolation.",
    locks: ["scheduled-task advisory transaction lock for live-sync"],
    concurrencyControl:
      "executeScheduledTask rejects overlapping live-sync runs; unique/natural keys and ON CONFLICT upserts merge permitted replay.",
    indexesExpected: [
      "Meeting_trackId_meetingDate_key",
      "Race_meetingId_raceNumber_key",
      "Runner_raceId_boxNumber_key",
      "Result_runnerId_key",
      "Dog_sourceProvider_sourceId_key",
      "FormEntry_dogId_raceId_key",
      "RaceVideo_raceId_sourceProvider_kind_key",
    ],
    constraintsReliedOn: [
      "Meeting_trackId_fkey",
      "Race_meetingId_fkey",
      "Runner_raceId_fkey",
      "Runner_dogId_fkey",
      "Result_runnerId_fkey",
    ],
    triggersInvoked: [],
    timeoutMilliseconds: 240_000,
    sensitiveColumns: [
      "provider sourceRawJson fields (untrusted source archive; never a public output contract)",
    ],
    returnedDataShape:
      "Only aggregate meeting/race/runner/result counts and provider name return to the internal caller.",
    notFoundBehaviour:
      "Missing referenced rows are created from validated provider identities inside the transaction.",
    unauthorizedBehaviour:
      "The HTTP entry rejects missing/invalid internal credentials before provider or database work; RLS independently requires app.system=true for writes.",
    conflictBehaviour:
      "Natural and provider identity conflicts use deterministic upsert/merge rules; overlapping scheduled runs are skipped.",
    failureBehaviour:
      "The current provider batch transaction rolls back atomically and the route returns a safe error envelope; cross-batch atomicity and deployed retry behavior remain separate release evidence.",
    tests: [
      "security/mandatory-public-racing-trace-evidence.test.ts",
      "src/app/api/internal/live-sync/route.test.ts",
      "src/lib/live/provider-response-validation.test.ts",
      "security/scheduled-task-control-evidence.test.ts",
      "scripts/check-live-provider-ingest-postgres.test.ts",
    ],
    evidence: [
      "Source evidence traces POST /api/internal/live-sync through constant-time internal-secret comparison, bounded scope/days parsing, scheduled-task overlap control, provider response validation, provider stamping and the system-context upsert transaction.",
      "The source fixes lookup chunks at 500, lookup sets at 5,000, tagged-SQL write chunks at 100, transaction max-wait at 30 seconds and transaction timeout at 240 seconds.",
      "output/database-audit/live-provider-ingest.json schema v1 source-binds the actual syncLiveMeetings/upsertSystemMeetings path and proves a one-row synthetic graph across all nine tables as login-capable, non-superuser, non-BYPASSRLS greyhoundiq_runtime on literal loopback port 55734. It captures the three transaction-local system-context settings, all nine parameterized INSERT shapes, COMMIT, a late failure after Track/Meeting/Race writes, ROLLBACK, zero persisted rollback rows and exact cleanup without provider or other network access.",
      "The disposable PostgreSQL target is verification tooling only. Planned production remains the single Prisma + AlloyDB for PostgreSQL database; deployed parity, provider authenticity, scheduler/secret parity and representative-volume throughput remain release evidence rather than claims of this local proof.",
    ],
    verificationStatus: "Verified",
  },
] satisfies readonly DatabaseOperationContract[];
