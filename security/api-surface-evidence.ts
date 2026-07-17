export const API_SURFACE_EVIDENCE_PATHS = [
  "security/api-surface-inventory.ts",
  "security/api-surface-inventory.test.ts",
  "security/source-surface-inventory.ts",
  "security/source-surface-inventory.test.ts",
  "docs/security/api-surface-inventory.md",
] as const;

const VERIFIED_API_SURFACE_REQUIREMENT_IDS = [
  "security.api-inventory-surface.rest",
  "security.api-inventory-surface.server-action",
  "security.api-inventory-surface.server-component-data",
  "security.api-inventory-surface.websocket",
  "security.api-inventory-surface.auth-callback",
  "security.api-inventory-surface.oauth-oidc",
  "security.api-inventory-surface.webhook",
  "security.api-inventory-surface.upload",
  "security.api-inventory-surface.download",
  "security.api-inventory-surface.export",
  "security.api-inventory-surface.internal",
  "security.api-inventory-surface.administration",
  "security.api-inventory-surface.worker",
  "security.api-inventory-surface.cron",
  "security.api-inventory-surface.queue-consumer",
  "security.api-inventory-surface.ai-tool",
  "security.api-inventory-surface.health",
  "security.file-media-inventory.uploads",
  "security.file-media-inventory.downloads",
] as const;

const NOT_APPLICABLE_API_SURFACE_REQUIREMENTS = {
  "security.api-inventory-surface.graphql":
    "No GraphQL route or GraphQL runtime dependency exists in the application.",
  "security.api-inventory-surface.rpc":
    "No tRPC dependency or /rpc application endpoint exists.",
  "security.api-inventory-surface.sse":
    "No text/event-stream response or EventSource runtime client exists.",
  "security.api-inventory-surface.media-transform":
    "No application endpoint performs media transformation; caption metadata and AI image generation are separate inventoried surfaces.",
  "security.api-inventory-surface.legacy":
    "Every application endpoint is explicitly unversioned and no /api/vN route exists.",
  "security.api-inventory-surface.development":
    "No endpoint is limited to a development environment; Design Lab page access is governed separately.",
  "security.api-inventory-surface.diagnostics":
    "No /debug or /diagnostics application endpoint exists.",
  "security.api-inventory-surface.metrics":
    "No /metrics application endpoint exists; metrics are emitted through managed observability instead.",
} as const;

/**
 * Client-safe completion metadata. Filesystem-backed endpoint discovery lives in
 * api-surface-inventory.ts and is intentionally never imported by UI modules.
 */
export const API_SURFACE_MASTER_EVIDENCE = {
  ...Object.fromEntries(
    VERIFIED_API_SURFACE_REQUIREMENT_IDS.map((requirementId) => [
      requirementId,
      { status: "verified", evidence: API_SURFACE_EVIDENCE_PATHS },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(NOT_APPLICABLE_API_SURFACE_REQUIREMENTS).map(
      ([requirementId, notApplicableJustification]) => [
        requirementId,
        {
          status: "not-applicable-with-justification",
          evidence: API_SURFACE_EVIDENCE_PATHS,
          notApplicableJustification,
        },
      ],
    ),
  ),
} as const;
