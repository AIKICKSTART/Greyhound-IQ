const SUPPLY_CHAIN_ADDITIONAL_EVIDENCE = [
  "package.json",
  "package-lock.json",
  ".github/dependabot.yml",
  ".github/CODEOWNERS",
  ".github/workflows/ci.yml",
  "scripts/check-supply-chain-policy.ts",
  "scripts/check-supply-chain-policy.test.ts",
  "security/supply-chain-additional-evidence.test.ts",
] as const;

const VERIFIED_SUPPLY_CHAIN_ADDITIONAL_IDS = [
  "security.supply-chain-control.package-provenance",
  "security.supply-chain-control.dependency-update-process",
  "security.supply-chain-control.security-sensitive-code-ownership",
] as const;

export const SUPPLY_CHAIN_ADDITIONAL_MASTER_EVIDENCE = Object.fromEntries(
  VERIFIED_SUPPLY_CHAIN_ADDITIONAL_IDS.map((requirementId) => [
    requirementId,
    {
      status: "verified" as const,
      evidence: SUPPLY_CHAIN_ADDITIONAL_EVIDENCE,
    },
  ]),
);
