import { SECRET_INVENTORY } from "./secret-inventory";

export const SECRET_RECORD_FIELD_REQUIREMENT_IDS = [
  "security.secret-record.field.owner",
  "security.secret-record.field.purpose",
  "security.secret-record.field.environment",
  "security.secret-record.field.storage",
  "security.secret-record.field.scope",
  "security.secret-record.field.rotation-process",
  "security.secret-record.field.rotation-frequency",
  "security.secret-record.field.revocation-process",
  "security.secret-record.field.last-rotation",
  "security.secret-record.field.services-using-it",
  "security.secret-record.field.logging-exposure",
  "security.secret-record.field.build-time-exposure",
  "security.secret-record.field.client-bundle-exposure",
  "security.secret-record.field.incident-procedure",
] as const;

export const SECRET_INVENTORY_EVIDENCE_PATHS = [
  "security/secret-inventory.ts",
  "security/secret-inventory.test.ts",
  "docs/security/secrets-register.md",
] as const;

/** Inventory completion only; custody, rotation, revocation and release controls remain separate gates. */
export const SECRET_INVENTORY_MASTER_EVIDENCE = Object.fromEntries(
  [
    ...SECRET_INVENTORY.map(({ requirementId }) => requirementId),
    ...SECRET_RECORD_FIELD_REQUIREMENT_IDS,
  ].map((requirementId) => [
    requirementId,
    {
      status: "verified" as const,
      evidence: SECRET_INVENTORY_EVIDENCE_PATHS,
    },
  ]),
);
