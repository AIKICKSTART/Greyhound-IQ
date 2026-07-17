import { SCREEN_CONTRACTS } from "../src/components/demo-experience-registry";
import { APPLICATION_SURFACE_INVENTORY_SOURCE } from "./application-surface-evidence";
import { API_SURFACE_INVENTORY } from "./api-surface-inventory";
import { ENDPOINTS, OPENAPI_ENDPOINT_AUTHENTICATION } from "./endpoints";
import {
  ADMIN_CLI_MEMBERS,
  BACKGROUND_WORKER_MEMBERS,
  CACHE_OPERATION_MEMBERS,
  CLIENT_SEARCH_MEMBERS,
  DATABASE_FUNCTION_MEMBERS,
  DATABASE_TRIGGER_MEMBERS,
  EMAIL_WORKER_SEARCH_MEMBERS,
  QUEUE_CONSUMER_MEMBERS,
  QUEUE_PUBLISHER_MEMBERS,
  REALTIME_CONNECTION_MEMBERS,
  REALTIME_EVENT_MEMBERS,
  RPC_CALL_MEMBERS,
  SEARCH_INDEX_OPERATION_MEMBERS,
} from "./source-surface-inventory";

export type ApplicationSurfaceStatus =
  | "verified"
  | "not-applicable-with-justification"
  | "open";

export type ApplicationSurfaceRecord = {
  key: string;
  requirementId: `security.architecture-application-surface.${string}`;
  status: ApplicationSurfaceStatus;
  boundary: string;
  members: readonly string[];
  sourceBasis: readonly string[];
  justification?: string;
  knownGap?: string;
};

const PAGE_REGISTRY_EVIDENCE = [
  "src/components/demo-experience-registry.ts",
  "src/components/product-route-master-evidence.ts",
  "src/components/product-route-master-evidence.test.ts",
  "src/components/product-route-tree-evidence.test.ts",
] as const;
const ENDPOINT_REGISTRY_EVIDENCE = [
  "security/endpoints.ts",
  "security/registry.test.ts",
  "security/api-surface-inventory.ts",
  "security/api-surface-inventory.test.ts",
  "openapi.json",
] as const;
const SCHEDULER_EVIDENCE = [
  "scripts/gcp-cloud-run-deploy.ps1",
  "scripts/gcp-scheduler-sync.sh",
  ".github/workflows/live-sync.yml",
] as const;
const SOURCE_SURFACE_EVIDENCE = [
  "security/source-surface-inventory.ts",
  "security/source-surface-inventory.test.ts",
] as const;
const DATABASE_SURFACE_EVIDENCE = [
  ...SOURCE_SURFACE_EVIDENCE,
  "prisma/migrations",
  "scripts/sql",
  "scripts/check-database-compatibility-inventory.ts",
] as const;

const httpEndpoints = ENDPOINTS.filter((entry) => entry.protocol === "http");
const serverActions = ENDPOINTS.filter(
  (entry) => entry.protocol === "server-action",
);
const pageMembers = (
  predicate: (screen: (typeof SCREEN_CONTRACTS)[number]) => boolean,
) =>
  SCREEN_CONTRACTS.filter(predicate)
    .map((screen) => `PAGE ${screen.route}`)
    .toSorted();
const endpointMembers = (
  predicate: (endpoint: (typeof ENDPOINTS)[number]) => boolean,
) =>
  ENDPOINTS.filter(predicate)
    .map((endpoint) => `${endpoint.method} ${endpoint.routeOrProcedure}`)
    .toSorted();
const openApiMember = (entry: (typeof OPENAPI_ENDPOINT_AUTHENTICATION)[number]) =>
  `${entry.method} ${entry.route}`;
const publicHttpMembers = OPENAPI_ENDPOINT_AUTHENTICATION.filter((entry) =>
  ["public", "optional"].includes(entry.authentication),
).map(openApiMember);
const authenticatedHttpMembers = OPENAPI_ENDPOINT_AUTHENTICATION.filter(
  (entry) => !["public", "optional"].includes(entry.authentication),
).map(openApiMember);

const apiSurfaceByKey = new Map(
  API_SURFACE_INVENTORY.map((record) => [record.key, record]),
);
const apiMembers = (key: string) => {
  const record = apiSurfaceByKey.get(key);
  if (!record || record.status === "open") {
    throw new Error(`application_surface.api_evidence_missing:${key}`);
  }
  return [...record.members].toSorted();
};

const verified = (
  key: string,
  boundary: string,
  members: readonly string[],
  sourceBasis: readonly string[],
): ApplicationSurfaceRecord => ({
  key,
  requirementId: `security.architecture-application-surface.${key}`,
  status: "verified",
  boundary,
  members: [...members].toSorted(),
  sourceBasis,
});

const notApplicable = (
  key: string,
  boundary: string,
  justification: string,
  sourceBasis: readonly string[],
): ApplicationSurfaceRecord => ({
  key,
  requirementId: `security.architecture-application-surface.${key}`,
  status: "not-applicable-with-justification",
  boundary,
  members: [],
  sourceBasis,
  justification,
});

/**
 * Source-static application entry-point decisions. A verified record proves
 * only that the named source boundary is exhaustively inventoried. It does not
 * prove runtime controls, deployment parity, security, or production safety.
 */
export const APPLICATION_SURFACE_INVENTORY: readonly ApplicationSurfaceRecord[] = [
  verified(
    "public-route",
    "Every Next.js page and route-handler method that permits an anonymous request according to the tested page and OpenAPI authentication registries.",
    [
      ...pageMembers((screen) => screen.authentication !== "required"),
      ...publicHttpMembers,
    ],
    [...PAGE_REGISTRY_EVIDENCE, ...ENDPOINT_REGISTRY_EVIDENCE],
  ),
  verified(
    "authenticated-route",
    "Every Next.js page and route-handler method that requires a user, provider, internal, or signed-query identity according to the tested registries.",
    [
      ...pageMembers((screen) => screen.authentication === "required"),
      ...authenticatedHttpMembers,
    ],
    [...PAGE_REGISTRY_EVIDENCE, ...ENDPOINT_REGISTRY_EVIDENCE],
  ),
  verified(
    "dynamic-route",
    "Every registered page or route-handler path with a dynamic segment.",
    [
      ...pageMembers((screen) => screen.dynamicParameters.length > 0),
      ...endpointMembers(
        (endpoint) =>
          endpoint.protocol === "http" && endpoint.routeOrProcedure.includes("["),
      ),
    ],
    [...PAGE_REGISTRY_EVIDENCE, ...ENDPOINT_REGISTRY_EVIDENCE],
  ),
  verified(
    "administration-route",
    "Every registered administrator page route. Administrator server actions remain separately covered by server-action discovery.",
    pageMembers((screen) => screen.route.startsWith("/admin")),
    PAGE_REGISTRY_EVIDENCE,
  ),
  verified(
    "api-route",
    "Every exported HTTP method below /api/.",
    endpointMembers(
      (endpoint) =>
        endpoint.protocol === "http" &&
        endpoint.routeOrProcedure.startsWith("/api/"),
    ),
    ENDPOINT_REGISTRY_EVIDENCE,
  ),
  verified(
    "route-handler",
    "Every exported HTTP method in src/app/**/route.ts, including non-API authentication handlers.",
    endpointMembers((endpoint) => endpoint.protocol === "http"),
    ENDPOINT_REGISTRY_EVIDENCE,
  ),
  verified(
    "server-action",
    "Every exported or inline Next.js server action discovered outside route-handler folders.",
    endpointMembers((endpoint) => endpoint.protocol === "server-action"),
    ENDPOINT_REGISTRY_EVIDENCE,
  ),
  verified(
    "rpc",
    "Every outbound Supabase RPC callsite in production application source. Database routine definitions are inventoried separately; runtime provider parity remains unverified.",
    RPC_CALL_MEMBERS,
    SOURCE_SURFACE_EVIDENCE,
  ),
  notApplicable(
    "graphql-query",
    "GraphQL query entry points.",
    "No GraphQL runtime dependency, handler, or application endpoint exists in the tested source inventory.",
    ["package.json", ...ENDPOINT_REGISTRY_EVIDENCE],
  ),
  notApplicable(
    "graphql-mutation",
    "GraphQL mutation entry points.",
    "No GraphQL runtime dependency, handler, or application endpoint exists in the tested source inventory.",
    ["package.json", ...ENDPOINT_REGISTRY_EVIDENCE],
  ),
  notApplicable(
    "graphql-subscription",
    "GraphQL subscription entry points.",
    "No GraphQL runtime dependency, handler, or application endpoint exists in the tested source inventory.",
    ["package.json", ...ENDPOINT_REGISTRY_EVIDENCE],
  ),
  notApplicable(
    "trpc",
    "tRPC procedures.",
    "No tRPC runtime dependency or application endpoint exists in the tested source inventory.",
    ["package.json", ...ENDPOINT_REGISTRY_EVIDENCE],
  ),
  verified(
    "rest",
    "Every source-discovered HTTP route-handler method.",
    apiMembers("rest"),
    ENDPOINT_REGISTRY_EVIDENCE,
  ),
  verified(
    "websocket",
    "Every Supabase Realtime channel construction, direct WebSocket construction, and LiveKit browser Room/connect call in production source. Runtime provider and deployed connection parity remain unverified.",
    REALTIME_CONNECTION_MEMBERS,
    SOURCE_SURFACE_EVIDENCE,
  ),
  verified(
    "websocket-event",
    "Every source-discovered Supabase publication/subscription event, RealtimeRefresh configured event, LiveKit RoomEvent handler, and LiveKit webhook event branch. Runtime delivery remains unverified.",
    REALTIME_EVENT_MEMBERS,
    SOURCE_SURFACE_EVIDENCE,
  ),
  notApplicable(
    "sse",
    "Server-sent event responses and EventSource clients.",
    "The tested source inventory found no text/event-stream response or EventSource runtime client.",
    ["security/api-surface-inventory.ts", "security/api-surface-inventory.test.ts"],
  ),
  verified(
    "upload",
    "Application-controlled direct-upload negotiation and finalization entry points.",
    apiMembers("upload"),
    ENDPOINT_REGISTRY_EVIDENCE,
  ),
  verified(
    "signed-upload",
    "The server endpoint that creates a constrained signed upload target.",
    apiMembers("upload").filter((member) =>
      member.includes("/api/media/sign-upload"),
    ),
    ENDPOINT_REGISTRY_EVIDENCE,
  ),
  verified(
    "download",
    "Private media, replay, and account-export response endpoints.",
    apiMembers("download"),
    ENDPOINT_REGISTRY_EVIDENCE,
  ),
  verified(
    "auth-callback",
    "Authentication provider callback handlers.",
    apiMembers("auth-callback"),
    ENDPOINT_REGISTRY_EVIDENCE,
  ),
  verified(
    "payment-return",
    "Stripe Checkout, bespoke Checkout, and billing-portal browser return pages.",
    pageMembers((screen) =>
      ["/account/billing", "/account/pages", "/pricing"].includes(screen.route),
    ),
    [
      ...PAGE_REGISTRY_EVIDENCE,
      "src/lib/billing/stripe-service.ts",
      "src/lib/billing/stripe-readiness.test.ts",
    ],
  ),
  verified(
    "payment-webhook",
    "Billing-provider webhook receivers.",
    apiMembers("webhook").filter(
      (member) => member.includes("/stripe") || member.includes("/lago"),
    ),
    ENDPOINT_REGISTRY_EVIDENCE,
  ),
  verified(
    "provider-webhook",
    "Non-payment provider webhook receivers.",
    apiMembers("webhook").filter((member) => member.includes("/livekit/")),
    ENDPOINT_REGISTRY_EVIDENCE,
  ),
  verified(
    "internal-service",
    "Every source-discovered internal HTTP service entry point.",
    apiMembers("internal"),
    ENDPOINT_REGISTRY_EVIDENCE,
  ),
  verified(
    "scheduled-task",
    "Every unique internal HTTP destination declared by the reviewed Cloud Scheduler configurations.",
    apiMembers("cron"),
    [...ENDPOINT_REGISTRY_EVIDENCE, ...SCHEDULER_EVIDENCE],
  ),
  verified(
    "cron",
    "Every unique internal HTTP destination declared by the reviewed cron and Cloud Scheduler configurations.",
    apiMembers("cron"),
    [...ENDPOINT_REGISTRY_EVIDENCE, ...SCHEDULER_EVIDENCE],
  ),
  verified(
    "queue-publisher",
    "Every durable database queue, outbox, notification, and webhook-event create/createMany/upsert operation in production application source.",
    QUEUE_PUBLISHER_MEMBERS,
    SOURCE_SURFACE_EVIDENCE,
  ),
  verified(
    "queue-consumer",
    "Every source-implemented durable database queue/event consumer entry function. UsageEvent and UsageOutbox remain explicitly unwired implementation gaps, not undiscovered consumers.",
    QUEUE_CONSUMER_MEMBERS,
    SOURCE_SURFACE_EVIDENCE,
  ),
  verified(
    "worker",
    "Every exported background maintenance, cleanup, sync, or batch-worker entry function in src/lib. Runtime scheduling and deployment wiring remain separately gated.",
    BACKGROUND_WORKER_MEMBERS,
    SOURCE_SURFACE_EVIDENCE,
  ),
  verified(
    "database-trigger",
    "Every active PostgreSQL trigger after ordered CREATE/DROP replay of the tracked Prisma migration set.",
    DATABASE_TRIGGER_MEMBERS,
    DATABASE_SURFACE_EVIDENCE,
  ),
  verified(
    "database-function",
    "Every PostgreSQL function or procedure defined by tracked Prisma migrations and reviewed Supabase policy SQL, with application, migration-temporary, and Supabase Realtime database scopes kept distinct.",
    DATABASE_FUNCTION_MEMBERS,
    DATABASE_SURFACE_EVIDENCE,
  ),
  verified(
    "search-index",
    "Every tracked PostgreSQL full-text, trigram, prefix, ListingSearchIndex, and aggregate materialized-index operation in application, migration, seed, and benchmark sources. No external search runtime is declared.",
    SEARCH_INDEX_OPERATION_MEMBERS,
    SOURCE_SURFACE_EVIDENCE,
  ),
  verified(
    "cache",
    "Every tracked process-cache call, Next cache invalidation/directive, route cache mode, fetch cache mode, and HTTP/browser Cache-Control operation. Deployed CDN configuration remains a separate runtime gate.",
    CACHE_OPERATION_MEMBERS,
    SOURCE_SURFACE_EVIDENCE,
  ),
  verified(
    "ai-tool",
    "Agent execution, history, cancellation, and AI image-generation entry points.",
    apiMembers("ai-tool"),
    ENDPOINT_REGISTRY_EVIDENCE,
  ),
  verified(
    "admin-cli",
    "Every package-exposed or directly executable script with source-static database, cloud, container, storage, worker, or HTTP state-change signals. Authorization and runtime side effects remain separately gated.",
    ADMIN_CLI_MEMBERS,
    SOURCE_SURFACE_EVIDENCE,
  ),
  verified(
    "design-lab-simulation",
    "Every registered page in the Design Lab route tree; simulations reuse these product pages with isolated fixtures rather than dedicated HTTP endpoints.",
    pageMembers(
      (screen) =>
        screen.route === "/design-lab" ||
        screen.route.startsWith("/design-lab/"),
    ),
    PAGE_REGISTRY_EVIDENCE,
  ),
  notApplicable(
    "legacy",
    "Versioned legacy application endpoints.",
    "Every source-inventoried endpoint is unversioned and no /api/vN route exists.",
    ENDPOINT_REGISTRY_EVIDENCE,
  ),
  notApplicable(
    "deprecated",
    "Deprecated API versions.",
    "No API version exists in the exhaustive source route inventory, so no deprecated API version can be enumerated.",
    ENDPOINT_REGISTRY_EVIDENCE,
  ),
  notApplicable(
    "debug",
    "Debug and diagnostic application routes.",
    "No /debug or /diagnostics page or HTTP endpoint exists in the exhaustive source route inventories.",
    [...PAGE_REGISTRY_EVIDENCE, ...ENDPOINT_REGISTRY_EVIDENCE],
  ),
  verified(
    "source-search",
    "Source page, endpoint, server-action, and scheduler definitions.",
    [
      "src/components/demo-experience-registry.ts",
      "security/endpoints.ts",
      "security/api-surface-inventory.ts",
      ...SCHEDULER_EVIDENCE,
    ],
    [...PAGE_REGISTRY_EVIDENCE, ...ENDPOINT_REGISTRY_EVIDENCE, ...SCHEDULER_EVIDENCE],
  ),
  verified(
    "framework-search",
    "Framework, package, and deployment route configuration.",
    ["next.config.ts", "package.json", "vercel.json"],
    ["next.config.ts", "package.json", "vercel.json"],
  ),
  verified(
    "test-search",
    "Tests and API documentation that fail on route or operation drift.",
    [
      "src/components/product-route-tree-evidence.test.ts",
      "security/registry.test.ts",
      "security/api-surface-inventory.test.ts",
      "scripts/harden-openapi-contract.test.mjs",
      "openapi.json",
    ],
    [
      "src/components/product-route-tree-evidence.test.ts",
      "security/registry.test.ts",
      "security/api-surface-inventory.test.ts",
      "scripts/harden-openapi-contract.test.mjs",
      "openapi.json",
    ],
  ),
  verified(
    "client-search",
    "Generated API client and native iOS/iPadOS/Android project discovery scoped strictly to the E:/greyhoundiq repository workspace. Separately owned native repositories are outside this proof.",
    CLIENT_SEARCH_MEMBERS,
    SOURCE_SURFACE_EVIDENCE,
  ),
  verified(
    "email-worker-search",
    "Every source-controlled mailto link, email SDK import, email sender call, and email worker declaration, including explicit scoped absence decisions. Provider-managed delivery is outside this proof.",
    EMAIL_WORKER_SEARCH_MEMBERS,
    SOURCE_SURFACE_EVIDENCE,
  ),
  verified(
    "not-route-folder-only",
    "Discovery sources outside src/app route folders.",
    [
      `${SCREEN_CONTRACTS.length} registered pages`,
      `${serverActions.length} discovered server actions`,
      `${apiMembers("cron").length} scheduled internal destinations`,
      "OpenAPI contract and framework configuration",
    ],
    [...PAGE_REGISTRY_EVIDENCE, ...ENDPOINT_REGISTRY_EVIDENCE, ...SCHEDULER_EVIDENCE],
  ),
] as const;

export const APPLICATION_SURFACE_SUMMARY = {
  total: APPLICATION_SURFACE_INVENTORY.length,
  verified: APPLICATION_SURFACE_INVENTORY.filter(
    (record) => record.status === "verified",
  ).length,
  notApplicable: APPLICATION_SURFACE_INVENTORY.filter(
    (record) => record.status === "not-applicable-with-justification",
  ).length,
  open: APPLICATION_SURFACE_INVENTORY.filter(
    (record) => record.status === "open",
  ).length,
  pages: SCREEN_CONTRACTS.length,
  httpMethods: httpEndpoints.length,
  serverActions: serverActions.length,
  scheduledDestinations: apiMembers("cron").length,
} as const;

export function renderApplicationSurfaceInventoryMarkdown() {
  const summary = APPLICATION_SURFACE_SUMMARY;
  const lines = [
    "# Application surface discovery",
    "",
    `Status: **Partially verified — ${summary.verified + summary.notApplicable}/${summary.total} categories decided; production release blocked**  `,
    "Evidence date: 2026-07-14  ",
    `Authoritative sources: \`${APPLICATION_SURFACE_INVENTORY_SOURCE}\`, tested page and endpoint registries, and reviewed scheduler configuration`,
    "",
    "A completed category proves only exhaustive source-static discovery inside its named boundary. It does not prove deployed parity, authentication, authorization, runtime behavior, provider configuration, or production safety.",
    "",
    "## Summary",
    "",
    "| Decision | Count |",
    "|---|---:|",
    `| Verified inventory boundary | ${summary.verified} |`,
    `| Not applicable with tested justification | ${summary.notApplicable} |`,
    `| Open | ${summary.open} |`,
    `| Total immutable requirements | ${summary.total} |`,
    "",
    `The tested inventories bind ${summary.pages} page routes, ${summary.httpMethods} route-handler methods, ${summary.serverActions} server actions and ${summary.scheduledDestinations} unique scheduled internal destinations.`,
    "",
    "## Requirement decisions",
    "",
    "| Requirement ID | Decision | Members | Boundary, justification, or known gap |",
    "|---|---|---:|---|",
    ...APPLICATION_SURFACE_INVENTORY.map((record) =>
      [
        `| \`${record.requirementId}\``,
        statusLabel(record.status),
        String(record.members.length),
        escapeTableCell(
          record.status === "open"
            ? record.knownGap ?? "Open"
            : record.justification ?? record.boundary,
        ),
      ].join(" | ") + " |",
    ),
    "",
    "## Open boundary",
    "",
    "All 45 application-surface categories now have source-static decisions. Separately owned native repositories, runtime provider/deployment parity, deployed connections, email-provider delivery, and administrative authorization remain outside this proof. Source inventory completion does not close the explicit unwired UsageEvent/UsageOutbox delivery implementation gap or any runtime/deployment gate.",
    "",
    "## Release boundary",
    "",
    "These decisions are working-tree source evidence. Authorised immutable-candidate and deployed-surface comparisons remain release-blocking, and source-static completion must not be interpreted as a secure or production-ready application.",
    "",
  ];
  return lines.join("\n");
}

function statusLabel(status: ApplicationSurfaceStatus) {
  if (status === "verified") return "Verified";
  if (status === "not-applicable-with-justification") {
    return "Not applicable with justification";
  }
  return "Open";
}

function escapeTableCell(value: string) {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}
