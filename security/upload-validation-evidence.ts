const UPLOAD_VALIDATION_EVIDENCE = [
  "src/app/api/media/sign-upload/route.ts",
  "src/app/api/media/[id]/finalize/route.ts",
  "src/lib/media-validation.ts",
  "src/lib/media-validation.test.ts",
  "src/lib/media-service.ts",
  "src/lib/media-service.test.ts",
  "src/lib/conversation-service.ts",
  "src/lib/listing-service.ts",
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
  "security.resource-control.file-size-limit",
  "security.third-party-response-validation.media",
  "security.release.16.uploads-validated-owned",
  "security.trace.21.message-media-upload",
  "security.trace.28.listing-media-upload",
] as const;

export const UPLOAD_VALIDATION_REMAINING_REQUIREMENT_IDS = [] as const;

export const UPLOAD_VALIDATION_EVIDENCE_SCOPE =
  "Source-backed verification of the authenticated signed-upload, stored-object finalize, asynchronous scan/processing pipeline, and the current-user media attachment boundaries for messages and listings. Archives are rejected rather than inspected. Server-decoded stored content enforces byte ceilings, dimension ceilings, and duration ceilings before derivative processing, with client metadata treated only as a claim that must match. This evidence closes only the exact upload controls and two named media-upload traces below; it does not claim deployed storage-provider behavior, scanner availability, a production upload result, or upload authorization for unlisted workflows.";

type UploadValidationTrace = Readonly<{
  requirementId:
    | "security.trace.21.message-media-upload"
    | "security.trace.28.listing-media-upload";
  actor: string;
  attachmentTarget: "message" | "listing";
  steps: readonly Readonly<{
    sourceFile: string;
    sourceSymbol: string;
    input: string;
    output: string;
    trustBoundary: string;
    securityControl: string;
    failure: string;
    test: string;
  }>[];
}>;

const UPLOAD_VALIDATION_TEST = "security/upload-validation-evidence.test.ts";

export const UPLOAD_VALIDATION_TRACES: readonly UploadValidationTrace[] = [
  {
    requirementId: "security.trace.21.message-media-upload",
    actor: "Authenticated member uploading private media and attaching it to a conversation message",
    attachmentTarget: "message",
    steps: [
      {
        sourceFile: "src/app/api/media/sign-upload/route.ts",
        sourceSymbol: "POST",
        input: "Bounded filename, MIME type, byte count, and messages media context",
        output: "Short-lived signed upload grant for a server-generated private quarantine key",
        trustBoundary: "Browser request to authenticated signed-upload endpoint",
        securityControl: "requireCurrentUserProfile, strict mediaSignUploadSchema, and fail-closed rate limit",
        failure: "Invalid identity, schema, size, context, quota, or limiter state prevents grant creation",
        test: UPLOAD_VALIDATION_TEST,
      },
      {
        sourceFile: "src/lib/media-service.ts",
        sourceSymbol: "finalizeMediaUpload",
        input: "Media id, current server user, and claimed finalize metadata",
        output: "Owner-scoped media record whose stored bytes and object size have been revalidated",
        trustBoundary: "Application service to private object storage and request-scoped database",
        securityControl: "uploaderId predicate, object size ceiling, MIME magic-byte check, and pending scan state",
        failure: "Foreign, missing, oversized, mismatched, infected, or failed media is denied before readiness",
        test: UPLOAD_VALIDATION_TEST,
      },
      {
        sourceFile: "src/lib/conversation-service.ts",
        sourceSymbol: "sendConversationMessage",
        input: "Up to four media ids supplied with a message",
        output: "Message links only current-user, private, non-failed media records",
        trustBoundary: "Authenticated message service to media ownership boundary",
        securityControl: "assertMediaAttachable binds every id to current.dbUserId and the private bucket",
        failure: "Foreign, duplicate, excessive, infected, or failed media blocks message creation",
        test: UPLOAD_VALIDATION_TEST,
      },
    ],
  },
  {
    requirementId: "security.trace.28.listing-media-upload",
    actor: "Authenticated seller uploading private media and attaching it to an owned marketplace listing",
    attachmentTarget: "listing",
    steps: [
      {
        sourceFile: "src/app/api/media/sign-upload/route.ts",
        sourceSymbol: "POST",
        input: "Bounded filename, MIME type, byte count, and listings media context",
        output: "Short-lived signed upload grant for a server-generated private quarantine key",
        trustBoundary: "Browser request to authenticated signed-upload endpoint",
        securityControl: "requireCurrentUserProfile, strict mediaSignUploadSchema, and fail-closed rate limit",
        failure: "Invalid identity, schema, size, context, quota, or limiter state prevents grant creation",
        test: UPLOAD_VALIDATION_TEST,
      },
      {
        sourceFile: "src/lib/media-service.ts",
        sourceSymbol: "finalizeMediaUpload",
        input: "Media id, current server user, and claimed finalize metadata",
        output: "Owner-scoped media record whose stored bytes and object size have been revalidated",
        trustBoundary: "Application service to private object storage and request-scoped database",
        securityControl: "uploaderId predicate, object size ceiling, MIME magic-byte check, and pending scan state",
        failure: "Foreign, missing, oversized, mismatched, infected, or failed media is denied before readiness",
        test: UPLOAD_VALIDATION_TEST,
      },
      {
        sourceFile: "src/lib/listing-service.ts",
        sourceSymbol: "assertListingMediaAttachable",
        input: "Up to eleven media ids supplied for a listing mutation",
        output: "Listing media set containing only current-user attachable records allowed by listing policy",
        trustBoundary: "Authenticated listing service to media ownership and listing-media policy boundary",
        securityControl: "assertMediaAttachable binds every id to current.dbUserId before assertListingMediaPolicy",
        failure: "Foreign, duplicate, excessive, non-ready, or policy-incompatible media blocks listing mutation",
        test: UPLOAD_VALIDATION_TEST,
      },
    ],
  },
] as const;

export const UPLOAD_VALIDATION_MASTER_EVIDENCE = Object.fromEntries(
  UPLOAD_VALIDATION_REQUIREMENT_IDS.map((requirementId) => [
    requirementId,
    { status: "verified" as const, evidence: UPLOAD_VALIDATION_EVIDENCE },
  ]),
);
