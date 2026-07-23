export const CI_ACCESS_ISOLATION_REQUIREMENT_IDS = [
  "security.ci.10.admin-endpoint-accessible-moderator",
  "security.ci.26.design-lab-production-mutation",
] as const;

export const CI_ACCESS_ISOLATION_MASTER_EVIDENCE = {
  "security.ci.10.admin-endpoint-accessible-moderator": {
    status: "verified" as const,
    evidence: [
      ".github/workflows/ci.yml",
      "scripts/run-unit-tests.ts",
      "security/ci-access-isolation-evidence.ts",
      "security/ci-access-isolation-evidence.test.ts",
      "security/frontend-authorization-evidence.test.ts",
      "src/app/admin/admin-authorization-inventory.ts",
      "src/lib/auth.ts",
      "src/lib/auth-roles.ts",
      "src/lib/auth.test.ts",
    ],
  },
  "security.ci.26.design-lab-production-mutation": {
    status: "verified" as const,
    evidence: [
      ".github/workflows/ci.yml",
      "scripts/run-unit-tests.ts",
      "security/ci-access-isolation-evidence.ts",
      "security/ci-access-isolation-evidence.test.ts",
      "security/design-lab-isolation-evidence.test.ts",
      "src/lib/demo-production-isolation.test.ts",
      "src/lib/design-lab-access-policy.ts",
      "src/lib/demo-access.ts",
      "src/proxy.ts",
      "src/app/design-lab/page.tsx",
      "src/components/design-lab-scenario-controls.tsx",
    ],
  },
} as const;

const DESIGN_LAB_MUTATION_PATTERNS = [
  ["SERVER_ACTION_MODULE", /["']use server["']/],
  ["APPLICATION_ACTION_IMPORT", /from\s+["']@\/app\/actions["']/],
  [
    "MUTATING_SERVICE_IMPORT",
    /from\s+["']@\/lib\/(?:db|[^"']*(?:service|repository|storage)[^"']*)["']/,
  ],
  ["PRISMA_IMPORT", /from\s+["']@prisma\/client["']/],
  ["FORM_SERVER_ACTION", /(?:formAction\s*=|<form\b[^>]*\baction\s*=)/i],
  ["NETWORK_REQUEST", /\bfetch\s*\(|\bXMLHttpRequest\b|\.sendBeacon\s*\(/],
] as const;

export function findDesignLabMutationSignals(source: string) {
  return DESIGN_LAB_MUTATION_PATTERNS.filter(([, pattern]) =>
    pattern.test(source),
  ).map(([code]) => code);
}
