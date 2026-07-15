import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_ACTION_ACCESSIBILITY_BEHAVIOUR_EVIDENCE_FILE =
  "src/components/product-action-accessibility-behaviour-evidence.ts" as const;
export const PRODUCT_ACTION_ACCESSIBILITY_BEHAVIOUR_TEST_FILE =
  "src/components/product-action-accessibility-behaviour-evidence.test.ts" as const;

export const PRODUCT_ACTION_ACCESSIBILITY_BEHAVIOUR_SCOPE =
  "Deterministic source-static verification of keyboard-safe direct activation and visible focus conditions across the current src/app and src/components TSX surface. It rejects unreviewed non-native pointer or mouse activation, positive tab indices, and outline removal without a focus-visible treatment; reviewed custom editor and listbox interactions retain their explicit keyboard contracts. This verifies current source conditions only. It does not establish browser focus traversal, rendered visibility, assistive-technology outcomes, hydrated execution, server authorisation, mutation results, deployed parity, or production readiness.";

export const PRODUCT_ACTION_ACCESSIBILITY_BEHAVIOUR_REQUIREMENT_IDS = [
  "ACTION.BEHAVIOUR.keyboard",
  "ACTION.BEHAVIOUR.focus",
] as const;

export type ProductActionAccessibilityBehaviourRequirementId =
  (typeof PRODUCT_ACTION_ACCESSIBILITY_BEHAVIOUR_REQUIREMENT_IDS)[number];

export const PRODUCT_ACTION_ACCESSIBILITY_BEHAVIOUR_EXPECTED_GAIN =
  PRODUCT_ACTION_ACCESSIBILITY_BEHAVIOUR_REQUIREMENT_IDS.length;

type ProductActionAccessibilityBehaviourEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_ACTION_ACCESSIBILITY_BEHAVIOUR_EVIDENCE_FILE,
  PRODUCT_ACTION_ACCESSIBILITY_BEHAVIOUR_TEST_FILE,
  "src/components/global-accessibility-interaction.test.ts",
  "src/components/marketplace-dog-player-card.tsx",
  "src/components/media-focal-point-editor.tsx",
  "src/components/recipient-picker.tsx",
  "src/app/globals.css",
] as const;

export const PRODUCT_ACTION_ACCESSIBILITY_BEHAVIOUR_MASTER_EVIDENCE =
  Object.fromEntries(
    PRODUCT_ACTION_ACCESSIBILITY_BEHAVIOUR_REQUIREMENT_IDS.map(
      (requirementId) => [
        requirementId,
        { status: "tested" as const, evidence: EVIDENCE },
      ],
    ),
  ) as unknown as Readonly<
    Record<
      ProductActionAccessibilityBehaviourRequirementId,
      ProductActionAccessibilityBehaviourEvidenceRecord
    >
  >;
