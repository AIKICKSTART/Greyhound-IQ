const INPUT_VALIDATION_BOUNDARY_EVIDENCE = [
  "src/lib/json-request.ts",
  "src/lib/json-request.test.ts",
  "security/deserialization-control-evidence.test.ts",
  "security/input-validation-boundary-evidence.test.ts",
] as const;

export const INPUT_VALIDATION_BOUNDARY_REQUIREMENT_IDS = [
  "security.input-validation.charset",
  "security.input-validation.array-limit",
  "security.input-validation.depth-limit",
] as const;

export const INPUT_VALIDATION_BOUNDARY_MASTER_EVIDENCE = Object.fromEntries(
  INPUT_VALIDATION_BOUNDARY_REQUIREMENT_IDS.map((requirementId) => [
    requirementId,
    {
      status: "verified" as const,
      evidence: INPUT_VALIDATION_BOUNDARY_EVIDENCE,
    },
  ]),
);
