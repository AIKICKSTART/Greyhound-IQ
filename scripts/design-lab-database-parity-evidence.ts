import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  DATABASE_MIGRATION_REPLAY_PATH,
  getMigrationReplaySourceState,
} from "./check-database-migration-replay";
import {
  fingerprintRepositoryFiles,
  getDesignLabSourceChangesBetween,
  getDesignLabSourcePaths,
  getRepositoryHeadSha,
} from "./design-lab-source-fingerprint";
import {
  DESIGN_LAB_DATABASE_COMPOSE_PROJECT,
  DESIGN_LAB_DATABASE_COMPOSE_SERVICE,
  DESIGN_LAB_DATABASE_CONTAINER,
  DESIGN_LAB_DATABASE_IMAGE_ID,
  DESIGN_LAB_DATABASE_IMAGE_REFERENCE,
  DESIGN_LAB_DATABASE_VOLUME,
} from "./design-lab-database";
import {
  DATABASE_CATALOG_COMPONENTS,
  DESIGN_LAB_APPLICATION_NAME,
  DESIGN_LAB_DATABASE_MAX_APPLICATION_PROOF_CONNECTIONS,
  DESIGN_LAB_DATABASE_MAX_APPLICATION_PROOF_WINDOW_MS,
  DESIGN_LAB_DATABASE_REFERENCE_PORT,
  DESIGN_LAB_DATABASE_TARGET_PORT,
  DESIGN_LAB_RUNTIME_ROLE,
  DESIGN_LAB_RUNTIME_ROUTINE_ALLOWLIST,
  type CatalogComponent,
  type CatalogComponentName,
  type DesignLabDatabaseParityBinding,
} from "./design-lab-database-parity-contract";
import { compositeCatalogDigest } from "./design-lab-database-parity-catalog";
import { assertParityInputs } from "./design-lab-database-parity-runtime";
import {
  canonicalIsoTimestamp,
  databaseEndpointRecord,
  exactKeys,
  findRepositoryCommitBindingIssues,
  isCommitSha,
  isFreshIsoDate,
  isGreyhoundIqRequestId,
  isNonNegativeInteger,
  isRecord,
  isSha256,
  isSystemIdentifier,
  nullableCanonicalIsoTimestamp,
  record,
  safeTargetRecord,
  sensitiveEvidenceIssues,
  sha256,
  targetToUrl,
} from "./design-lab-database-parity-support";

/** Exact verifier, test, source-binding, database-control, and lock inputs hashed by parity evidence. */
export const DESIGN_LAB_DATABASE_PARITY_CONTROL_FILES = Object.freeze([
  "package.json",
  "package-lock.json",
  "prisma.config.ts",
  "docker-compose.design-lab-db.yml",
  "scripts/audit-local-postgres-catalog.ts",
  "scripts/audit-local-postgres-catalog.test.ts",
  "scripts/check-database-compatibility-inventory.ts",
  "scripts/check-database-compatibility-inventory.test.ts",
  "scripts/check-database-migration-replay.ts",
  "scripts/check-database-migration-replay.test.ts",
  "scripts/check-design-lab-database-parity.ts",
  "scripts/check-design-lab-database-parity.test.ts",
  "scripts/design-lab-database-parity-catalog.ts",
  "scripts/design-lab-database-parity-contract.ts",
  "scripts/design-lab-database-parity-evidence.ts",
  "scripts/design-lab-database-parity-runtime.ts",
  "scripts/design-lab-database-parity-support.ts",
  "scripts/design-lab-database.ts",
  "scripts/design-lab-database.test.ts",
  "scripts/design-lab-source-fingerprint.ts",
  "scripts/design-lab-source-fingerprint.test.ts",
  "scripts/local-database-policy.ts",
  "scripts/local-database-policy.test.ts",
] as const);

/**
 * Accepts an earlier audited commit only when it is an ancestor of the current
 * commit and no fingerprinted source changed in the evidence-only commit(s).
 */
export function bindCurrentParityStateToAuditedCommit<
  T extends { testedCommitSha: string },
>(
  repositoryRoot: string,
  auditedCommitSha: string,
  current: T,
): T {
  const currentHeadSha = getRepositoryHeadSha(repositoryRoot);
  const changedPaths = getDesignLabSourceChangesBetween(
    repositoryRoot,
    auditedCommitSha,
    currentHeadSha,
  );
  return changedPaths?.length === 0
    ? { ...current, testedCommitSha: auditedCommitSha }
    : current;
}

/**
 * Validates an existing parity artifact against its exact source/replay binding and evidence schema.
 * It performs no network or database I/O and returns every fail-closed issue without exposing secrets.
 */
export function findDesignLabDatabaseParityIssues(
  value: unknown,
  binding: DesignLabDatabaseParityBinding,
) {
  const issues: string[] = [];
  if (!isRecord(value)) return ["Evidence must be an object."];
  exactKeys(
    value,
    [
      "schemaVersion",
      "auditKind",
      "generatedAt",
      "safety",
      "sourceBinding",
      "runtimeRole",
      "catalog",
      "applicationBinding",
      "verdict",
    ],
    "database parity evidence",
    issues,
  );
  issues.push(...sensitiveEvidenceIssues(value));
  if (value.schemaVersion !== 1) issues.push("schemaVersion must be 1.");
  if (value.auditKind !== "design-lab-database-parity") {
    issues.push("auditKind is invalid.");
  }
  if (!isFreshIsoDate(value.generatedAt, binding.now ?? Date.now())) {
    issues.push("generatedAt must be a current ISO timestamp.");
  }
  if (value.verdict !== "verified") issues.push("verdict must be verified.");

  const safety = record(value.safety);
  if (safety) {
    exactKeys(
      safety,
      [
        "scope",
        "target",
        "reference",
        "productionContacted",
        "mutation",
        "clusterIdentity",
        "targetControlPlane",
      ],
      "safety",
      issues,
    );
  }
  if (safety?.scope !== "literal-loopback-isolated-databases") {
    issues.push("safety scope is invalid.");
  }
  if (safety?.productionContacted !== false || safety?.mutation !== "none-during-verification") {
    issues.push("verification safety claims are invalid.");
  }
  const target = safeTargetRecord(safety?.target, "target", issues);
  const reference = safeTargetRecord(safety?.reference, "reference", issues);
  if (target && reference && databaseEndpointRecord(target) === databaseEndpointRecord(reference)) {
    issues.push("target and reference must be isolated endpoints.");
  }
  const clusterIdentity = record(safety?.clusterIdentity);
  if (clusterIdentity) {
    exactKeys(
      clusterIdentity,
      [
        "targetSystemIdentifier",
        "targetSystemIdentifierAfter",
        "referenceSystemIdentifier",
        "referenceSystemIdentifierAfter",
        "stable",
        "distinct",
      ],
      "clusterIdentity",
      issues,
    );
  }
  if (
    !isSystemIdentifier(clusterIdentity?.targetSystemIdentifier) ||
    !isSystemIdentifier(clusterIdentity?.targetSystemIdentifierAfter) ||
    !isSystemIdentifier(clusterIdentity?.referenceSystemIdentifier) ||
    !isSystemIdentifier(clusterIdentity?.referenceSystemIdentifierAfter) ||
    clusterIdentity?.targetSystemIdentifier !==
      clusterIdentity?.targetSystemIdentifierAfter ||
    clusterIdentity?.referenceSystemIdentifier !==
      clusterIdentity?.referenceSystemIdentifierAfter ||
    clusterIdentity?.targetSystemIdentifier === clusterIdentity?.referenceSystemIdentifier ||
    clusterIdentity?.stable !== true ||
    clusterIdentity?.distinct !== true
  ) {
    issues.push("target and reference PostgreSQL cluster identities are invalid.");
  }
  validateTargetControlPlane(safety?.targetControlPlane, issues);

  const source = record(value.sourceBinding);
  if (source) {
    exactKeys(
      source,
      [
        "testedCommitSha",
        "sourceSha256",
        "sourceFileCount",
        "prismaSchemaSha256",
        "migrationsSha256",
        "migrationCount",
        "migrationReplaySha256",
        "migrationReplayControlSha256",
        "migrationReplayReferenceSystemIdentifier",
        "migrationReplayTestedCommitSha",
        "parityControlSha256",
        "parityControlFileCount",
        "sourceCommitBound",
        "migrationReplayCommitBound",
      ],
      "sourceBinding",
      issues,
    );
  }
  for (const key of [
    "testedCommitSha",
    "sourceSha256",
    "sourceFileCount",
    "prismaSchemaSha256",
    "migrationsSha256",
    "migrationCount",
    "migrationReplaySha256",
    "migrationReplayControlSha256",
    "migrationReplayReferenceSystemIdentifier",
    "migrationReplayTestedCommitSha",
    "parityControlSha256",
    "parityControlFileCount",
    "sourceCommitBound",
    "migrationReplayCommitBound",
  ] as const) {
    if (source?.[key] !== binding[key]) issues.push(`sourceBinding.${key} is stale.`);
  }
  if (
    !isCommitSha(source?.testedCommitSha) ||
    !isSha256(source?.sourceSha256) ||
    !isSha256(source?.prismaSchemaSha256) ||
    !isSha256(source?.migrationsSha256) ||
    !isSha256(source?.migrationReplaySha256) ||
    !isSha256(source?.migrationReplayControlSha256) ||
    !isSha256(source?.parityControlSha256) ||
    !isSystemIdentifier(source?.migrationReplayReferenceSystemIdentifier) ||
    !isCommitSha(source?.migrationReplayTestedCommitSha) ||
    source?.migrationReplayReferenceSystemIdentifier !==
      clusterIdentity?.referenceSystemIdentifier ||
    !isNonNegativeInteger(source?.sourceFileCount) ||
    !isNonNegativeInteger(source?.migrationCount) ||
    !isNonNegativeInteger(source?.parityControlFileCount) ||
    source?.parityControlFileCount !==
      DESIGN_LAB_DATABASE_PARITY_CONTROL_FILES.length ||
    source?.sourceCommitBound !== true ||
    source?.migrationReplayCommitBound !== true ||
    binding.sourceCommitBound !== true ||
    binding.migrationReplayCommitBound !== true ||
    binding.migrationReplayValid !== true
  ) {
    issues.push("source binding hashes, counts or replay provenance are invalid.");
  }

  const runtime = record(value.runtimeRole);
  if (runtime) {
    exactKeys(
      runtime,
      [
        "currentRole",
        "sessionRole",
        "canLogin",
        "superuser",
        "bypassRls",
        "createRole",
        "createDatabase",
        "replication",
        "inherit",
        "validUntil",
        "roleConfig",
        "connectionLimit",
        "memberOfRoles",
        "databaseConnect",
        "databaseTemporary",
        "databaseCreate",
        "schemaUsage",
        "schemaCreate",
        "ownedObjectCount",
        "requiredPrivilegeCount",
        "missingPrivileges",
        "unexpectedPrivileges",
        "readOnlySession",
        "applicationTableCount",
        "rlsEnabledCount",
        "forceRlsCount",
      ],
      "runtimeRole",
      issues,
    );
  }
  if (
    runtime?.currentRole !== DESIGN_LAB_RUNTIME_ROLE ||
    runtime.sessionRole !== DESIGN_LAB_RUNTIME_ROLE ||
    runtime.canLogin !== true ||
    runtime.superuser !== false ||
    runtime.bypassRls !== false ||
    runtime.createRole !== false ||
    runtime.createDatabase !== false ||
    runtime.replication !== false ||
    runtime.inherit !== true ||
    runtime.validUntil !== null ||
    !Array.isArray(runtime.roleConfig) ||
    runtime.roleConfig.length !== 0 ||
    !Array.isArray(runtime.memberOfRoles) ||
    runtime.memberOfRoles.length !== 0 ||
    runtime.databaseConnect !== true ||
    runtime.databaseTemporary !== false ||
    runtime.databaseCreate !== false ||
    runtime.schemaUsage !== true ||
    runtime.schemaCreate !== false ||
    runtime.ownedObjectCount !== 0 ||
    !isNonNegativeInteger(runtime.requiredPrivilegeCount) ||
    runtime.requiredPrivilegeCount < DESIGN_LAB_RUNTIME_ROUTINE_ALLOWLIST.length ||
    !Array.isArray(runtime.missingPrivileges) ||
    runtime.missingPrivileges.length !== 0 ||
    !Array.isArray(runtime.unexpectedPrivileges) ||
    runtime.unexpectedPrivileges.length !== 0 ||
    runtime.readOnlySession !== true
  ) {
    issues.push("runtime role proof is not a restricted non-owner identity.");
  }
  if (
    !isNonNegativeInteger(runtime?.connectionLimit) ||
    runtime.connectionLimit < 1 ||
    runtime.connectionLimit > 40
  ) {
    issues.push("runtime role connection limit must be between 1 and 40.");
  }
  if (
    !isNonNegativeInteger(runtime?.applicationTableCount) ||
    runtime.applicationTableCount < 1 ||
    runtime.rlsEnabledCount !== runtime.applicationTableCount ||
    runtime.forceRlsCount !== runtime.applicationTableCount
  ) {
    issues.push("runtime RLS proof is incomplete.");
  }

  const catalog = record(value.catalog);
  if (catalog) {
    exactKeys(
      catalog,
      [
        "targetSha256",
        "referenceSha256",
        "matched",
        "snapshotIsolation",
        "targetReadOnly",
        "referenceReadOnly",
        "components",
      ],
      "catalog",
      issues,
    );
  }
  const components = Array.isArray(catalog?.components) ? catalog.components : [];
  if (catalog?.matched !== true || catalog.targetSha256 !== catalog.referenceSha256) {
    issues.push("catalog target/reference digests do not match.");
  }
  if (
    catalog?.snapshotIsolation !== "repeatable read" ||
    catalog.targetReadOnly !== true ||
    catalog.referenceReadOnly !== true
  ) {
    issues.push("catalog snapshot proof is invalid.");
  }
  if (components.length !== DATABASE_CATALOG_COMPONENTS.length) {
    issues.push("catalog component count is invalid.");
  }
  if (
    JSON.stringify(components.map((component) => record(component)?.name)) !==
    JSON.stringify(DATABASE_CATALOG_COMPONENTS)
  ) {
    issues.push("catalog component order or exact inventory is invalid.");
  }
  const componentNames = new Set<string>();
  const targetDigestComponents: CatalogComponent[] = [];
  const referenceDigestComponents: CatalogComponent[] = [];
  for (const componentValue of components) {
    const component = record(componentValue);
    if (!component || typeof component.name !== "string") {
      issues.push("catalog component is malformed.");
      continue;
    }
    exactKeys(
      component,
      [
        "name",
        "targetRows",
        "referenceRows",
        "targetSha256",
        "referenceSha256",
        "matched",
      ],
      `catalog component ${component.name}`,
      issues,
    );
    if (componentNames.has(component.name)) issues.push(`duplicate catalog component ${component.name}.`);
    componentNames.add(component.name);
    if (
      !DATABASE_CATALOG_COMPONENTS.includes(component.name as CatalogComponentName) ||
      component.matched !== true ||
      !isNonNegativeInteger(component.targetRows) ||
      !isNonNegativeInteger(component.referenceRows) ||
      !isSha256(component.targetSha256) ||
      !isSha256(component.referenceSha256) ||
      component.targetRows !== component.referenceRows ||
      component.targetSha256 !== component.referenceSha256
    ) {
      issues.push(`catalog component ${component.name} does not match.`);
    }
    if (
      DATABASE_CATALOG_COMPONENTS.includes(component.name as CatalogComponentName) &&
      isNonNegativeInteger(component.targetRows) &&
      isNonNegativeInteger(component.referenceRows) &&
      isSha256(component.targetSha256) &&
      isSha256(component.referenceSha256)
    ) {
      targetDigestComponents.push({
        name: component.name as CatalogComponentName,
        rowCount: component.targetRows,
        sha256: component.targetSha256,
      });
      referenceDigestComponents.push({
        name: component.name as CatalogComponentName,
        rowCount: component.referenceRows,
        sha256: component.referenceSha256,
      });
    }
  }
  for (const name of DATABASE_CATALOG_COMPONENTS) {
    if (!componentNames.has(name)) issues.push(`catalog component ${name} is missing.`);
  }
  if (
    !isSha256(catalog?.targetSha256) ||
    !isSha256(catalog?.referenceSha256) ||
    targetDigestComponents.length !== DATABASE_CATALOG_COMPONENTS.length ||
    referenceDigestComponents.length !== DATABASE_CATALOG_COMPONENTS.length ||
    catalog?.targetSha256 !== compositeCatalogDigest(targetDigestComponents) ||
    catalog?.referenceSha256 !== compositeCatalogDigest(referenceDigestComponents)
  ) {
    issues.push("catalog composite digests are missing or not derived from every component.");
  }

  const application = record(value.applicationBinding);
  if (application) {
    exactKeys(
      application,
      [
        "baseUrl",
        "readinessStatus",
        "databaseStatus",
        "observedApplicationName",
        "observedRole",
        "observedConnectionCount",
        "observedFreshConnectionCount",
        "requestId",
        "proofWindowStartedAt",
        "readinessObservedAt",
        "proofWindowEndedAt",
        "connections",
      ],
      "applicationBinding",
      issues,
    );
  }
  const proofStartedAt = canonicalIsoTimestamp(application?.proofWindowStartedAt);
  const readinessObservedAt = canonicalIsoTimestamp(
    application?.readinessObservedAt,
  );
  const proofEndedAt = canonicalIsoTimestamp(application?.proofWindowEndedAt);
  const generatedAt = canonicalIsoTimestamp(value.generatedAt);
  const connectionProofs = Array.isArray(application?.connections)
    ? application.connections
    : [];
  if (
    application?.readinessStatus !== 200 ||
    application.databaseStatus !== "ok" ||
    application.observedApplicationName !== DESIGN_LAB_APPLICATION_NAME ||
    application.observedRole !== DESIGN_LAB_RUNTIME_ROLE ||
    !isNonNegativeInteger(application.observedConnectionCount) ||
    application.observedConnectionCount < 1 ||
    !isNonNegativeInteger(application.observedFreshConnectionCount) ||
    application.observedFreshConnectionCount < 1 ||
    application.observedFreshConnectionCount > application.observedConnectionCount ||
    connectionProofs.length !== application.observedFreshConnectionCount ||
    connectionProofs.length > DESIGN_LAB_DATABASE_MAX_APPLICATION_PROOF_CONNECTIONS ||
    !isGreyhoundIqRequestId(application.requestId) ||
    proofStartedAt === undefined ||
    readinessObservedAt === undefined ||
    proofEndedAt === undefined ||
    generatedAt === undefined ||
    proofStartedAt > readinessObservedAt ||
    readinessObservedAt > proofEndedAt ||
    proofEndedAt > generatedAt ||
    proofEndedAt - proofStartedAt > DESIGN_LAB_DATABASE_MAX_APPLICATION_PROOF_WINDOW_MS ||
    typeof application.baseUrl !== "string"
  ) {
    issues.push("live application binding proof is invalid.");
  } else {
    try {
      assertParityInputs(
        target ? targetToUrl(target, "postgres") : "",
        target ? targetToUrl(target, DESIGN_LAB_RUNTIME_ROLE, true) : "",
        reference ? targetToUrl(reference, "postgres") : "",
        application.baseUrl,
      );
    } catch {
      issues.push("recorded application or database targets are unsafe.");
    }
  }
  const seenPids = new Set<number>();
  for (const proofValue of connectionProofs) {
    const proof = record(proofValue);
    if (!proof) {
      issues.push("application connection proof is malformed.");
      continue;
    }
    exactKeys(
      proof,
      [
        "pid",
        "classification",
        "backendStartedAt",
        "beforeQueryStartedAt",
        "beforeStateChangedAt",
        "afterQueryStartedAt",
        "afterStateChangedAt",
      ],
      "application connection proof",
      issues,
    );
    const backend = canonicalIsoTimestamp(proof.backendStartedAt);
    const beforeQuery = nullableCanonicalIsoTimestamp(proof.beforeQueryStartedAt);
    const beforeState = nullableCanonicalIsoTimestamp(proof.beforeStateChangedAt);
    const afterQuery = canonicalIsoTimestamp(proof.afterQueryStartedAt);
    const afterState = canonicalIsoTimestamp(proof.afterStateChangedAt);
    if (
      !Number.isInteger(proof.pid) ||
      Number(proof.pid) < 1 ||
      seenPids.has(Number(proof.pid)) ||
      (proof.classification !== "new" && proof.classification !== "advanced") ||
      backend === undefined ||
      afterQuery === undefined ||
      afterState === undefined ||
      proofStartedAt === undefined ||
      readinessObservedAt === undefined ||
      proofEndedAt === undefined ||
      backend > proofEndedAt ||
      afterQuery < proofStartedAt ||
      afterQuery > readinessObservedAt ||
      afterQuery > proofEndedAt ||
      afterState > proofEndedAt ||
      afterQuery < backend ||
      afterState < backend
    ) {
      issues.push("application connection proof timestamps or identity are invalid.");
      continue;
    }
    seenPids.add(Number(proof.pid));
    if (
      proof.classification === "new" &&
      (
        proof.beforeQueryStartedAt !== null ||
        proof.beforeStateChangedAt !== null ||
        afterQuery < proofStartedAt
      )
    ) {
      issues.push("new application connection proof is not fresh.");
    }
    if (proof.classification === "advanced") {
      if (typeof beforeQuery !== "number" || typeof beforeState !== "number") {
        issues.push("advanced application connection proof is not fresh.");
      } else if (
        beforeQuery < backend ||
        beforeState < backend ||
        afterQuery <= beforeQuery ||
        afterState < beforeState ||
        afterQuery < proofStartedAt ||
        afterQuery > readinessObservedAt
      ) {
        issues.push("advanced application connection proof is not fresh.");
      }
    }
  }
  return [...new Set(issues)];
}

/** Recomputes source, replay, verifier-control, and Git commit bindings without database I/O. */
export function getCurrentDesignLabDatabaseParityBinding(repositoryRoot: string): DesignLabDatabaseParityBinding {
  const replaySource = getMigrationReplaySourceState(repositoryRoot);
  const parityControl = fingerprintRepositoryFiles(
    repositoryRoot,
    DESIGN_LAB_DATABASE_PARITY_CONTROL_FILES,
  );
  const sourceCommitBound =
    findRepositoryCommitBindingIssues(
      repositoryRoot,
      [
        ...getDesignLabSourcePaths(repositoryRoot),
        ...DESIGN_LAB_DATABASE_PARITY_CONTROL_FILES,
      ],
    ).length === 0;
  const core = {
    testedCommitSha: replaySource.headSha,
    sourceSha256: replaySource.sourceSha256,
    sourceFileCount: replaySource.sourceFileCount,
    prismaSchemaSha256: replaySource.schemaSha256,
    migrationsSha256: replaySource.migrationsSha256,
    migrationCount: replaySource.migrationCount,
    migrationReplayControlSha256: replaySource.replayControlSha256,
    parityControlSha256: parityControl.sha256,
    parityControlFileCount: parityControl.fileCount,
    sourceCommitBound,
  };
  const replayPath = resolve(repositoryRoot, DATABASE_MIGRATION_REPLAY_PATH);
  let replayRaw = "";
  let replay: unknown;
  try {
    replayRaw = readFileSync(replayPath, "utf8");
    replay = JSON.parse(replayRaw) as unknown;
  } catch {
    replay = undefined;
  }
  const replayReferenceSystemIdentifier = record(record(replay)?.safety)
    ?.referenceSystemIdentifier;
  const replayTestedCommitSha = record(record(replay)?.sourceBinding)
    ?.testedCommitSha;
  const migrationReplayTestedCommitSha = isCommitSha(replayTestedCommitSha)
    ? replayTestedCommitSha
    : "";
  const migrationReplayCommitBound =
    findRepositoryCommitBindingIssues(repositoryRoot, [
      DATABASE_MIGRATION_REPLAY_PATH,
    ]).length === 0;
  const replayBoundCore = bindCurrentParityStateToAuditedCommit(
    repositoryRoot,
    migrationReplayTestedCommitSha,
    core,
  );
  const replayIssues = findMigrationReplayIssues(replay, {
    testedCommitSha: replayBoundCore.testedCommitSha,
    sourceSha256: replayBoundCore.sourceSha256,
    sourceFileCount: replayBoundCore.sourceFileCount,
    prismaSchemaSha256: replayBoundCore.prismaSchemaSha256,
    migrationsSha256: replayBoundCore.migrationsSha256,
    migrationCount: replayBoundCore.migrationCount,
    replayControlSha256: replayBoundCore.migrationReplayControlSha256,
    now: Date.now(),
  });
  return {
    ...replayBoundCore,
    migrationReplaySha256: replayRaw ? sha256(replayRaw) : "",
    migrationReplayReferenceSystemIdentifier:
      isSystemIdentifier(replayReferenceSystemIdentifier)
        ? replayReferenceSystemIdentifier
        : "",
    migrationReplayTestedCommitSha,
    migrationReplayValid:
      migrationReplayTestedCommitSha === replayBoundCore.testedCommitSha &&
      replayIssues.length === 0,
    migrationReplayCommitBound,
  };
}

type MigrationReplayBinding = Omit<
  DesignLabDatabaseParityBinding,
  | "migrationReplaySha256"
  | "migrationReplayValid"
  | "migrationReplayControlSha256"
  | "migrationReplayReferenceSystemIdentifier"
  | "migrationReplayTestedCommitSha"
  | "parityControlSha256"
  | "parityControlFileCount"
  | "sourceCommitBound"
  | "migrationReplayCommitBound"
> & { replayControlSha256: string };

/**
 * Validates the fixed migration replay as a fresh, source-bound, no-difference loopback proof.
 * It is pure and fail-closed: any schema drift, unsafe endpoint, mutation claim, or secret is reported.
 */
export function findMigrationReplayIssues(
  value: unknown,
  binding: MigrationReplayBinding,
) {
  const issues: string[] = [];
  if (!isRecord(value)) return ["Migration replay evidence must be an object."];
  exactKeys(
    value,
    ["schemaVersion", "auditKind", "generatedAt", "safety", "sourceBinding", "replay", "verdict"],
    "migration replay",
    issues,
  );
  if (
    value.schemaVersion !== 2 ||
    value.auditKind !== "isolated-postgres-migration-replay" ||
    value.verdict !== "verified" ||
    !isFreshIsoDate(value.generatedAt, binding.now ?? Date.now())
  ) {
    issues.push("Migration replay top-level verdict or freshness is invalid.");
  }
  const safety = record(value.safety);
  if (safety) {
    exactKeys(
      safety,
      [
        "scope",
        "target",
        "shadow",
        "targetMutation",
        "shadowMutation",
        "referenceSystemIdentifier",
      ],
      "migration replay safety",
      issues,
    );
  }
  if (safety?.scope !== "literal-loopback-local-only") {
    issues.push("Migration replay safety scope is invalid.");
  }
  if (
    safety?.targetMutation !==
      "none; Prisma migrate diff is read-only for the target" ||
    safety?.shadowMutation !==
      "Prisma may reset the explicitly separate disposable shadow database"
  ) {
    issues.push("Migration replay mutation boundaries are invalid.");
  }
  if (!isSystemIdentifier(safety?.referenceSystemIdentifier)) {
    issues.push("Migration replay PostgreSQL system identifier is invalid.");
  }
  const target = record(safety?.target);
  const shadow = record(safety?.shadow);
  for (const [label, endpoint, database] of [
    ["target", target, "greyhoundiq"],
    ["shadow", shadow, "greyhoundiq_shadow"],
  ] as const) {
    if (endpoint) exactKeys(endpoint, ["protocol", "host", "port", "database"], `migration replay ${label}`, issues);
    if (
      endpoint?.protocol !== "postgresql" ||
      endpoint.host !== "127.0.0.1" ||
      endpoint.port !== DESIGN_LAB_DATABASE_REFERENCE_PORT ||
      endpoint.database !== database
    ) {
      issues.push(`Migration replay ${label} endpoint is invalid.`);
    }
  }
  const source = record(value.sourceBinding);
  if (source) {
    exactKeys(
      source,
      [
        "testedCommitSha",
        "sourceSha256",
        "sourceFileCount",
        "prismaSchemaSha256",
        "migrationsSha256",
        "migrationCount",
        "replayControlSha256",
      ],
      "migration replay sourceBinding",
      issues,
    );
  }
  for (const key of [
    "testedCommitSha",
    "sourceSha256",
    "sourceFileCount",
    "prismaSchemaSha256",
    "migrationsSha256",
    "migrationCount",
  ] as const) {
    if (source?.[key] !== binding[key]) issues.push(`Migration replay sourceBinding.${key} is stale.`);
  }
  if (
    !isSha256(source?.replayControlSha256) ||
    source?.replayControlSha256 !== binding.replayControlSha256
  ) {
    issues.push("Migration replay control hash is missing or stale.");
  }
  const replay = record(value.replay);
  if (replay) {
    exactKeys(replay, ["status", "exitCode", "outputSha256", "summary"], "migration replay result", issues);
  }
  const summary = Array.isArray(replay?.summary) &&
    replay.summary.every((line) => typeof line === "string")
    ? replay.summary as string[]
    : undefined;
  const noDifferenceProofCount =
    summary?.filter((line) => line === "No difference detected.").length ?? 0;
  const contradictoryReplaySummary =
    summary?.some(
      (line) =>
        line !== "No difference detected." &&
        /\b(?:difference|drift|error|failed|failure)\b/iu.test(line),
    ) ?? true;
  if (
    replay?.status !== "verified" ||
    replay.exitCode !== 0 ||
    !isSha256(replay.outputSha256) ||
    !summary ||
    noDifferenceProofCount !== 1 ||
    contradictoryReplaySummary ||
    replay.outputSha256 !== sha256(summary.join("\n"))
  ) {
    issues.push("Migration replay result is not a verified no-difference replay.");
  }
  issues.push(...sensitiveEvidenceIssues(value));
  return [...new Set(issues)];
}

function validateTargetControlPlane(value: unknown, issues: string[]) {
  const control = record(value);
  if (!control) {
    issues.push("target control-plane provenance is missing.");
    return;
  }
  exactKeys(
    control,
    [
      "containerId",
      "imageId",
      "imageReference",
      "containerName",
      "composeProject",
      "composeService",
      "state",
      "health",
      "portBinding",
      "volumeMount",
    ],
    "target control plane",
    issues,
  );
  if (
    typeof control.containerId !== "string" ||
    !/^[a-f0-9]{64}$/u.test(control.containerId) ||
    control.imageId !== DESIGN_LAB_DATABASE_IMAGE_ID ||
    control.imageReference !== DESIGN_LAB_DATABASE_IMAGE_REFERENCE ||
    control.containerName !== DESIGN_LAB_DATABASE_CONTAINER ||
    control.composeProject !== DESIGN_LAB_DATABASE_COMPOSE_PROJECT ||
    control.composeService !== DESIGN_LAB_DATABASE_COMPOSE_SERVICE ||
    control.state !== "running" ||
    control.health !== "healthy"
  ) {
    issues.push("target control-plane container identity is invalid.");
  }
  const port = record(control.portBinding);
  if (port) {
    exactKeys(
      port,
      ["containerPort", "hostIp", "hostPort"],
      "target control-plane port binding",
      issues,
    );
  }
  if (
    port?.containerPort !== "5432/tcp" ||
    port.hostIp !== "127.0.0.1" ||
    port.hostPort !== DESIGN_LAB_DATABASE_TARGET_PORT
  ) {
    issues.push("target control-plane port binding is invalid.");
  }
  const volume = record(control.volumeMount);
  if (volume) {
    exactKeys(
      volume,
      ["type", "name", "destination"],
      "target control-plane volume mount",
      issues,
    );
  }
  if (
    volume?.type !== "volume" ||
    volume.name !== DESIGN_LAB_DATABASE_VOLUME ||
    volume.destination !== "/var/lib/postgresql/data"
  ) {
    issues.push("target control-plane volume provenance is invalid.");
  }
}
