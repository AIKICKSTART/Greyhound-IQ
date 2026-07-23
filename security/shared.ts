export const VERIFICATION_STATUSES = [
  "Verified",
  "Partially verified",
  "Not verified",
  "Control missing",
  "Implementation vulnerable",
  "Test coverage missing",
  "Blocked from release",
  "Risk accepted temporarily",
  "Not applicable with justification",
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export type RegistryEvidence = {
  sourceFile: string;
  sourceSymbol?: string;
  note: string;
};
