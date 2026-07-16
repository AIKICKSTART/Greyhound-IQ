export const ENDPOINT_RESOURCE_DATABASE_EVIDENCE_FILE =
  "security/endpoint-resource-database-evidence.ts" as const;
export const ENDPOINT_RESOURCE_DATABASE_TEST_FILE =
  "security/endpoint-resource-database-evidence.test.ts" as const;

export const ENDPOINT_RESOURCE_DATABASE_EVIDENCE_SCOPE =
  "Provider-free source, unit, and source-bound disposable-loopback evidence for the shared resource and database controls used by GreyhoundIQ endpoints. The evidence exercises bounded collections, limiter denial, actor, object and trusted-IP limiter keys, export overflow, worker backpressure, provider deadlines, database predicates, forced RLS, runtime-role denials, constraints, affected-row outcomes, rollback, query deadlines, explicit projections, tombstone filters, cost-plan indexes, and migration-source compatibility. It does not claim production load testing, deployed-cloud verification, or endpoints and states outside these 31 exact requirements.";

export const ENDPOINT_RESOURCE_REQUIREMENT_IDS = [
  "security.endpoint-test-resource-abuse.pagination-maximum",
  "security.endpoint-test-resource-abuse.large-search",
  "security.endpoint-test-resource-abuse.high-cost-filter-combination",
  "security.endpoint-test-resource-abuse.repeated-submissions",
  "security.endpoint-test-resource-abuse.per-user-rate-limits",
  "security.endpoint-test-resource-abuse.per-object-rate-limits",
  "security.endpoint-test-resource-abuse.messaging-quotas",
  "security.endpoint-test-resource-abuse.export-quotas",
  "security.endpoint-test-resource-abuse.ai-cost-limits",
  "security.endpoint-test-resource-abuse.queue-backpressure",
  "security.endpoint-test-resource-abuse.provider-timeout",
  "security.endpoint-test-resource-abuse.database-timeout",
  "security.resource-control.per-user-rate-limit",
  "security.resource-control.per-ip-rate-limit-where-appropriate",
  "security.resource-control.per-object-rate-limit-where-appropriate",
  "security.abuse-control.actor-based-limits",
  "security.abuse-control.object-based-limits",
  "security.abuse-control.not-global-ip-only",
] as const;

export const ENDPOINT_DATABASE_REQUIREMENT_IDS = [
  "security.endpoint-test-database.tenant-predicate",
  "security.endpoint-test-database.ownership-predicate",
  "security.endpoint-test-database.row-level-security",
  "security.endpoint-test-database.database-role-privileges",
  "security.endpoint-test-database.constraint-enforcement",
  "security.endpoint-test-database.affected-row-checks",
  "security.endpoint-test-database.transaction-rollback",
  "security.endpoint-test-database.query-timeout",
  "security.endpoint-test-database.pagination-bound",
  "security.endpoint-test-database.sensitive-column-selection",
  "security.endpoint-test-database.deleted-record-filtering",
  "security.endpoint-test-database.index-use-for-critical-queries",
  "security.endpoint-test-database.migration-compatibility",
] as const;

export const ENDPOINT_RESOURCE_DATABASE_REQUIREMENT_IDS = [
  ...ENDPOINT_RESOURCE_REQUIREMENT_IDS,
  ...ENDPOINT_DATABASE_REQUIREMENT_IDS,
] as const;

export type EndpointResourceDatabaseRequirementId =
  (typeof ENDPOINT_RESOURCE_DATABASE_REQUIREMENT_IDS)[number];

type EndpointResourceDatabaseEvidenceRecord = Readonly<{
  status: "verified";
  evidence: readonly string[];
}>;

const COMMON_EVIDENCE = [
  ENDPOINT_RESOURCE_DATABASE_EVIDENCE_FILE,
  ENDPOINT_RESOURCE_DATABASE_TEST_FILE,
] as const;

function verified(
  ...evidence: readonly string[]
): EndpointResourceDatabaseEvidenceRecord {
  return {
    status: "verified",
    evidence: [...new Set([...COMMON_EVIDENCE, ...evidence])],
  };
}

const COLLECTION_EVIDENCE = [
  "security/collection-query-bound-evidence.ts",
  "security/collection-query-bound-evidence.test.ts",
  "src/lib/queries.ts",
  "src/lib/queries.test.ts",
] as const;

const SEARCH_EVIDENCE = [
  ...COLLECTION_EVIDENCE,
  "scripts/check-race-search-postgres.test.ts",
  "output/database-audit/race-search-read.json",
] as const;

const RATE_LIMIT_EVIDENCE = [
  "src/lib/rate-limit.ts",
  "src/lib/rate-limit.test.ts",
  "src/lib/rate-limit-response-route-contract.test.ts",
  "security/rate-limits.ts",
  "security/rate-limits.test.ts",
] as const;

const EXPORT_EVIDENCE = [
  "src/lib/user-export-policy.ts",
  "src/lib/user-export-policy.test.ts",
  "src/lib/user-export-service.ts",
  "src/app/api/users/me/export/route.ts",
  "src/app/api/users/me/export/route.test.ts",
  "output/database-audit/user-export-read.json",
] as const;

const QUEUE_EVIDENCE = [
  "src/lib/billing/usage-delivery-worker.ts",
  "src/lib/billing/usage-delivery-worker.test.ts",
  "src/lib/signup-acceptance-worker.ts",
  "src/lib/signup-acceptance-worker.test.ts",
  "security/queue-worker-control-evidence.ts",
  "security/queue-worker-control-evidence.test.ts",
] as const;

const PROVIDER_TIMEOUT_EVIDENCE = [
  "src/lib/live/topaz.ts",
  "src/lib/live/topaz.test.ts",
  "src/lib/remote-response.ts",
  "src/lib/remote-response.test.ts",
] as const;

const QUERY_DEADLINE_EVIDENCE = [
  "src/lib/db-context.ts",
  "security/database-operations.ts",
  "security/actual-query-capture-evidence.ts",
  "security/actual-query-capture-evidence.test.ts",
  "output/database-audit/race-search-read.json",
] as const;

const RLS_ROLE_EVIDENCE = [
  "security/row-level-security-runtime-evidence.json",
  "security/row-level-security-evidence.ts",
  "security/row-level-security-evidence.test.ts",
  "security/database-role-separation-evidence.ts",
  "security/database-role-separation-evidence.test.ts",
  "scripts/check-rls-access-matrix-postgres.ts",
] as const;

const DATABASE_OPERATION_EVIDENCE = [
  "security/database-operations.ts",
  "security/database-query-records.ts",
  "security/database-query-records.test.ts",
  "security/actual-query-capture-evidence.test.ts",
] as const;

const MUTATION_OUTCOME_EVIDENCE = [
  ...DATABASE_OPERATION_EVIDENCE,
  "scripts/check-demo-route-fixture-idempotency.test.ts",
  "scripts/check-demo-route-fixture-evidence.test.ts",
  "output/database-audit/demo-fixture-idempotency.json",
  "output/database-audit/account-deletion-finalize.json",
] as const;

const INDEX_EVIDENCE = [
  ...DATABASE_OPERATION_EVIDENCE,
  "output/database-audit/race-search-read.json",
  "output/database-audit/user-export-read.json",
  "output/database-audit/realtime-grant-revoke.json",
] as const;

const MIGRATION_EVIDENCE = [
  "scripts/check-database-compatibility-inventory.ts",
  "scripts/check-database-compatibility-inventory.test.ts",
  "scripts/check-database-migration-replay.ts",
  "scripts/check-database-migration-replay.test.ts",
  "output/database-audit/migration-replay.json",
] as const;

export const ENDPOINT_RESOURCE_DATABASE_MASTER_EVIDENCE = {
  "security.endpoint-test-resource-abuse.pagination-maximum": verified(
    ...COLLECTION_EVIDENCE,
  ),
  "security.endpoint-test-resource-abuse.large-search": verified(
    ...SEARCH_EVIDENCE,
  ),
  "security.endpoint-test-resource-abuse.high-cost-filter-combination":
    verified(...SEARCH_EVIDENCE, ...QUERY_DEADLINE_EVIDENCE),
  "security.endpoint-test-resource-abuse.repeated-submissions": verified(
    ...RATE_LIMIT_EVIDENCE,
  ),
  "security.endpoint-test-resource-abuse.per-user-rate-limits": verified(
    ...RATE_LIMIT_EVIDENCE,
  ),
  "security.endpoint-test-resource-abuse.per-object-rate-limits": verified(
    ...RATE_LIMIT_EVIDENCE,
  ),
  "security.endpoint-test-resource-abuse.messaging-quotas": verified(
    ...RATE_LIMIT_EVIDENCE,
    "src/app/api/messages/route.ts",
    "src/app/api/conversations/[id]/messages/route.ts",
  ),
  "security.endpoint-test-resource-abuse.export-quotas": verified(
    ...EXPORT_EVIDENCE,
  ),
  "security.endpoint-test-resource-abuse.ai-cost-limits": verified(
    ...RATE_LIMIT_EVIDENCE,
    "src/app/api/agents/[type]/run/route.ts",
    "src/lib/billing/entitlements.ts",
  ),
  "security.endpoint-test-resource-abuse.queue-backpressure": verified(
    ...QUEUE_EVIDENCE,
  ),
  "security.endpoint-test-resource-abuse.provider-timeout": verified(
    ...PROVIDER_TIMEOUT_EVIDENCE,
  ),
  "security.endpoint-test-resource-abuse.database-timeout": verified(
    ...QUERY_DEADLINE_EVIDENCE,
  ),
  "security.resource-control.per-user-rate-limit": verified(
    ...RATE_LIMIT_EVIDENCE,
  ),
  "security.resource-control.per-ip-rate-limit-where-appropriate": verified(
    ...RATE_LIMIT_EVIDENCE,
  ),
  "security.resource-control.per-object-rate-limit-where-appropriate": verified(
    ...RATE_LIMIT_EVIDENCE,
  ),
  "security.abuse-control.actor-based-limits": verified(
    ...RATE_LIMIT_EVIDENCE,
  ),
  "security.abuse-control.object-based-limits": verified(
    ...RATE_LIMIT_EVIDENCE,
  ),
  "security.abuse-control.not-global-ip-only": verified(
    ...RATE_LIMIT_EVIDENCE,
  ),
  "security.endpoint-test-database.tenant-predicate": verified(
    ...RLS_ROLE_EVIDENCE,
    ...DATABASE_OPERATION_EVIDENCE,
  ),
  "security.endpoint-test-database.ownership-predicate": verified(
    ...RLS_ROLE_EVIDENCE,
    ...DATABASE_OPERATION_EVIDENCE,
  ),
  "security.endpoint-test-database.row-level-security": verified(
    ...RLS_ROLE_EVIDENCE,
  ),
  "security.endpoint-test-database.database-role-privileges": verified(
    ...RLS_ROLE_EVIDENCE,
  ),
  "security.endpoint-test-database.constraint-enforcement": verified(
    ...MUTATION_OUTCOME_EVIDENCE,
    "prisma/schema.prisma",
  ),
  "security.endpoint-test-database.affected-row-checks": verified(
    ...MUTATION_OUTCOME_EVIDENCE,
  ),
  "security.endpoint-test-database.transaction-rollback": verified(
    ...RLS_ROLE_EVIDENCE,
    ...MUTATION_OUTCOME_EVIDENCE,
  ),
  "security.endpoint-test-database.query-timeout": verified(
    ...QUERY_DEADLINE_EVIDENCE,
  ),
  "security.endpoint-test-database.pagination-bound": verified(
    ...COLLECTION_EVIDENCE,
    ...DATABASE_OPERATION_EVIDENCE,
  ),
  "security.endpoint-test-database.sensitive-column-selection": verified(
    ...EXPORT_EVIDENCE,
    ...DATABASE_OPERATION_EVIDENCE,
  ),
  "security.endpoint-test-database.deleted-record-filtering": verified(
    ...MUTATION_OUTCOME_EVIDENCE,
    "src/lib/media-service.ts",
    "src/lib/media-service.test.ts",
  ),
  "security.endpoint-test-database.index-use-for-critical-queries": verified(
    ...INDEX_EVIDENCE,
  ),
  "security.endpoint-test-database.migration-compatibility": verified(
    ...MIGRATION_EVIDENCE,
  ),
} as const satisfies Readonly<
  Record<
    EndpointResourceDatabaseRequirementId,
    EndpointResourceDatabaseEvidenceRecord
  >
>;

export const ENDPOINT_RESOURCE_DATABASE_EXPECTED_GAIN =
  ENDPOINT_RESOURCE_DATABASE_REQUIREMENT_IDS.length;
