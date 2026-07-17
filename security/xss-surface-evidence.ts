import {
  XSS_IMPLEMENTATION_CONTROL_REQUIREMENT_IDS,
  XSS_SURFACE_REVIEW_RECORDS,
  type XssImplementationControlRequirementId,
  type XssSurfaceReviewRequirementId,
} from "./xss-surface-review";

export const XSS_SURFACE_EVIDENCE_SCOPE =
  "source-sink-inventory-and-runtime-render-regression" as const;

const XSS_REVIEW_EVIDENCE_PATHS = [
  "security/xss-surface-review.ts",
  "security/xss-surface-evidence.ts",
  "security/xss-surface-evidence.test.ts",
] as const;

export const XSS_ALLOWLIST_SANITIZER_NOT_APPLICABLE =
  "No stored, imported, Markdown, or rich-text value is rendered as HTML. The only approved raw sink emits serialized JSON-LD, so an HTML allowlist sanitizer has no applicable content boundary." as const;

const XSS_IMPLEMENTATION_EVIDENCE_PATHS = [
  ...XSS_REVIEW_EVIDENCE_PATHS,
  "src/components/json-ld.tsx",
  "src/components/json-ld.test.ts",
  "src/components/feed-post-card.tsx",
  "src/lib/link-preview.ts",
  "src/lib/live/raw-sanitizer.ts",
] as const;

export type XssSurfaceMasterEvidenceRecord = {
  readonly status: "verified";
  readonly evidence: readonly string[];
};

/**
 * Surface evidence proves the explicit source review recorded in
 * xss-surface-review.ts. Implementation evidence is separate and is backed by
 * the exhaustive production-source sink inventory plus the runtime render
 * fixture matrix in xss-surface-evidence.test.ts.
 */
export const XSS_SURFACE_REVIEW_MASTER_EVIDENCE: Readonly<
  Record<XssSurfaceReviewRequirementId, XssSurfaceMasterEvidenceRecord>
> = Object.fromEntries(
  XSS_SURFACE_REVIEW_RECORDS.map((record) => [
    record.requirementId,
    {
      status: "verified" as const,
      evidence: [
        ...XSS_REVIEW_EVIDENCE_PATHS,
        ...new Set(
          [...record.sourceAnchors, ...record.renderAnchors].map(
            (anchor) => anchor.path,
          ),
        ),
      ],
    },
  ]),
) as unknown as Record<
  XssSurfaceReviewRequirementId,
  XssSurfaceMasterEvidenceRecord
>;

export const XSS_IMPLEMENTATION_CONTROL_MASTER_EVIDENCE: Readonly<
  Record<XssImplementationControlRequirementId, XssSurfaceMasterEvidenceRecord>
> = Object.fromEntries(
  XSS_IMPLEMENTATION_CONTROL_REQUIREMENT_IDS.map((requirementId) => [
    requirementId,
    {
      status: "verified" as const,
      evidence: XSS_IMPLEMENTATION_EVIDENCE_PATHS,
    },
  ]),
) as unknown as Record<
  XssImplementationControlRequirementId,
  XssSurfaceMasterEvidenceRecord
>;
