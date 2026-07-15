export const MALICIOUS_PACKAGE_DETECTION_REQUIREMENT_ID =
  "security.supply-chain-control.malicious-package-detection";

export const MALICIOUS_PACKAGE_DETECTION_SCOPE =
  "Fail-closed malicious-package indicator control for the complete npm lock inventory: approved registry provenance, immutable versions, SHA-512 integrity, manifest-to-lock agreement, review-snapshot binding, direct-package metadata review, and exact lifecycle-hook allowlisting. It detects unreviewed or suspicious package changes; passing does not prove package code is benign.";

export const MALICIOUS_PACKAGE_DETECTION_MASTER_EVIDENCE = {
  [MALICIOUS_PACKAGE_DETECTION_REQUIREMENT_ID]: {
    status: "verified" as const,
    evidence: [
      "package.json",
      "package-lock.json",
      "security/supply-chain-review.snapshot.json",
      "scripts/check-supply-chain-policy.ts",
      "scripts/check-supply-chain-policy.test.ts",
      "security/dependency-malicious-package-detection-evidence.ts",
      "security/dependency-malicious-package-detection-evidence.test.ts",
    ],
  },
};
