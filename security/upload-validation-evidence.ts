const UPLOAD_VALIDATION_EVIDENCE = [
  "src/app/api/media/sign-upload/route.ts",
  "src/app/api/media/[id]/finalize/route.ts",
  "src/lib/media-validation.ts",
  "src/lib/media-validation.test.ts",
  "src/lib/media-service.ts",
  "src/lib/media-service.test.ts",
  "src/lib/media-sniff.ts",
  "src/lib/media-sniff.test.ts",
  "src/lib/object-storage.ts",
  "src/lib/object-storage.test.ts",
  "src/lib/supabase-object-storage.ts",
  "src/lib/supabase-storage.ts",
  "security/upload-validation-evidence.test.ts",
] as const;

export const UPLOAD_VALIDATION_REQUIREMENT_IDS = [
  "security.upload-validation.authentication",
  "security.upload-validation.ownership",
  "security.upload-validation.permission",
  "security.upload-validation.file-size-limit",
  "security.upload-validation.claimed-mime-type",
  "security.upload-validation.detected-content-type",
  "security.upload-validation.file-signature-or-magic-bytes",
  "security.upload-validation.allowed-extension",
  "security.upload-validation.archive-contents-if-archives-are-allowed",
  "security.upload-validation.file-name-normalization",
  "security.upload-validation.object-key-generation",
  "security.upload-validation.metadata",
  "security.upload-validation.processing-timeout",
  "security.upload-validation.allowed-dimensions",
  "security.upload-validation.media-duration",
] as const;

export const UPLOAD_VALIDATION_REMAINING_REQUIREMENT_IDS = [] as const;

export const UPLOAD_VALIDATION_EVIDENCE_SCOPE =
  "Source-backed verification of the authenticated signed-upload, stored-object finalize, and asynchronous scan/processing pipeline. Archives are rejected rather than inspected. Server-decoded stored content enforces dimension ceilings and duration ceilings before derivative processing, with client metadata treated only as a claim that must match. This evidence does not claim deployed storage-provider behavior, scanner availability, or a production upload result.";

export const UPLOAD_VALIDATION_MASTER_EVIDENCE = Object.fromEntries(
  UPLOAD_VALIDATION_REQUIREMENT_IDS.map((requirementId) => [
    requirementId,
    { status: "verified" as const, evidence: UPLOAD_VALIDATION_EVIDENCE },
  ]),
);
