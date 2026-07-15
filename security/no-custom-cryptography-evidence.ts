export const NO_CUSTOM_CRYPTOGRAPHY_REQUIREMENT_ID =
  "security.secret-control.no-custom-crypto" as const;

export const REVIEWED_APPLICATION_ENCRYPTION_IMPLEMENTATIONS = [
  {
    file: "src/lib/live/replay-proxy.ts",
    purpose: "Authenticated, expiring same-origin replay capabilities",
    primitive: "AES-256-GCM",
    keyDerivation: "HKDF-SHA-256",
    nonce: "96-bit cryptographically random IV per capability",
    authentication: "128-bit GCM tag plus versioned domain AAD",
    decision:
      "Approved use of standard Node.js cryptographic primitives; the versioned envelope is serialization, not a new cipher or protocol algorithm.",
  },
] as const;

export const NO_CUSTOM_CRYPTOGRAPHY_EVIDENCE = [
  "src/lib/live/replay-proxy.ts",
  "src/lib/live/replay-proxy.test.ts",
  "security/no-custom-cryptography-evidence.ts",
  "security/no-custom-cryptography-evidence.test.ts",
  "docs/security/secret-controls.md",
] as const;

export const NO_CUSTOM_CRYPTOGRAPHY_MASTER_EVIDENCE = {
  [NO_CUSTOM_CRYPTOGRAPHY_REQUIREMENT_ID]: {
    status: "verified" as const,
    evidence: NO_CUSTOM_CRYPTOGRAPHY_EVIDENCE,
  },
};
