import { ENDPOINTS } from "./endpoints";
import {
  BACKGROUND_WORKER_MEMBERS,
  QUEUE_CONSUMER_MEMBERS,
  REALTIME_CONNECTION_MEMBERS,
  SERVER_COMPONENT_DATA_MEMBERS,
} from "./source-surface-inventory";

export type ApiSurfaceInventoryStatus =
  | "verified"
  | "not-applicable-with-justification"
  | "open";

export type ApiSurfaceInventoryRecord = {
  key: string;
  requirementId: `security.api-inventory-surface.${string}`;
  status: ApiSurfaceInventoryStatus;
  boundary: string;
  members: readonly string[];
  justification?: string;
  knownGap?: string;
};

const httpEndpoints = ENDPOINTS.filter((endpoint) => endpoint.protocol === "http");
const serverActions = ENDPOINTS.filter(
  (endpoint) => endpoint.protocol === "server-action",
);
const endpointNames = (predicate: (endpoint: (typeof ENDPOINTS)[number]) => boolean) =>
  ENDPOINTS.filter(predicate).map(
    (endpoint) => `${endpoint.method} ${endpoint.routeOrProcedure}`,
  );

const noSurface = (
  key: string,
  boundary: string,
  justification: string,
): ApiSurfaceInventoryRecord => ({
  key,
  requirementId: `security.api-inventory-surface.${key}`,
  status: "not-applicable-with-justification",
  boundary,
  members: [],
  justification,
});

/**
 * API entry-point classification derived from the exhaustive endpoint registry.
 * "Verified" is an inventory-completeness claim only; it does not promote the
 * authentication, authorization, runtime, or deployment status of a member.
 */
export const API_SURFACE_INVENTORY: readonly ApiSurfaceInventoryRecord[] = [
  {
    key: "rest",
    requirementId: "security.api-inventory-surface.rest",
    status: "verified",
    boundary: "Every exported HTTP method in src/app/**/route.ts.",
    members: httpEndpoints.map(
      (endpoint) => `${endpoint.method} ${endpoint.routeOrProcedure}`,
    ),
  },
  noSurface(
    "graphql",
    "GraphQL handlers and runtime dependencies.",
    "No GraphQL route or GraphQL runtime dependency exists in the application.",
  ),
  noSurface(
    "rpc",
    "tRPC and other RPC handlers.",
    "No tRPC dependency or /rpc application endpoint exists.",
  ),
  {
    key: "server-action",
    requirementId: "security.api-inventory-surface.server-action",
    status: "verified",
    boundary: "Every exported or inline Next.js server action.",
    members: serverActions.map(
      (endpoint) => `${endpoint.method} ${endpoint.routeOrProcedure}`,
    ),
  },
  {
    key: "server-component-data",
    requirementId: "security.api-inventory-surface.server-component-data",
    status: "verified",
    boundary:
      "Every call in a server page module rooted in an imported binding, direct datastore/provider callback client, or fetch. The conservative superset includes pure imported helpers and proves source discovery only.",
    members: SERVER_COMPONENT_DATA_MEMBERS,
  },
  {
    key: "websocket",
    requirementId: "security.api-inventory-surface.websocket",
    status: "verified",
    boundary:
      "Every Supabase Realtime channel construction, direct WebSocket construction, and LiveKit browser Room/connect call in production source; runtime provider and deployment parity remain separate gates.",
    members: REALTIME_CONNECTION_MEMBERS,
  },
  noSurface(
    "sse",
    "Server-sent event responses and EventSource clients.",
    "No text/event-stream response or EventSource runtime client exists.",
  ),
  {
    key: "auth-callback",
    requirementId: "security.api-inventory-surface.auth-callback",
    status: "verified",
    boundary: "Authentication provider callback handlers.",
    members: endpointNames(
      (endpoint) => endpoint.routeOrProcedure === "/callback",
    ),
  },
  {
    key: "oauth-oidc",
    requirementId: "security.api-inventory-surface.oauth-oidc",
    status: "verified",
    boundary: "WorkOS authentication initiation and callback handlers.",
    members: endpointNames((endpoint) =>
      ["/sign-in", "/callback"].includes(endpoint.routeOrProcedure),
    ),
  },
  {
    key: "webhook",
    requirementId: "security.api-inventory-surface.webhook",
    status: "verified",
    boundary: "Provider webhook receivers.",
    members: endpointNames((endpoint) =>
      endpoint.routeOrProcedure.includes("webhook"),
    ),
  },
  {
    key: "upload",
    requirementId: "security.api-inventory-surface.upload",
    status: "verified",
    boundary: "Application-controlled direct-upload negotiation and finalization.",
    members: endpointNames((endpoint) =>
      ["/api/media/sign-upload", "/api/media/[id]/finalize"].includes(
        endpoint.routeOrProcedure,
      ),
    ),
  },
  noSurface(
    "media-transform",
    "Media resize, transcode, thumbnail, or transform APIs.",
    "No application endpoint performs media transformation; caption metadata and AI image generation are separate inventoried surfaces.",
  ),
  {
    key: "download",
    requirementId: "security.api-inventory-surface.download",
    status: "verified",
    boundary: "Private media, replay, and account-export response endpoints.",
    members: endpointNames((endpoint) =>
      [
        "/api/media/[id]/blob",
        "/api/media/[id]/url",
        "/api/replay/stream",
        "/api/users/me/export",
      ].includes(endpoint.routeOrProcedure),
    ),
  },
  {
    key: "export",
    requirementId: "security.api-inventory-surface.export",
    status: "verified",
    boundary: "Member export responses and administrator export creation.",
    members: endpointNames(
      (endpoint) =>
        endpoint.routeOrProcedure === "/api/users/me/export" ||
        endpoint.routeOrProcedure.endsWith("#createAdminExportAction"),
    ),
  },
  {
    key: "internal",
    requirementId: "security.api-inventory-surface.internal",
    status: "verified",
    boundary: "Secret- or identity-protected internal HTTP entry points.",
    members: endpointNames((endpoint) =>
      endpoint.routeOrProcedure.startsWith("/api/internal/"),
    ),
  },
  {
    key: "administration",
    requirementId: "security.api-inventory-surface.administration",
    status: "verified",
    boundary: "Administrator server actions.",
    members: endpointNames(
      (endpoint) => endpoint.sourceFile === "src/app/admin/mutations.ts",
    ),
  },
  {
    key: "worker",
    requirementId: "security.api-inventory-surface.worker",
    status: "verified",
    boundary:
      "Every exported background maintenance, cleanup, sync, or batch-worker entry function in src/lib; runtime scheduling and deployment wiring remain separate gates.",
    members: BACKGROUND_WORKER_MEMBERS,
  },
  {
    key: "cron",
    requirementId: "security.api-inventory-surface.cron",
    status: "verified",
    boundary: "Cloud Scheduler and scheduled workflow HTTP destinations.",
    members: [
      "POST /api/internal/aggregate-refresh",
      "POST /api/internal/call-maintenance",
      "POST /api/internal/dog-profile-sync",
      "POST /api/internal/listing-expiry",
      "POST /api/internal/live-sync",
      "POST /api/internal/media-maintenance",
      "POST /api/internal/notification-delivery",
    ],
  },
  {
    key: "queue-consumer",
    requirementId: "security.api-inventory-surface.queue-consumer",
    status: "verified",
    boundary:
      "Every source-implemented durable database queue/event consumer entry function. UsageEvent and UsageOutbox are explicitly recorded as unwired source gaps, not silently treated as consumers.",
    members: QUEUE_CONSUMER_MEMBERS,
  },
  {
    key: "ai-tool",
    requirementId: "security.api-inventory-surface.ai-tool",
    status: "verified",
    boundary: "Agent execution, history, cancellation, and AI image generation.",
    members: endpointNames(
      (endpoint) =>
        endpoint.routeOrProcedure.startsWith("/api/agents/") ||
        endpoint.routeOrProcedure.endsWith("#createAgentRun") ||
        endpoint.routeOrProcedure.endsWith("#generateDogCardAction"),
    ),
  },
  noSurface(
    "legacy",
    "Versioned legacy API routes.",
    "Every application endpoint is explicitly unversioned and no /api/vN route exists.",
  ),
  noSurface(
    "development",
    "Development-only API endpoints.",
    "No endpoint is limited to a development environment; Design Lab page access is governed separately.",
  ),
  {
    key: "health",
    requirementId: "security.api-inventory-surface.health",
    status: "verified",
    boundary: "Public health and readiness HTTP endpoints.",
    members: endpointNames((endpoint) =>
      endpoint.routeOrProcedure.startsWith("/api/health"),
    ),
  },
  noSurface(
    "diagnostics",
    "Debug and diagnostic API endpoints.",
    "No /debug or /diagnostics application endpoint exists.",
  ),
  noSurface(
    "metrics",
    "Metrics exposition API endpoints.",
    "No /metrics application endpoint exists; metrics are emitted through managed observability instead.",
  ),
] as const;
