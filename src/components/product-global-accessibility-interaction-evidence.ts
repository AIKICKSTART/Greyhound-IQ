import type { ProductMasterEvidenceRecord } from "./master-audit-evidence";

export const PRODUCT_GLOBAL_ACCESSIBILITY_INTERACTION_MASTER_EVIDENCE = {
  "GLOBAL.A11Y.keyboard": {
    status: "verified",
    evidence: [
      "src/components/global-accessibility-interaction.test.ts",
      "src/components/marketplace-dog-player-card.tsx",
      "src/components/media-focal-point-editor.tsx",
      "src/components/recipient-picker.tsx",
    ],
  },
  "GLOBAL.A11Y.focus-restore": {
    status: "verified",
    evidence: [
      "src/components/global-accessibility-interaction.test.ts",
      "src/components/ui/sheet.tsx",
    ],
  },
  "GLOBAL.A11Y.touch": {
    status: "verified",
    evidence: [
      "src/components/global-accessibility-interaction.test.ts",
      "src/components/ui/button.tsx",
      "src/app/globals.css",
      "src/components/marketplace-dog-player-card.tsx",
    ],
  },
  "GLOBAL.A11Y.colour": {
    status: "verified",
    evidence: [
      "src/components/global-accessibility-interaction.test.ts",
      "src/app/globals.css",
      "src/components/admin/status-pill.tsx",
    ],
  },
} as const satisfies Readonly<Record<string, ProductMasterEvidenceRecord>>;
