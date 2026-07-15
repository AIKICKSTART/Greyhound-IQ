import { INTERNAL_PACKAGE_PUBLISHING_JUSTIFICATION } from "./supply-chain-dependency-review";

export const VERIFIED_SUPPLY_CHAIN_REVIEW_IDS = [
  "security.supply-chain-review.install-scripts",
  "security.supply-chain-review.post-install-scripts",
  "security.supply-chain-review.direct-url-dependencies",
  "security.supply-chain-review.git-dependencies",
  "security.supply-chain-review.unmaintained-packages",
  "security.supply-chain-review.duplicate-libraries",
  "security.supply-chain-review.runtime-dependencies-used-only-for-development",
  "security.supply-chain-review.public-package-name-confusion",
  "security.supply-chain-review.ci-action-pinning",
  "security.supply-chain-review.container-base-images",
  "security.supply-chain-review.transitive-dependencies",
  "security.supply-chain-review.scan-not-proof",
] as const;

const SUPPLY_CHAIN_REVIEW_EVIDENCE = [
  "docs/security/supply-chain-review.md",
  "scripts/check-supply-chain-policy.ts",
  "scripts/check-supply-chain-policy.test.ts",
  "scripts/capture-supply-chain-review.ts",
  "security/supply-chain-dependency-review.ts",
  "security/supply-chain-review.snapshot.json",
  "security/supply-chain-review-evidence.test.ts",
  ".github/workflows/ci.yml",
  "package-lock.json",
  "Dockerfile",
] as const;

type SupplyChainReviewEvidenceRecord = {
  status: "verified" | "not-applicable-with-justification";
  evidence: typeof SUPPLY_CHAIN_REVIEW_EVIDENCE;
  notApplicableJustification?: string;
};

export const SUPPLY_CHAIN_REVIEW_MASTER_EVIDENCE: Readonly<
  Record<string, SupplyChainReviewEvidenceRecord>
> = {
  ...Object.fromEntries(
    VERIFIED_SUPPLY_CHAIN_REVIEW_IDS.map((id) => [
      id,
      {
        status: "verified" as const,
        evidence: SUPPLY_CHAIN_REVIEW_EVIDENCE,
      },
    ]),
  ),
  "security.supply-chain-review.internal-package-publishing": {
    status: "not-applicable-with-justification" as const,
    evidence: SUPPLY_CHAIN_REVIEW_EVIDENCE,
    notApplicableJustification: INTERNAL_PACKAGE_PUBLISHING_JUSTIFICATION,
  },
};
