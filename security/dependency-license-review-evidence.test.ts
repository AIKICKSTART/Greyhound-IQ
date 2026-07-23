import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  DEPENDENCY_LICENSE_REVIEW_MASTER_EVIDENCE,
  DEPENDENCY_LICENSE_REVIEW_REQUIREMENT_ID,
  DEPENDENCY_LICENSE_REVIEW_SCOPE,
  REVIEWED_DEPENDENCY_LICENSES,
  auditDependencyLicenses,
  type LockfileLicenseInput,
} from "./dependency-license-review-evidence";

const lockfile = JSON.parse(
  readFileSync("package-lock.json", "utf8"),
) as LockfileLicenseInput;
const audit = auditDependencyLicenses(lockfile);
assert.deepEqual(audit.issues, []);
assert.ok(audit.records.length >= 900, "license inventory must be non-vacuous");
assert.equal(
  audit.records.length,
  Object.keys(lockfile.packages ?? {}).filter(Boolean).length,
  "every locked package must have a reviewed license disposition",
);
assert.ok(
  audit.records.some(({ category }) => category === "reciprocal-component"),
  "reciprocal component obligations must remain visible",
);
assert.ok(
  audit.records.some(({ category }) => category === "content-attribution"),
  "content attribution obligations must remain visible",
);

const reservedManifest = JSON.parse(
  readFileSync("node_modules/reserved/package.json", "utf8"),
) as { version?: string; license?: string; licenses?: Array<{ type?: string }> };
assert.equal(reservedManifest.version, "0.1.2");
assert.deepEqual(reservedManifest.licenses?.map(({ type }) => type), ["MIT"]);
assert.ok(existsSync("node_modules/reserved/LICENSE-MIT"));

const requirement = SECURITY_MASTER_REQUIREMENTS.find(
  ({ id }) => id === DEPENDENCY_LICENSE_REVIEW_REQUIREMENT_ID,
);
assert.ok(requirement, "immutable dependency license-review requirement missing");
assert.equal(
  requirement.requirement,
  "Create a supply-chain control for license review.",
);
const evidence =
  DEPENDENCY_LICENSE_REVIEW_MASTER_EVIDENCE[
    DEPENDENCY_LICENSE_REVIEW_REQUIREMENT_ID
  ];
assert.equal(evidence.status, "verified");
for (const path of evidence.evidence) {
  assert.ok(existsSync(path), `missing dependency-license evidence: ${path}`);
}
assert.match(DEPENDENCY_LICENSE_REVIEW_SCOPE, /not legal advice/i);
assert.equal(Object.keys(REVIEWED_DEPENDENCY_LICENSES).length, 17);

assertIssue({}, "LOCKFILE_PACKAGES_MISSING");
assertIssue({ packages: {} }, "LICENSE_REVIEW_VACUOUS");
assertIssue(
  { packages: { "node_modules/unknown": { version: "1.0.0" } } },
  "PACKAGE_LICENSE_MISSING:node_modules/unknown:1.0.0",
);
assertIssue(
  {
    packages: {
      "node_modules/unknown": {
        version: "1.0.0",
        license: "LicenseRef-Unknown",
      },
    },
  },
  "PACKAGE_LICENSE_UNREVIEWED:node_modules/unknown:1.0.0:LicenseRef-Unknown",
);
assertIssue(
  {
    packages: {
      "node_modules/reserved": { version: "0.1.3", dev: true },
    },
  },
  "PACKAGE_LICENSE_MISSING:node_modules/reserved:0.1.3",
);
assertIssue(
  {
    packages: {
      "node_modules/reserved": { version: "0.1.2", dev: false },
    },
  },
  "PACKAGE_LICENSE_MISSING:node_modules/reserved:0.1.2",
);

console.log(
  `Dependency license review passed: ${audit.records.length} locked packages classified across ${Object.keys(REVIEWED_DEPENDENCY_LICENSES).length} exact reviewed expressions; missing and unknown licenses fail closed.`,
);

function assertIssue(input: LockfileLicenseInput, expected: string) {
  assert.ok(
    auditDependencyLicenses(input).issues.includes(expected),
    `${expected}: negative fixture must fail closed`,
  );
}
