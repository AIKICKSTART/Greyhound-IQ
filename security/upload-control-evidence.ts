const UPLOAD_CONTROL_EVIDENCE = [
  "src/lib/media-validation.ts",
  "src/lib/media-service.ts",
  "src/lib/media-service.test.ts",
  "src/lib/media-sniff.ts",
  "src/lib/media-sniff.test.ts",
  "src/lib/object-storage.ts",
  "src/lib/object-storage.test.ts",
  "src/lib/gcs-object-storage.ts",
  "src/lib/gcs-object-storage.test.ts",
  "src/lib/supabase-object-storage.ts",
  "src/lib/supabase-storage.ts",
  "security/upload-untrusted-claim-evidence.test.ts",
  "security/upload-control-evidence.test.ts",
] as const;

const VERIFIED_UPLOAD_CONTROL_IDS = [
  "security.upload-control.server-generated-storage-keys",
  "security.upload-control.storage-outside-executable-application-paths",
  "security.upload-control.private-storage-by-default",
  "security.upload-control.short-lived-signed-access-where-required",
  "security.upload-control.malware-or-unsafe-content-scanning-where-appropriate",
  "security.upload-control.image-re-encoding-where-appropriate",
  "security.upload-control.metadata-stripping-where-appropriate",
  "security.upload-control.safe-thumbnail-generation",
  "security.upload-control.quarantine-until-checks-complete",
  "security.upload-control.recovery-from-failed-processing",
  "security.upload-control.deletion-of-abandoned-uploads",
  "security.upload-control.audit-evidence",
] as const;

export const UPLOAD_CONTROL_MASTER_EVIDENCE = Object.fromEntries(
  VERIFIED_UPLOAD_CONTROL_IDS.map((requirementId) => [
    requirementId,
    { status: "verified" as const, evidence: UPLOAD_CONTROL_EVIDENCE },
  ]),
);
