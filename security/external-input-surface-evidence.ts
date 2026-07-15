export const EXTERNAL_INPUT_SURFACE_EVIDENCE_TEST =
  "security/external-input-surface-evidence.test.ts";

export const EXTERNAL_INPUT_SURFACE_REQUIREMENT_IDS = [
  "security.external-input-surface.request-bodies",
  "security.external-input-surface.query-strings",
  "security.external-input-surface.path-parameters",
  "security.external-input-surface.headers",
  "security.external-input-surface.cookies",
  "security.external-input-surface.uploaded-files",
  "security.external-input-surface.file-names",
  "security.external-input-surface.urls",
  "security.external-input-surface.webhook-payloads",
  "security.external-input-surface.third-party-api-responses",
  "security.external-input-surface.queue-messages",
  "security.external-input-surface.database-records-originating-from-external-systems",
  "security.external-input-surface.ai-output",
  "security.external-input-surface.search-queries",
  "security.external-input-surface.sort-fields",
  "security.external-input-surface.filter-fields",
  "security.external-input-surface.pagination-tokens",
  "security.external-input-surface.rich-text",
  "security.external-input-surface.markdown",
  "security.external-input-surface.html",
  "security.external-input-surface.media-metadata",
] as const;

export const VERIFIED_EXTERNAL_INPUT_SURFACE_IDS = [
  "security.external-input-surface.cookies",
  "security.external-input-surface.uploaded-files",
  "security.external-input-surface.file-names",
  "security.external-input-surface.webhook-payloads",
  "security.external-input-surface.media-metadata",
] as const;

export type ExternalInputSurfaceFact =
  | "cookieOwnershipRevalidated"
  | "cookieAuthorityExcluded"
  | "uploadIntentValidated"
  | "storedBytesValidated"
  | "uploadPathServerOwned"
  | "fileNameCanonicalized"
  | "webhookDeclaredLengthBounded"
  | "webhookStreamBytesBounded"
  | "webhookOversizeRejectedBeforeVerification"
  | "mediaMetadataValidated";

export type ExternalInputSurfaceFacts = Readonly<
  Record<ExternalInputSurfaceFact, boolean>
>;

export const EXTERNAL_INPUT_SURFACE_FACTS: ExternalInputSurfaceFacts = {
  cookieOwnershipRevalidated: true,
  cookieAuthorityExcluded: true,
  uploadIntentValidated: true,
  storedBytesValidated: true,
  uploadPathServerOwned: true,
  fileNameCanonicalized: true,
  webhookDeclaredLengthBounded: true,
  webhookStreamBytesBounded: true,
  webhookOversizeRejectedBeforeVerification: true,
  mediaMetadataValidated: true,
};

const evidenceByRequirement = {
  "security.external-input-surface.cookies": [
    "src/lib/identity-cookie.ts",
    "src/lib/identity.ts",
    "src/app/actions.ts",
    "src/proxy.ts",
    EXTERNAL_INPUT_SURFACE_EVIDENCE_TEST,
  ],
  "security.external-input-surface.uploaded-files": [
    "src/app/api/media/sign-upload/route.ts",
    "src/app/api/media/[id]/finalize/route.ts",
    "src/app/api/media/[id]/caption/route.ts",
    "src/lib/media-validation.ts",
    "src/lib/media-service.ts",
    "src/lib/object-storage.ts",
    "src/lib/media-sniff.ts",
    "src/lib/media-sniff.test.ts",
    EXTERNAL_INPUT_SURFACE_EVIDENCE_TEST,
  ],
  "security.external-input-surface.file-names": [
    "src/lib/media-validation.ts",
    "src/lib/media-service.ts",
    "src/lib/media-service.test.ts",
    "src/lib/object-storage.ts",
    EXTERNAL_INPUT_SURFACE_EVIDENCE_TEST,
  ],
  "security.external-input-surface.webhook-payloads": [
    "src/lib/webhook-request-body.ts",
    "src/app/api/webhooks/stripe/route.ts",
    "src/app/api/webhooks/lago/route.ts",
    "src/app/api/livekit/webhook/route.ts",
    "security/webhook-request-body-control.test.ts",
    EXTERNAL_INPUT_SURFACE_EVIDENCE_TEST,
  ],
  "security.external-input-surface.media-metadata": [
    "src/app/api/media/[id]/finalize/route.ts",
    "src/app/api/media/[id]/route.ts",
    "src/lib/media-validation.ts",
    "src/lib/media-service.ts",
    "src/lib/media-service.test.ts",
    "src/lib/object-storage.ts",
    EXTERNAL_INPUT_SURFACE_EVIDENCE_TEST,
  ],
} as const;

export const OPEN_EXTERNAL_INPUT_SURFACE_GAPS: Readonly<
  Record<
    Exclude<
      (typeof EXTERNAL_INPUT_SURFACE_REQUIREMENT_IDS)[number],
      (typeof VERIFIED_EXTERNAL_INPUT_SURFACE_IDS)[number]
    >,
    string
  >
> = {
  "security.external-input-surface.request-bodies":
    "The source-derived endpoint registry still marks request schemas as not verified for uncovered handlers; no exhaustive strict-schema proof exists yet.",
  "security.external-input-surface.query-strings":
    "Several handlers still consume query values without one strict boundary schema, including memory kind and report status.",
  "security.external-input-surface.path-parameters":
    "Dynamic route identifiers are commonly passed as raw strings; an exhaustive identifier-schema and length contract is not yet enforced.",
  "security.external-input-surface.headers":
    "Header consumers use several local parsers, but no exhaustive size and canonical-form contract covers every request header used by the application.",
  "security.external-input-surface.urls":
    "Redirect, link-preview, replay, media and profile URL controls are separate; complete source-derived URL-boundary coverage is not yet proven.",
  "security.external-input-surface.third-party-api-responses":
    "Topaz and the assigned TheDogs, FastTrack and Watchdog boundaries now have bounded runtime validation, but profile, replay, race-replay and remaining non-racing provider responses are not exhaustively proven.",
  "security.external-input-surface.queue-messages":
    "Queue and worker evidence is owned by the dedicated queue-control lane and is intentionally not claimed by this batch.",
  "security.external-input-surface.database-records-originating-from-external-systems":
    "Reviewed racing adapters validate and map bounded records, but complete provenance validation across profile, replay, non-racing and every persisted external feed remains unverified.",
  "security.external-input-surface.ai-output":
    "Current agent output is server-built, but there is no explicit runtime schema boundary for future external model output.",
  "security.external-input-surface.search-queries":
    "Public dog and social discovery search strings are trimmed downstream but do not share an exhaustive server-side maximum-length contract.",
  "security.external-input-surface.sort-fields":
    "Marketplace sort is allowlisted, but no source-derived inventory proves every sort-like external field remains on a fixed identifier allowlist.",
  "security.external-input-surface.filter-fields":
    "Some filters are allowlisted while others, including report status and memory kind, still reach ORM filters as unvalidated strings.",
  "security.external-input-surface.pagination-tokens":
    "Cursor and before tokens do not yet share an exhaustive maximum-length and canonical identifier schema across handlers.",
  "security.external-input-surface.rich-text":
    "Free-text schemas are bounded in many mutations but do not explicitly reject or normalize rich-text markup at every boundary.",
  "security.external-input-surface.markdown":
    "The product has no Markdown renderer dependency, but unsupported Markdown is not explicitly rejected by every free-text boundary.",
  "security.external-input-surface.html":
    "Provider HTML reads are bounded and rendered text is escaped, but raw provider HTML parsing does not constitute an exhaustive input schema.",
};

export function evaluateExternalInputSurfaceFacts(
  facts: ExternalInputSurfaceFacts,
) {
  return {
    "security.external-input-surface.cookies":
      facts.cookieOwnershipRevalidated && facts.cookieAuthorityExcluded,
    "security.external-input-surface.uploaded-files":
      facts.uploadIntentValidated &&
      facts.storedBytesValidated &&
      facts.uploadPathServerOwned,
    "security.external-input-surface.file-names":
      facts.fileNameCanonicalized && facts.uploadPathServerOwned,
    "security.external-input-surface.webhook-payloads":
      facts.webhookDeclaredLengthBounded &&
      facts.webhookStreamBytesBounded &&
      facts.webhookOversizeRejectedBeforeVerification,
    "security.external-input-surface.media-metadata":
      facts.mediaMetadataValidated,
  } as const;
}

export function buildExternalInputSurfaceMasterEvidence(
  facts: ExternalInputSurfaceFacts,
) {
  const evaluation = evaluateExternalInputSurfaceFacts(facts);
  return Object.fromEntries(
    VERIFIED_EXTERNAL_INPUT_SURFACE_IDS.flatMap((requirementId) =>
      evaluation[requirementId]
        ? [
            [
              requirementId,
              {
                status: "verified" as const,
                evidence: evidenceByRequirement[requirementId],
              },
            ],
          ]
        : [],
    ),
  );
}

export const EXTERNAL_INPUT_SURFACE_MASTER_EVIDENCE =
  buildExternalInputSurfaceMasterEvidence(EXTERNAL_INPUT_SURFACE_FACTS);
