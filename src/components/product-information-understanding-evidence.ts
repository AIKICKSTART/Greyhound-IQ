import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_INFORMATION_UNDERSTANDING_EVIDENCE_FILE =
  "src/components/product-information-understanding-evidence.ts" as const;
export const PRODUCT_INFORMATION_UNDERSTANDING_TEST_FILE =
  "src/components/product-information-understanding-evidence.test.ts" as const;

export const PRODUCT_INFORMATION_UNDERSTANDING_REQUIREMENT_IDS = [
  "COMPLETE.UNDERSTAND.information",
] as const;

export const PRODUCT_INFORMATION_UNDERSTANDING_EXPECTED_GAIN =
  PRODUCT_INFORMATION_UNDERSTANDING_REQUIREMENT_IDS.length;

export const PRODUCT_INFORMATION_UNDERSTANDING_SCOPE =
  "Deterministic source-static and focused-unit proof for all 90 production-enabled screens. Every screen has a tested route-specific user story with a named actor, trigger, outcome, given/when/then acceptance, and non-empty render assertions; every assertion is present in that screen's exact recursive local source closure. This closes the current production information-understanding contract only. It excludes the six Design Lab-only screens and the production-disabled appearance preview, and does not claim browser rendering, cognitive or usability research, deployed data accuracy, provider behavior, or production readiness.";

export type ProductInformationUnderstandingContract = {
  route: string;
  title: string;
  description: string;
  actor: string;
  trigger: string;
  outcome: string;
  acceptance: {
    given: string;
    when: string;
    then: string;
  };
  renderAssertions: readonly string[];
  sourcePath: string;
  canonicalSourcePath: string;
  storyCoverageStatus: string;
  missingRenderAssertions: readonly string[];
};

export function findInformationUnderstandingIssues(
  contracts: readonly ProductInformationUnderstandingContract[],
): string[] {
  const issues: string[] = [];
  const seenRoutes = new Set<string>();

  for (const contract of contracts) {
    const route = contract.route.trim();
    if (!route) {
      issues.push("screen route is empty");
      continue;
    }
    if (seenRoutes.has(route)) issues.push(`${route}: duplicate screen`);
    seenRoutes.add(route);

    for (const [field, value] of [
      ["title", contract.title],
      ["description", contract.description],
      ["actor", contract.actor],
      ["trigger", contract.trigger],
      ["outcome", contract.outcome],
      ["acceptance.given", contract.acceptance.given],
      ["acceptance.when", contract.acceptance.when],
      ["acceptance.then", contract.acceptance.then],
    ] as const) {
      if (!value.trim()) issues.push(`${route}: ${field} is empty`);
    }

    if (contract.renderAssertions.length === 0) {
      issues.push(`${route}: no information render assertions`);
    }
    if (
      contract.renderAssertions.some((assertion) => !assertion.trim()) ||
      new Set(contract.renderAssertions).size !== contract.renderAssertions.length
    ) {
      issues.push(`${route}: invalid information render assertions`);
    }
    if (contract.sourcePath !== contract.canonicalSourcePath) {
      issues.push(`${route}: story source does not match canonical screen source`);
    }
    if (contract.storyCoverageStatus !== "tested") {
      issues.push(`${route}: user-story coverage is not tested`);
    }
    for (const assertion of contract.missingRenderAssertions) {
      issues.push(`${route}: render assertion missing from source: ${assertion}`);
    }
  }

  return issues;
}

type ProductInformationUnderstandingEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

export const PRODUCT_INFORMATION_UNDERSTANDING_MASTER_EVIDENCE = {
  "COMPLETE.UNDERSTAND.information": {
    status: "tested",
    evidence: [
      PRODUCT_INFORMATION_UNDERSTANDING_EVIDENCE_FILE,
      PRODUCT_INFORMATION_UNDERSTANDING_TEST_FILE,
      "src/components/demo-experience-registry.ts",
    ],
  },
} as const satisfies Readonly<
  Record<
    (typeof PRODUCT_INFORMATION_UNDERSTANDING_REQUIREMENT_IDS)[number],
    ProductInformationUnderstandingEvidenceRecord
  >
>;
