import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_STATE_REPRESENTATION_EVIDENCE_FILE =
  "src/components/product-state-representation-evidence.ts" as const;
export const PRODUCT_STATE_REPRESENTATION_TEST_FILE =
  "src/components/product-state-representation-evidence.test.ts" as const;

export const PRODUCT_STATE_REPRESENTATION_REQUIREMENT_IDS = [
  "COMPLETE.EVIDENCE.states-represented",
] as const;

export const PRODUCT_STATE_REPRESENTATION_EXPECTED_GAIN =
  PRODUCT_STATE_REPRESENTATION_REQUIREMENT_IDS.length;

export const PRODUCT_STATE_REPRESENTATION_SCOPE =
  "Deterministic source-static and focused-unit proof that all 97 canonical screen contracts represent at least one meaningful state, all 429 route-scoped state records have non-empty IDs and focused test IDs, every supported-state list exactly matches its state records, and every screen state-coverage record is verified or tested with source and test evidence. This closes representation only. It does not claim a distinct reproducible Design Lab fixture for every state, browser rendering, deployed behavior, provider behavior, user comprehension, or production readiness; VERIFY.GATE.state-fixture remains open.";

type StateRepresentationContract = {
  route: string;
  stateRules: readonly {
    id: string;
    testIds: readonly string[];
  }[];
  supportedStates: readonly string[];
  coverage: {
    states: {
      status: string;
      evidence: readonly string[];
    };
  };
};

export function findStateRepresentationIssues(
  screens: readonly StateRepresentationContract[],
): string[] {
  const issues: string[] = [];
  const seenRoutes = new Set<string>();

  for (const screen of screens) {
    const route = screen.route.trim();
    if (!route) {
      issues.push("screen route is empty");
      continue;
    }
    if (seenRoutes.has(route)) issues.push(`${route}: duplicate route`);
    seenRoutes.add(route);

    if (screen.stateRules.length === 0) {
      issues.push(`${route}: no represented states`);
    }

    const stateIds = screen.stateRules.map(({ id }) => id.trim());
    if (stateIds.some((id) => !id)) {
      issues.push(`${route}: empty state id`);
    }
    if (new Set(stateIds).size !== stateIds.length) {
      issues.push(`${route}: duplicate state id`);
    }
    for (const state of screen.stateRules) {
      if (
        state.testIds.length === 0 ||
        state.testIds.some((testId) => !testId.trim())
      ) {
        issues.push(`${route}:${state.id || "<empty>"}: missing focused test id`);
      }
    }

    if (
      screen.supportedStates.length !== stateIds.length ||
      screen.supportedStates.some((id, index) => id !== stateIds[index])
    ) {
      issues.push(`${route}: supported-state list does not match state records`);
    }

    if (!(["verified", "tested"] as const).includes(
      screen.coverage.states.status as "verified" | "tested",
    )) {
      issues.push(`${route}: state coverage is not complete`);
    }
    const evidence = screen.coverage.states.evidence;
    if (!evidence.some((path) => path.startsWith("src/"))) {
      issues.push(`${route}: state coverage has no source evidence`);
    }
    if (!evidence.some((path) => /\.test\.tsx?$/.test(path))) {
      issues.push(`${route}: state coverage has no focused test evidence`);
    }
  }

  return issues;
}

type ProductStateRepresentationEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

export const PRODUCT_STATE_REPRESENTATION_MASTER_EVIDENCE = {
  "COMPLETE.EVIDENCE.states-represented": {
    status: "tested",
    evidence: [
      PRODUCT_STATE_REPRESENTATION_EVIDENCE_FILE,
      PRODUCT_STATE_REPRESENTATION_TEST_FILE,
      "src/components/demo-experience-registry.ts",
      "src/components/screen-contracts/screen-state-evidence.test.ts",
      "src/components/screen-contracts/production-screen-messaging-access-state-evidence.test.ts",
      "src/components/screen-contracts/production-screen-member-access-state-evidence.test.ts",
      "src/components/screen-contracts/production-screen-admin-access-state-evidence.test.ts",
    ],
  },
} as const satisfies Readonly<
  Record<
    (typeof PRODUCT_STATE_REPRESENTATION_REQUIREMENT_IDS)[number],
    ProductStateRepresentationEvidenceRecord
  >
>;
