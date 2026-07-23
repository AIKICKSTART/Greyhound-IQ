export const DEPENDENCY_LICENSE_REVIEW_REQUIREMENT_ID =
  "security.supply-chain-control.license-review";

export type LockfilePackageRecord = Readonly<{
  version?: unknown;
  license?: unknown;
  dev?: unknown;
  optional?: unknown;
}>;

export type LockfileLicenseInput = Readonly<{
  packages?: Readonly<Record<string, LockfilePackageRecord>>;
}>;

export type LicenseReviewDisposition = Readonly<{
  category:
    | "permissive"
    | "notice"
    | "reciprocal-component"
    | "content-attribution"
    | "public-domain";
  review:
    | "approved-package-metadata"
    | "retain-notices"
    | "review-distribution-boundary"
    | "retain-attribution";
}>;

export const REVIEWED_DEPENDENCY_LICENSES = {
  MIT: disposition("permissive", "approved-package-metadata"),
  "Apache-2.0": disposition("notice", "retain-notices"),
  ISC: disposition("permissive", "approved-package-metadata"),
  "BSD-2-Clause": disposition("notice", "retain-notices"),
  "BSD-3-Clause": disposition("notice", "retain-notices"),
  "BlueOak-1.0.0": disposition("permissive", "approved-package-metadata"),
  "0BSD": disposition("public-domain", "approved-package-metadata"),
  "MPL-2.0": disposition(
    "reciprocal-component",
    "review-distribution-boundary",
  ),
  Unlicense: disposition("public-domain", "approved-package-metadata"),
  "(Apache-2.0 AND BSD-3-Clause)": disposition("notice", "retain-notices"),
  "(MIT OR Apache-2.0)": disposition("permissive", "approved-package-metadata"),
  "Apache-2.0 AND LGPL-3.0-or-later": disposition(
    "reciprocal-component",
    "review-distribution-boundary",
  ),
  "LGPL-3.0-or-later": disposition(
    "reciprocal-component",
    "review-distribution-boundary",
  ),
  "Apache-2.0 AND LGPL-3.0-or-later AND MIT": disposition(
    "reciprocal-component",
    "review-distribution-boundary",
  ),
  "Python-2.0": disposition("notice", "retain-notices"),
  "CC-BY-4.0": disposition("content-attribution", "retain-attribution"),
  "CC0-1.0": disposition("public-domain", "approved-package-metadata"),
  "(MIT OR CC0-1.0)": disposition(
    "public-domain",
    "approved-package-metadata",
  ),
} as const satisfies Readonly<Record<string, LicenseReviewDisposition>>;

const REVIEWED_MISSING_LOCK_LICENSE = {
  path: "node_modules/reserved",
  version: "0.1.2",
  dev: true,
  installedManifestLicense: "MIT",
} as const;

export function auditDependencyLicenses(lockfile: LockfileLicenseInput) {
  const packages = lockfile.packages;
  if (!packages || typeof packages !== "object") {
    return {
      records: [],
      issues: ["LOCKFILE_PACKAGES_MISSING"],
    };
  }

  const issues: string[] = [];
  const records: Array<{
    path: string;
    version: string;
    license: string;
    category: LicenseReviewDisposition["category"];
    review: LicenseReviewDisposition["review"];
  }> = [];

  for (const [path, value] of Object.entries(packages).toSorted(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (!path) continue;
    const version = typeof value.version === "string" ? value.version : "";
    if (!version) {
      issues.push(`PACKAGE_VERSION_MISSING:${path}`);
      continue;
    }

    const license = typeof value.license === "string" ? value.license.trim() : "";
    if (!license) {
      if (
        path === REVIEWED_MISSING_LOCK_LICENSE.path &&
        version === REVIEWED_MISSING_LOCK_LICENSE.version &&
        value.dev === REVIEWED_MISSING_LOCK_LICENSE.dev
      ) {
        records.push({
          path,
          version,
          license: REVIEWED_MISSING_LOCK_LICENSE.installedManifestLicense,
          category: "permissive",
          review: "approved-package-metadata",
        });
      } else {
        issues.push(`PACKAGE_LICENSE_MISSING:${path}:${version}`);
      }
      continue;
    }

    const disposition = REVIEWED_DEPENDENCY_LICENSES[license as keyof typeof REVIEWED_DEPENDENCY_LICENSES];
    if (!disposition) {
      issues.push(`PACKAGE_LICENSE_UNREVIEWED:${path}:${version}:${license}`);
      continue;
    }
    records.push({ path, version, license, ...disposition });
  }

  if (records.length === 0) issues.push("LICENSE_REVIEW_VACUOUS");
  return { records, issues: [...new Set(issues)].toSorted() };
}

export const DEPENDENCY_LICENSE_REVIEW_SCOPE =
  "Deterministic package-lock metadata review with an exact license-expression allowlist and one pinned installed-manifest exception. This is an automated change-control boundary, not legal advice or a claim that every distribution obligation is automatically satisfied.";

export const DEPENDENCY_LICENSE_REVIEW_MASTER_EVIDENCE = {
  [DEPENDENCY_LICENSE_REVIEW_REQUIREMENT_ID]: {
    status: "verified" as const,
    evidence: [
      "package-lock.json",
      "scripts/run-unit-tests.ts",
      "security/dependency-license-review-evidence.ts",
      "security/dependency-license-review-evidence.test.ts",
    ],
  },
};

function disposition(
  category: LicenseReviewDisposition["category"],
  review: LicenseReviewDisposition["review"],
): LicenseReviewDisposition {
  return { category, review };
}
