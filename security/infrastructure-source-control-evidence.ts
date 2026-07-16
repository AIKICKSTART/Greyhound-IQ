export const VERIFIED_INFRASTRUCTURE_SOURCE_CONTROL_IDS = [
  "security.infrastructure-control.untrusted-pr",
  "security.infrastructure-control.identity-separation",
  "security.infrastructure-control.debug-off",
  "security.infrastructure-control.supported-runtime",
] as const;

const INFRASTRUCTURE_SOURCE_CONTROL_EVIDENCE = [
  ".github/workflows/ci.yml",
  ".github/workflows/cloud-run-deploy.yml",
  "Dockerfile",
  "package.json",
  "node_modules/next/package.json",
  "src/components/design-lab-contract-inspector-prototype.tsx",
  "src/components/prototype-switcher.tsx",
  "security/infrastructure-source-control-evidence.test.ts",
] as const;

export const INFRASTRUCTURE_SOURCE_CONTROL_MASTER_EVIDENCE =
  Object.fromEntries(
    VERIFIED_INFRASTRUCTURE_SOURCE_CONTROL_IDS.map((requirementId) => [
      requirementId,
      {
        status: "verified" as const,
        evidence: INFRASTRUCTURE_SOURCE_CONTROL_EVIDENCE,
      },
    ]),
  );
