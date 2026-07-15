import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readDesignLabDatabaseContainerProvenance } from "./design-lab-database";
import {
  DATABASE_CATALOG_COMPONENTS,
  DESIGN_LAB_APPLICATION_NAME,
  DESIGN_LAB_DATABASE_PARITY_PATH,
  DESIGN_LAB_RUNTIME_ROLE,
  DESIGN_LAB_RUNTIME_ROUTINE_ALLOWLIST,
  type DesignLabDatabaseParityBinding,
  type DesignLabDatabaseParityReport,
} from "./design-lab-database-parity-contract";
import {
  collectCatalog,
  compareCatalogComponents,
  compositeCatalogDigest,
} from "./design-lab-database-parity-catalog";
import {
  DESIGN_LAB_DATABASE_PARITY_CONTROL_FILES,
  bindCurrentParityStateToAuditedCommit,
  findDesignLabDatabaseParityIssues,
  findMigrationReplayIssues,
  getCurrentDesignLabDatabaseParityBinding,
} from "./design-lab-database-parity-evidence";
import {
  assertParityInputs,
  assertStableClusterIdentities,
  collectApplicationBinding,
  collectClusterIdentity,
  collectRuntimeRole,
} from "./design-lab-database-parity-runtime";
import {
  findRepositoryCommitBindingIssues,
  safeDatabaseTarget,
} from "./design-lab-database-parity-support";

export {
  DATABASE_CATALOG_COMPONENTS,
  DESIGN_LAB_APPLICATION_NAME,
  DESIGN_LAB_DATABASE_PARITY_PATH,
  DESIGN_LAB_DATABASE_PARITY_CONTROL_FILES,
  DESIGN_LAB_RUNTIME_ROLE,
  DESIGN_LAB_RUNTIME_ROUTINE_ALLOWLIST,
  assertParityInputs,
  assertStableClusterIdentities,
  bindCurrentParityStateToAuditedCommit,
  collectCatalog,
  collectRuntimeRole,
  compareCatalogComponents,
  findDesignLabDatabaseParityIssues,
  findMigrationReplayIssues,
};
export type {
  DesignLabDatabaseParityBinding,
  DesignLabDatabaseParityReport,
};

async function collectReport(
  repositoryRoot: string,
  adminUrl: string,
  runtimeUrl: string,
  referenceUrl: string,
  baseUrl: string,
): Promise<DesignLabDatabaseParityReport> {
  assertParityInputs(adminUrl, runtimeUrl, referenceUrl, baseUrl);
  const bindingBefore = getCurrentDesignLabDatabaseParityBinding(repositoryRoot);
  if (!bindingBefore.sourceCommitBound) {
    throw new Error(
      "Database parity sources are not exact tracked stage-0 files at the tested Git HEAD.",
    );
  }
  if (
    !bindingBefore.migrationReplayValid ||
    !bindingBefore.migrationReplayCommitBound
  ) {
    throw new Error(
      "The fixed migration-replay artifact is missing, stale, invalid or not committed exactly at HEAD; recapture and commit it before database parity.",
    );
  }
  const targetControlPlane = readDesignLabDatabaseContainerProvenance();
  const [targetSystemIdentifier, referenceSystemIdentifier] = await Promise.all([
    collectClusterIdentity(adminUrl),
    collectClusterIdentity(referenceUrl),
  ]);
  const clusterIdentityBefore = {
    target: targetSystemIdentifier,
    reference: referenceSystemIdentifier,
  };
  assertStableClusterIdentities(
    clusterIdentityBefore,
    clusterIdentityBefore,
    bindingBefore.migrationReplayReferenceSystemIdentifier,
  );
  const targetComponents = await collectCatalog(adminUrl);
  const referenceComponents = await collectCatalog(referenceUrl);
  const comparison = compareCatalogComponents(targetComponents, referenceComponents);
  const mismatches = comparison.filter((component) => !component.matched);
  if (mismatches.length > 0) {
    throw new Error(
      `Target catalog differs from fresh replay: ${mismatches.map((component) => component.name).join(", ")}.`,
    );
  }
  const runtimeRole = await collectRuntimeRole(runtimeUrl);
  const applicationBinding = await collectApplicationBinding(adminUrl, baseUrl);
  const [targetSystemIdentifierAfter, referenceSystemIdentifierAfter] =
    await Promise.all([
      collectClusterIdentity(adminUrl),
      collectClusterIdentity(referenceUrl),
    ]);
  assertStableClusterIdentities(
    clusterIdentityBefore,
    {
      target: targetSystemIdentifierAfter,
      reference: referenceSystemIdentifierAfter,
    },
    bindingBefore.migrationReplayReferenceSystemIdentifier,
  );
  const bindingAfter = getCurrentDesignLabDatabaseParityBinding(repositoryRoot);
  if (JSON.stringify(bindingAfter) !== JSON.stringify(bindingBefore)) {
    throw new Error("Repository source changed during database parity capture; discard the run.");
  }
  if (
    JSON.stringify(readDesignLabDatabaseContainerProvenance()) !==
    JSON.stringify(targetControlPlane)
  ) {
    throw new Error(
      "Design Lab database container provenance changed during parity capture; discard the run.",
    );
  }
  const targetSha256 = compositeCatalogDigest(targetComponents);
  const referenceSha256 = compositeCatalogDigest(referenceComponents);
  assert.equal(targetSha256, referenceSha256);
  const report: DesignLabDatabaseParityReport = {
    schemaVersion: 1,
    auditKind: "design-lab-database-parity",
    generatedAt: new Date().toISOString(),
    safety: {
      scope: "literal-loopback-isolated-databases",
      target: safeDatabaseTarget(adminUrl),
      reference: safeDatabaseTarget(referenceUrl),
      productionContacted: false,
      mutation: "none-during-verification",
      clusterIdentity: {
        targetSystemIdentifier,
        targetSystemIdentifierAfter,
        referenceSystemIdentifier,
        referenceSystemIdentifierAfter,
        stable: true,
        distinct: true,
      },
      targetControlPlane,
    },
    sourceBinding: {
      testedCommitSha: bindingBefore.testedCommitSha,
      sourceSha256: bindingBefore.sourceSha256,
      sourceFileCount: bindingBefore.sourceFileCount,
      prismaSchemaSha256: bindingBefore.prismaSchemaSha256,
      migrationsSha256: bindingBefore.migrationsSha256,
      migrationCount: bindingBefore.migrationCount,
      migrationReplaySha256: bindingBefore.migrationReplaySha256,
      migrationReplayControlSha256: bindingBefore.migrationReplayControlSha256,
      migrationReplayReferenceSystemIdentifier:
        bindingBefore.migrationReplayReferenceSystemIdentifier,
      migrationReplayTestedCommitSha:
        bindingBefore.migrationReplayTestedCommitSha,
      parityControlSha256: bindingBefore.parityControlSha256,
      parityControlFileCount: bindingBefore.parityControlFileCount,
      sourceCommitBound: true,
      migrationReplayCommitBound: true,
    },
    runtimeRole,
    catalog: {
      targetSha256,
      referenceSha256,
      matched: true,
      snapshotIsolation: "repeatable read",
      targetReadOnly: true,
      referenceReadOnly: true,
      components: comparison.map((component) => ({ ...component, matched: true })),
    },
    applicationBinding,
    verdict: "verified",
  };
  const issues = findDesignLabDatabaseParityIssues(report, bindingBefore);
  if (issues.length > 0) {
    throw new Error(`Database parity evidence is invalid:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
  }
  return report;
}


function isMainModule() {
  return Boolean(
    process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url),
  );
}

/**
 * Accepts either no CLI arguments or one --validate-existing flag.
 * Any unknown, duplicate, or mixed argument fails before source binding or database I/O.
 */
export function parseDesignLabDatabaseParityArguments(args: readonly string[]) {
  if (args.length === 0) return false;
  if (args.length === 1 && args[0] === "--validate-existing") return true;
  throw new Error(
    `Unsupported database parity argument(s): ${args.join(", ")}. The evidence path is fixed.`,
  );
}

/** Writes complete evidence to a private temporary file, flushes it, then atomically replaces the target. */
export function writeDesignLabDatabaseParityReportAtomic(
  outputPath: string,
  reportJson: string,
) {
  mkdirSync(dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.tmp-${process.pid}-${randomUUID()}`;
  let descriptor: number | undefined;
  try {
    descriptor = openSync(temporaryPath, "wx", 0o600);
    writeFileSync(descriptor, reportJson, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    renameSync(temporaryPath, outputPath);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    rmSync(temporaryPath, { force: true });
  }
}

async function main() {
  const repositoryRoot = resolve(".");
  const validateExisting = parseDesignLabDatabaseParityArguments(
    process.argv.slice(2),
  );
  const outputPath = resolve(repositoryRoot, DESIGN_LAB_DATABASE_PARITY_PATH);
  const binding = getCurrentDesignLabDatabaseParityBinding(repositoryRoot);
  if (validateExisting) {
    const integrityIssues = findRepositoryCommitBindingIssues(repositoryRoot, [
      DESIGN_LAB_DATABASE_PARITY_PATH,
    ]);
    if (integrityIssues.length > 0) {
      throw new Error(
        `Existing Design Lab database evidence is not exactly committed at HEAD:\n${integrityIssues.map((issue) => `- ${issue}`).join("\n")}`,
      );
    }
    const evidence = JSON.parse(readFileSync(outputPath, "utf8")) as unknown;
    const validationBinding = bindCurrentParityStateToAuditedCommit(
      repositoryRoot,
      evidenceTestedCommitSha(evidence),
      binding,
    );
    const issues = findDesignLabDatabaseParityIssues(
      evidence,
      validationBinding,
    );
    if (issues.length > 0) {
      throw new Error(`Existing Design Lab database evidence is invalid:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
    }
    console.log("Design Lab database parity evidence is valid and source-bound.");
    return;
  }

  const adminUrl =
    process.env.DESIGN_LAB_DATABASE_ADMIN_URL ??
    "postgresql://postgres@127.0.0.1:55735/greyhoundiq";
  const runtimeUrl =
    process.env.DESIGN_LAB_DATABASE_RUNTIME_URL ??
    `postgresql://${DESIGN_LAB_RUNTIME_ROLE}@127.0.0.1:55735/greyhoundiq?application_name=${DESIGN_LAB_APPLICATION_NAME}`;
  const referenceUrl =
    process.env.DESIGN_LAB_REFERENCE_DATABASE_URL ??
    "postgresql://postgres@127.0.0.1:55734/greyhoundiq";
  const baseUrl = process.env.DESIGN_LAB_BASE_URL ?? "http://127.0.0.1:3000";
  const report = await collectReport(
    repositoryRoot,
    adminUrl,
    runtimeUrl,
    referenceUrl,
    baseUrl,
  );
  writeDesignLabDatabaseParityReportAtomic(
    outputPath,
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(
    `Design Lab database parity verified: ${report.sourceBinding.migrationCount} migrations; ${report.catalog.components.length} catalog components; ${report.runtimeRole.applicationTableCount} FORCE-RLS application tables.`,
  );
}

function evidenceTestedCommitSha(value: unknown) {
  if (typeof value !== "object" || value === null) return "";
  const sourceBinding = Reflect.get(value, "sourceBinding") as unknown;
  if (typeof sourceBinding !== "object" || sourceBinding === null) return "";
  const testedCommitSha = Reflect.get(sourceBinding, "testedCommitSha") as unknown;
  return typeof testedCommitSha === "string" ? testedCommitSha : "";
}

if (isMainModule()) {
  main().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  });
}
