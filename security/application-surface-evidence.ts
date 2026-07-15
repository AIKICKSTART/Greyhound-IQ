export const APPLICATION_SURFACE_INVENTORY_SOURCE =
  "security/application-surface-inventory.ts";
export const APPLICATION_SURFACE_INVENTORY_TEST =
  "security/application-surface-inventory.test.ts";
export const APPLICATION_SURFACE_INVENTORY_DOC =
  "docs/security/application-surface-inventory.md";

export const APPLICATION_SURFACE_EVIDENCE_PATHS = [
  APPLICATION_SURFACE_INVENTORY_SOURCE,
  APPLICATION_SURFACE_INVENTORY_TEST,
  "security/source-surface-inventory.ts",
  "security/source-surface-inventory.test.ts",
  APPLICATION_SURFACE_INVENTORY_DOC,
] as const;

const VERIFIED_APPLICATION_SURFACE_REQUIREMENT_IDS = [
  "security.architecture-application-surface.public-route",
  "security.architecture-application-surface.authenticated-route",
  "security.architecture-application-surface.dynamic-route",
  "security.architecture-application-surface.administration-route",
  "security.architecture-application-surface.api-route",
  "security.architecture-application-surface.route-handler",
  "security.architecture-application-surface.server-action",
  "security.architecture-application-surface.rpc",
  "security.architecture-application-surface.rest",
  "security.architecture-application-surface.websocket",
  "security.architecture-application-surface.websocket-event",
  "security.architecture-application-surface.upload",
  "security.architecture-application-surface.signed-upload",
  "security.architecture-application-surface.download",
  "security.architecture-application-surface.auth-callback",
  "security.architecture-application-surface.payment-return",
  "security.architecture-application-surface.payment-webhook",
  "security.architecture-application-surface.provider-webhook",
  "security.architecture-application-surface.internal-service",
  "security.architecture-application-surface.scheduled-task",
  "security.architecture-application-surface.cron",
  "security.architecture-application-surface.queue-publisher",
  "security.architecture-application-surface.queue-consumer",
  "security.architecture-application-surface.worker",
  "security.architecture-application-surface.database-trigger",
  "security.architecture-application-surface.database-function",
  "security.architecture-application-surface.search-index",
  "security.architecture-application-surface.cache",
  "security.architecture-application-surface.ai-tool",
  "security.architecture-application-surface.admin-cli",
  "security.architecture-application-surface.design-lab-simulation",
  "security.architecture-application-surface.source-search",
  "security.architecture-application-surface.framework-search",
  "security.architecture-application-surface.test-search",
  "security.architecture-application-surface.client-search",
  "security.architecture-application-surface.email-worker-search",
  "security.architecture-application-surface.not-route-folder-only",
] as const;

const NOT_APPLICABLE_APPLICATION_SURFACE_REQUIREMENTS = {
  "security.architecture-application-surface.graphql-query":
    "No GraphQL runtime dependency, handler, or application endpoint exists in the tested source inventory.",
  "security.architecture-application-surface.graphql-mutation":
    "No GraphQL runtime dependency, handler, or application endpoint exists in the tested source inventory.",
  "security.architecture-application-surface.graphql-subscription":
    "No GraphQL runtime dependency, handler, or application endpoint exists in the tested source inventory.",
  "security.architecture-application-surface.trpc":
    "No tRPC runtime dependency or application endpoint exists in the tested source inventory.",
  "security.architecture-application-surface.sse":
    "The tested source inventory found no text/event-stream response or EventSource runtime client.",
  "security.architecture-application-surface.legacy":
    "Every source-inventoried endpoint is unversioned and no /api/vN route exists.",
  "security.architecture-application-surface.deprecated":
    "No API version exists in the exhaustive source route inventory, so no deprecated API version can be enumerated.",
  "security.architecture-application-surface.debug":
    "No /debug or /diagnostics page or HTTP endpoint exists in the exhaustive source route inventories.",
} as const;

/** Client-safe evidence metadata; filesystem discovery remains in the inventory. */
export const APPLICATION_SURFACE_MASTER_EVIDENCE = {
  ...Object.fromEntries(
    VERIFIED_APPLICATION_SURFACE_REQUIREMENT_IDS.map((requirementId) => [
      requirementId,
      { status: "verified", evidence: APPLICATION_SURFACE_EVIDENCE_PATHS },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(NOT_APPLICABLE_APPLICATION_SURFACE_REQUIREMENTS).map(
      ([requirementId, notApplicableJustification]) => [
        requirementId,
        {
          status: "not-applicable-with-justification",
          evidence: APPLICATION_SURFACE_EVIDENCE_PATHS,
          notApplicableJustification,
        },
      ],
    ),
  ),
} as const;
