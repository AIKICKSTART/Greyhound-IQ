const DESIGN_LAB_ISOLATION_EVIDENCE = [
  "src/lib/design-lab-access-policy.ts",
  "src/lib/design-lab-access-policy.test.ts",
  "src/lib/design-lab-access.ts",
  "src/lib/demo-access.ts",
  "src/lib/demo-access.test.ts",
  "src/lib/demo-production-isolation.test.ts",
  "src/proxy.ts",
  "src/app/layout.tsx",
  "src/app/design-lab/page.tsx",
  "security/design-lab-isolation-evidence.test.ts",
] as const;

const VERIFIED_DESIGN_LAB_ISOLATION_IDS = [
  "security.threat-design-lab.simulation-only",
  "security.threat-design-lab.no-real-authz-change",
  "security.release.25.design-lab-no-production-data-mutation",
] as const;

export const DESIGN_LAB_ISOLATION_MASTER_EVIDENCE = Object.fromEntries(
  VERIFIED_DESIGN_LAB_ISOLATION_IDS.map((requirementId) => [
    requirementId,
    { status: "verified" as const, evidence: DESIGN_LAB_ISOLATION_EVIDENCE },
  ]),
);
