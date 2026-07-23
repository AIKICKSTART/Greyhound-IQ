import type { RegistryEvidence, VerificationStatus } from "./shared";

export type DataClassificationContract = {
  id: string;
  name: string;
  description: string;
  personalInformation: boolean;
  sensitiveInformation: boolean;
  permittedLogs: string;
  retentionPolicy: string;
  evidence: RegistryEvidence[];
  owner: string;
  verificationStatus: VerificationStatus;
};

export const DATA_CLASSIFICATIONS = [
  {
    id: "PUBLIC",
    name: "Public",
    description: "Content intentionally available without authentication.",
    personalInformation: false,
    sensitiveInformation: false,
    permittedLogs: "Ordinary request metadata; no credentials or private content.",
    retentionPolicy: "Not verified.",
    evidence: [],
    owner: "product-security",
    verificationStatus: "Not verified",
  },
  {
    id: "INTERNAL",
    name: "Internal",
    description: "Operational implementation and service metadata not intended for users.",
    personalInformation: false,
    sensitiveInformation: false,
    permittedLogs: "Only sanitized operational metadata.",
    retentionPolicy: "Not verified.",
    evidence: [],
    owner: "platform-security",
    verificationStatus: "Not verified",
  },
  {
    id: "SYNTHETIC_PRIVATE",
    name: "Synthetic private fixture data",
    description:
      "Source-controlled fictional identities and private product content created only for isolated Design Lab databases.",
    personalInformation: false,
    sensitiveInformation: false,
    permittedLogs:
      "Reserved demo-* identifiers, fixture counts and deterministic hashes; never database credentials or provider payloads.",
    retentionPolicy:
      "Delete with the isolated Design Lab database; never promote or copy these rows into production.",
    evidence: [
      {
        sourceFile: "scripts/demo-route-fixture-contract.ts",
        sourceSymbol: "DEMO_FIXTURE_MANIFEST",
        note: "The typed manifest reserves deterministic demo-* identifiers and .test identities for the private fixture graph.",
      },
      {
        sourceFile: "security/local-data-policy.ts",
        sourceSymbol: "SYNTHETIC_ONLY_MODELS",
        note: "Every synthetic-only Prisma model maps to this classification and denies production database copies.",
      },
    ],
    owner: "privacy-and-design-lab",
    verificationStatus: "Partially verified",
  },
  {
    id: "PERSONAL",
    name: "Personal information",
    description: "Information about an identified or reasonably identifiable person.",
    personalInformation: true,
    sensitiveInformation: false,
    permittedLogs: "Identifiers only where operationally necessary; no content values.",
    retentionPolicy: "Not verified against the product retention schedule.",
    evidence: [],
    owner: "privacy",
    verificationStatus: "Not verified",
  },
  {
    id: "AUTHENTICATION",
    name: "Authentication data",
    description: "Session, callback, identity-provider and recovery security data.",
    personalInformation: true,
    sensitiveInformation: true,
    permittedLogs: "Outcome, safe reason and correlation ID only; never tokens or provider payloads.",
    retentionPolicy: "Not verified.",
    evidence: [
      {
        sourceFile: "src/app/callback/route.ts",
        sourceSymbol: "GET.onError",
        note: "Callback failure logging records a reason and generated reference, not the provider payload.",
      },
    ],
    owner: "identity-security",
    verificationStatus: "Partially verified",
  },
  {
    id: "FINANCIAL",
    name: "Billing and financial data",
    description: "Subscription, invoice, payment-provider and entitlement records.",
    personalInformation: true,
    sensitiveInformation: true,
    permittedLogs: "Provider event identifiers and safe status only; never card data or webhook signatures.",
    retentionPolicy: "Not verified.",
    evidence: [
      {
        sourceFile: "src/app/api/webhooks/stripe/route.ts",
        sourceSymbol: "POST",
        note: "The public response is reduced to outcome and duplicate status.",
      },
    ],
    owner: "billing-security",
    verificationStatus: "Partially verified",
  },
  {
    id: "PRIVATE_COMMUNICATION",
    name: "Private communication",
    description: "Conversation membership, messages, call metadata and relationship controls.",
    personalInformation: true,
    sensitiveInformation: true,
    permittedLogs: "Opaque object identifiers and outcomes; no message body or private media content.",
    retentionPolicy: "Not verified.",
    evidence: [],
    owner: "community-security",
    verificationStatus: "Not verified",
  },
  {
    id: "USER_MEDIA",
    name: "User media",
    description: "Uploaded objects, derived media and associated metadata.",
    personalInformation: true,
    sensitiveInformation: true,
    permittedLogs: "Opaque media ID, bucket and generated object path only when required; never bytes.",
    retentionPolicy: "Not verified.",
    evidence: [
      {
        sourceFile: "src/lib/media-service.ts",
        sourceSymbol: "deleteMediaForCurrentUser",
        note: "Deletion audit metadata records storage coordinates, not file content.",
      },
    ],
    owner: "media-security",
    verificationStatus: "Partially verified",
  },
  {
    id: "AUDIT_SECURITY",
    name: "Audit and security telemetry",
    description: "Security-relevant events and append-oriented application audit records.",
    personalInformation: true,
    sensitiveInformation: true,
    permittedLogs: "Actor, target, action, outcome and sanitized metadata.",
    retentionPolicy: "Not verified.",
    evidence: [
      {
        sourceFile: "prisma/schema.prisma",
        sourceSymbol: "AuditLog",
        note: "The application schema contains a dedicated audit record model.",
      },
    ],
    owner: "security-operations",
    verificationStatus: "Partially verified",
  },
] as const satisfies readonly DataClassificationContract[];
