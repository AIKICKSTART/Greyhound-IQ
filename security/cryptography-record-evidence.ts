export const CRYPTOGRAPHY_RECORD_REQUIREMENT_IDS = [
  "security.cryptography-record.field.algorithms",
  "security.cryptography-record.field.key-sizes",
  "security.cryptography-record.field.key-storage",
  "security.cryptography-record.field.rotation",
  "security.cryptography-record.field.nonce-handling",
  "security.cryptography-record.field.token-signing",
  "security.cryptography-record.field.password-hashing-where-applicable",
  "security.cryptography-record.field.data-encryption",
  "security.cryptography-record.field.backup-encryption",
  "security.cryptography-record.field.tls-configuration",
] as const;

const CRYPTOGRAPHY_RECORD_EVIDENCE = [
  "security/cryptography-record.ts",
  "security/cryptography-record.test.ts",
] as const;

/** Structural documentation completion; each field retains its real operational status. */
export const CRYPTOGRAPHY_RECORD_MASTER_EVIDENCE = Object.fromEntries(
  CRYPTOGRAPHY_RECORD_REQUIREMENT_IDS.map((requirementId) => [
    requirementId,
    {
      status: "verified" as const,
      evidence: CRYPTOGRAPHY_RECORD_EVIDENCE,
    },
  ]),
);
