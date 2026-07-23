import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  assertManifestLockPolicy,
  assertSupplyChainDependencyReview,
  type SupplyChainReviewSnapshot,
} from "../scripts/check-supply-chain-policy";
import {
  MALICIOUS_PACKAGE_DETECTION_MASTER_EVIDENCE,
  MALICIOUS_PACKAGE_DETECTION_REQUIREMENT_ID,
  MALICIOUS_PACKAGE_DETECTION_SCOPE,
} from "./dependency-malicious-package-detection-evidence";

type JsonObject = Record<string, unknown>;

type MaliciousPackageDetectionResult = Readonly<{
  passed: boolean;
  inspectedLockEntries: number;
  issues: readonly string[];
}>;

const manifest = JSON.parse(readFileSync("package.json", "utf8")) as JsonObject;
const lockfile = JSON.parse(
  readFileSync("package-lock.json", "utf8"),
) as JsonObject;
const review = JSON.parse(
  readFileSync("security/supply-chain-review.snapshot.json", "utf8"),
) as SupplyChainReviewSnapshot;

const result = auditMaliciousPackageIndicators(
  manifest,
  lockfile,
  review,
);
assert.equal(result.passed, true, result.issues.join("\n"));
assert.ok(
  result.inspectedLockEntries >= 900,
  "malicious-package indicator inventory must be non-vacuous",
);

const requirement = SECURITY_MASTER_REQUIREMENTS.find(
  ({ id }) => id === MALICIOUS_PACKAGE_DETECTION_REQUIREMENT_ID,
);
assert.ok(requirement, "immutable malicious-package detection requirement missing");
assert.equal(
  requirement.requirement,
  "Create a supply-chain control for malicious-package detection.",
);
const evidence =
  MALICIOUS_PACKAGE_DETECTION_MASTER_EVIDENCE[
    MALICIOUS_PACKAGE_DETECTION_REQUIREMENT_ID
  ];
assert.equal(evidence.status, "verified");
for (const path of evidence.evidence) {
  assert.ok(existsSync(path), `missing malicious-package evidence: ${path}`);
}
assert.match(MALICIOUS_PACKAGE_DETECTION_SCOPE, /does not prove package code is benign/i);

assertRejected(
  mutateLock("node_modules/next", {
    resolved: "https://registry.npmjs.org.evil.test/next.tgz",
  }),
  review,
  "PROVENANCE_OR_INTEGRITY_ANOMALY",
);
assertRejected(
  mutateLock("node_modules/next", { integrity: "sha512-not-a-digest" }),
  review,
  "PROVENANCE_OR_INTEGRITY_ANOMALY",
);
assertRejected(
  lockfile,
  {
    ...review,
    lockReviewHash: "0".repeat(64),
  },
  "REVIEW_OR_LIFECYCLE_ANOMALY",
);
assertRejected(
  lockfile,
  {
    ...review,
    lifecycleScripts: review.lifecycleScripts.map((entry, index) =>
      index === 0
        ? { ...entry, hooks: { postinstall: "node unreviewed.js" } }
        : entry,
    ),
  },
  "REVIEW_OR_LIFECYCLE_ANOMALY",
);

const untrustedManifest = clone(manifest);
const dependencies = asObject(untrustedManifest.dependencies);
dependencies.next = "git+https://example.test/next.git";
const untrustedLockfile = clone(lockfile);
asObject(asObject(untrustedLockfile.packages)[""]).dependencies = dependencies;
assertRejected(
  untrustedLockfile,
  review,
  "PROVENANCE_OR_INTEGRITY_ANOMALY",
  untrustedManifest,
);

assertRejected({}, review, "PROVENANCE_OR_INTEGRITY_ANOMALY");

console.log(
  `Malicious-package indicator control passed: ${result.inspectedLockEntries} lock entries checked; provenance, integrity, snapshot, lifecycle, and vacuous inputs fail closed.`,
);

function assertRejected(
  candidateLockfile: JsonObject,
  candidateReview: SupplyChainReviewSnapshot,
  expectedIssue: string,
  candidateManifest = manifest,
) {
  const audit = auditMaliciousPackageIndicators(
    candidateManifest,
    candidateLockfile,
    candidateReview,
  );
  assert.equal(audit.passed, false, "negative fixture must fail closed");
  assert.ok(
    audit.issues.some((issue) => issue.startsWith(expectedIssue)),
    `${expectedIssue}: ${audit.issues.join(" | ")}`,
  );
}

function auditMaliciousPackageIndicators(
  candidateManifest: JsonObject,
  candidateLockfile: JsonObject,
  candidateReview: SupplyChainReviewSnapshot,
  now = new Date(),
): MaliciousPackageDetectionResult {
  const issues: string[] = [];
  let inspectedLockEntries = 0;

  try {
    inspectedLockEntries = assertManifestLockPolicy(
      candidateManifest,
      candidateLockfile,
    ).lockEntries;
  } catch (error) {
    issues.push(`PROVENANCE_OR_INTEGRITY_ANOMALY:${message(error)}`);
  }

  try {
    assertSupplyChainDependencyReview(
      candidateManifest,
      candidateLockfile,
      candidateReview,
      now,
    );
  } catch (error) {
    issues.push(`REVIEW_OR_LIFECYCLE_ANOMALY:${message(error)}`);
  }

  if (inspectedLockEntries < 1) {
    issues.push("LOCK_INVENTORY_VACUOUS");
  }

  return {
    passed: issues.length === 0,
    inspectedLockEntries,
    issues: [...new Set(issues)].toSorted(),
  };
}

function mutateLock(path: string, patch: JsonObject) {
  const candidate = clone(lockfile);
  const packages = asObject(candidate.packages);
  packages[path] = { ...asObject(packages[path]), ...patch };
  return candidate;
}

function asObject(value: unknown): JsonObject {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  return value as JsonObject;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "UNKNOWN_POLICY_FAILURE";
}
