import type { DesignLabDatabaseContainerProvenance } from "./design-lab-database";

export const DESIGN_LAB_DATABASE_PARITY_PATH =
  "output/database-audit/design-lab-database-parity.json";
export const DESIGN_LAB_RUNTIME_ROLE = "greyhoundiq_runtime";
export const DESIGN_LAB_APPLICATION_NAME = "greyhoundiq_design_lab";
export const DESIGN_LAB_DATABASE_TARGET_PORT = 55_735;
export const DESIGN_LAB_DATABASE_REFERENCE_PORT = 55_734;
export const DESIGN_LAB_DATABASE_MAX_EVIDENCE_AGE_MS = 24 * 60 * 60 * 1_000;
export const DESIGN_LAB_DATABASE_MAX_APPLICATION_PROOF_WINDOW_MS = 30_000;
export const DESIGN_LAB_DATABASE_MAX_APPLICATION_PROOF_CONNECTIONS = 10;
export const DATABASE_CATALOG_COMPONENTS = Object.freeze([
  "server",
  "extensions",
  "roles",
  "memberships",
  "relations",
  "columns",
  "constraints",
  "indexes",
  "views",
  "functions",
  "triggers",
  "policies",
  "sequences",
  "enums",
  "grants",
  "migrations",
] as const);
export const DESIGN_LAB_RUNTIME_ROUTINE_ALLOWLIST = Object.freeze([
  "giq_actor_accountable(actor_id text, accountable_profile_id text)",
  "giq_actor_belongs_to_profile(actor_id text, profile_id text)",
  "giq_actor_can_act(actor_id text)",
  "giq_actor_connected(actor_id text)",
  "giq_actor_owned(actor_id text)",
  "giq_actor_visible(actor_id text)",
  "giq_audience_rank(audience text)",
  "giq_call_room_current_profile_can_join(room_id text)",
  "giq_call_room_current_profile_has_access(room_id text)",
  "giq_call_room_current_profile_is_creator(room_id text)",
  "giq_call_room_profile_is_conversation_participant(room_id text, profile_id text)",
  "giq_can_publish_feed_as(target_profile_id text, target_page_id text)",
  "giq_claim(name text)",
  "giq_conversation_actor_can_start(profile_a_id text, actor_a_id text, profile_b_id text, actor_b_id text)",
  "giq_conversation_actor_pair_valid(profile_a_id text, actor_a_id text, profile_b_id text, actor_b_id text)",
  "giq_conversation_default_personal_actors()",
  "giq_conversation_write_guard()",
  "giq_current_actor_id()",
  "giq_current_profile_id()",
  "giq_current_role()",
  "giq_current_tier()",
  "giq_current_user_id()",
  "giq_enforce_profile_marketing_tier()",
  "giq_feed_actor_can_publish(actor_id text)",
  "giq_feed_actor_consistent(actor_id text, accountable_profile_id text, page_id text)",
  "giq_feed_post_visible(post_id text)",
  "giq_feed_post_write_guard()",
  "giq_is_conversation_participant(conversation_id text)",
  "giq_is_moderator()",
  "giq_is_pro()",
  "giq_is_profile_in_conversation(conversation_id text, profile_id text)",
  "giq_is_system()",
  "giq_media_owned_by_actor(actor_id text, media_id text)",
  "giq_message_actor_pair_valid(conversation_id text, sender_profile_id text, sender_actor_id text, recipient_profile_id text, recipient_actor_id text)",
  "giq_message_write_guard()",
  "giq_org_current_user_is_member(org_id text)",
  "giq_org_current_user_is_owner(org_id text)",
  "giq_personal_feed_write_guard()",
  "giq_profiles_blocked(profile_a_id text, profile_b_id text)",
  "giq_refresh_aggregate_matview(requested_name text)",
  "giq_reject_page_call()",
  "giq_require_pro_write()",
  "giq_social_actor_identity_guard()",
  "giq_social_actor_identity_valid(actor_kind text, profile_id text, page_id text, owner_profile_id text)",
] as const);
export const DESIGN_LAB_RUNTIME_SEQUENCE_ALLOWLIST = Object.freeze([
  "AuditLog_id_seq",
] as const);

export type CatalogComponentName = (typeof DATABASE_CATALOG_COMPONENTS)[number];
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type CatalogComponent = {
  name: CatalogComponentName;
  rowCount: number;
  sha256: string;
};

export type RuntimeRoleProof = {
  currentRole: string;
  sessionRole: string;
  canLogin: boolean;
  superuser: boolean;
  bypassRls: boolean;
  createRole: boolean;
  createDatabase: boolean;
  replication: boolean;
  inherit: boolean;
  validUntil: string | null;
  roleConfig: string[];
  connectionLimit: number;
  memberOfRoles: string[];
  databaseConnect: boolean;
  databaseTemporary: boolean;
  databaseCreate: boolean;
  schemaUsage: boolean;
  schemaCreate: boolean;
  ownedObjectCount: number;
  requiredPrivilegeCount: number;
  missingPrivileges: string[];
  unexpectedPrivileges: string[];
  readOnlySession: boolean;
  applicationTableCount: number;
  rlsEnabledCount: number;
  forceRlsCount: number;
};

/** Immutable, credential-free parity evidence emitted only after every fail-closed check passes. */
export type DesignLabDatabaseParityReport = {
  schemaVersion: 1;
  auditKind: "design-lab-database-parity";
  generatedAt: string;
  safety: {
    scope: "literal-loopback-isolated-databases";
    target: SafeDatabaseTarget;
    reference: SafeDatabaseTarget;
    productionContacted: false;
    mutation: "none-during-verification";
    clusterIdentity: {
      targetSystemIdentifier: string;
      targetSystemIdentifierAfter: string;
      referenceSystemIdentifier: string;
      referenceSystemIdentifierAfter: string;
      stable: true;
      distinct: true;
    };
    targetControlPlane: DesignLabDatabaseContainerProvenance;
  };
  sourceBinding: {
    testedCommitSha: string;
    sourceSha256: string;
    sourceFileCount: number;
    prismaSchemaSha256: string;
    migrationsSha256: string;
    migrationCount: number;
    migrationReplaySha256: string;
    migrationReplayControlSha256: string;
    migrationReplayReferenceSystemIdentifier: string;
    migrationReplayTestedCommitSha: string;
    parityControlSha256: string;
    parityControlFileCount: number;
    sourceCommitBound: true;
    migrationReplayCommitBound: true;
  };
  runtimeRole: RuntimeRoleProof;
  catalog: {
    targetSha256: string;
    referenceSha256: string;
    matched: true;
    snapshotIsolation: "repeatable read";
    targetReadOnly: true;
    referenceReadOnly: true;
    components: Array<{
      name: CatalogComponentName;
      targetRows: number;
      referenceRows: number;
      targetSha256: string;
      referenceSha256: string;
      matched: true;
    }>;
  };
  applicationBinding: {
    baseUrl: string;
    readinessStatus: 200;
    databaseStatus: "ok";
    observedApplicationName: typeof DESIGN_LAB_APPLICATION_NAME;
    observedRole: typeof DESIGN_LAB_RUNTIME_ROLE;
    observedConnectionCount: number;
    observedFreshConnectionCount: number;
    requestId: string;
    proofWindowStartedAt: string;
    readinessObservedAt: string;
    proofWindowEndedAt: string;
    connections: Array<{
      pid: number;
      classification: "new" | "advanced";
      backendStartedAt: string;
      beforeQueryStartedAt: string | null;
      beforeStateChangedAt: string | null;
      afterQueryStartedAt: string;
      afterStateChangedAt: string;
    }>;
  };
  verdict: "verified";
};

/** Source and replay identity required to validate parity evidence without contacting PostgreSQL. */
export type DesignLabDatabaseParityBinding = {
  testedCommitSha: string;
  sourceSha256: string;
  sourceFileCount: number;
  prismaSchemaSha256: string;
  migrationsSha256: string;
  migrationCount: number;
  migrationReplaySha256: string;
  migrationReplayControlSha256: string;
  migrationReplayReferenceSystemIdentifier: string;
  migrationReplayTestedCommitSha: string;
  migrationReplayValid: boolean;
  parityControlSha256: string;
  parityControlFileCount: number;
  sourceCommitBound: boolean;
  migrationReplayCommitBound: boolean;
  now?: number;
};

/** Credential-free literal-loopback database identity safe to persist in evidence. */
export type SafeDatabaseTarget = {
  protocol: "postgresql";
  host: "127.0.0.1";
  port: number;
  database: "greyhoundiq";
};

export type QueryExecutor = {
  $queryRawUnsafe<T>(query: string): Promise<T>;
};

export type QueryClient = QueryExecutor & {
  $disconnect(): Promise<void>;
  $transaction<T>(
    operation: (client: QueryExecutor) => Promise<T>,
    options: {
      isolationLevel: "RepeatableRead";
      maxWait: number;
      timeout: number;
    },
  ): Promise<T>;
};
