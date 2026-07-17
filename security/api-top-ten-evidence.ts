import { API_INVENTORY_MANAGEMENT_EVIDENCE } from "./api-inventory-management-evidence";

export const API_TOP_TEN_LOCALLY_VERIFIED_REQUIREMENT_IDS = [
  "security.api-top-ten.inventory",
] as const;

export const API_TOP_TEN_MASTER_EVIDENCE = Object.fromEntries(
  API_TOP_TEN_LOCALLY_VERIFIED_REQUIREMENT_IDS.map((requirementId) => [
    requirementId,
    {
      status: "verified" as const,
      evidence: [
        ...API_INVENTORY_MANAGEMENT_EVIDENCE,
        "security/api-top-ten-evidence.ts",
        "security/api-top-ten-evidence.test.ts",
      ],
    },
  ]),
);
