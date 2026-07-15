const UPLOAD_UNTRUSTED_CLAIM_EVIDENCE = [
  "src/lib/media-validation.ts",
  "src/lib/media-service.ts",
  "src/lib/media-service.test.ts",
  "src/lib/object-storage.ts",
  "src/lib/object-storage.test.ts",
  "src/lib/media-sniff.ts",
  "src/lib/media-sniff.test.ts",
  "src/app/api/media/sign-upload/route.ts",
  "src/app/api/media/[id]/finalize/route.ts",
  "security/upload-untrusted-claim-evidence.test.ts",
] as const;

const VERIFIED_UPLOAD_UNTRUSTED_CLAIM_IDS = [
  "security.upload-untrusted-claim.filename",
  "security.upload-untrusted-claim.mime",
  "security.upload-untrusted-claim.path",
  "security.upload-untrusted-claim.success",
] as const;

export const UPLOAD_UNTRUSTED_CLAIM_MASTER_EVIDENCE = Object.fromEntries(
  VERIFIED_UPLOAD_UNTRUSTED_CLAIM_IDS.map((requirementId) => [
    requirementId,
    {
      status: "verified" as const,
      evidence: UPLOAD_UNTRUSTED_CLAIM_EVIDENCE,
    },
  ]),
);
