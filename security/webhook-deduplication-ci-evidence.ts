export type WebhookDeduplicationSourceCheck = {
  readonly file: string;
  readonly requiredMarkers: readonly string[];
};

export type WebhookDeduplicationBinding = {
  readonly routeFile: string;
  readonly strategy: "domain-compare-and-set" | "unique-receipt-and-fenced-reducer";
  readonly sourceChecks: readonly WebhookDeduplicationSourceCheck[];
};

export const WEBHOOK_DEDUPLICATION_BINDINGS = [
  binding(
    "src/app/api/livekit/webhook/route.ts",
    "domain-compare-and-set",
    [
      check("src/app/api/livekit/webhook/route.ts", [
        "receiveLiveKitWebhook",
        "handleLiveKitWebhookEvent",
      ]),
      check("src/lib/call-service.ts", [
        'where: { id: room.id, status: "active" }',
        "joinedAt: null",
        "leftAt: null",
        "if (updated.count === 0) return",
        "if (flip.count === 0) return",
      ]),
    ],
  ),
  binding(
    "src/app/api/webhooks/lago/route.ts",
    "unique-receipt-and-fenced-reducer",
    [
      check("src/app/api/webhooks/lago/route.ts", ["ingestLagoWebhook"]),
      check("src/lib/billing/lago-webhooks.ts", [
        "isUniqueConstraintError(err)",
        "findExistingLagoWebhook",
        "const processingToken = randomUUID()",
        'status: "processing"',
      ]),
      check("src/lib/billing/lago-reducer.ts", [
        "processingToken: string",
        'status: "processing"',
        "billingEvent.findUnique",
      ]),
      check("prisma/schema.prisma", [
        "lagoEventId",
        "@@unique([provider, payloadHash])",
        "webhookEventId    String?          @unique",
      ]),
    ],
  ),
  binding(
    "src/app/api/webhooks/stripe/route.ts",
    "unique-receipt-and-fenced-reducer",
    [
      check("src/app/api/webhooks/stripe/route.ts", ["ingestStripeWebhook"]),
      check("src/lib/billing/stripe-webhooks.ts", [
        "class StripeWebhookDuplicateDelivery extends Error",
        "isUniqueConstraintError(err)",
        "findExistingStripeWebhook",
        'existing.status === "failed"',
        'status: { notIn: ["ignored", "processed"] }',
      ]),
      check("prisma/schema.prisma", [
        "lagoEventId",
        "@@unique([provider, payloadHash])",
        "webhookEventId    String?          @unique",
      ]),
    ],
  ),
] as const satisfies readonly WebhookDeduplicationBinding[];

export function validateWebhookDeduplicationBindings(
  bindings: readonly WebhookDeduplicationBinding[],
  discoveredRouteFiles: readonly string[],
  sourceReader: (file: string) => string | undefined,
) {
  const issues: string[] = [];
  const registered = bindings.map((binding) => binding.routeFile).toSorted();
  const discovered = [...new Set(discoveredRouteFiles)].toSorted();

  for (const routeFile of registered) {
    if (registered.indexOf(routeFile) !== registered.lastIndexOf(routeFile)) {
      issues.push(`DUPLICATE_ROUTE:${routeFile}`);
    }
  }
  for (const routeFile of discovered) {
    if (!registered.includes(routeFile)) issues.push(`ROUTE_UNREGISTERED:${routeFile}`);
  }
  for (const routeFile of registered) {
    if (!discovered.includes(routeFile)) issues.push(`ROUTE_MISSING:${routeFile}`);
  }

  for (const binding of bindings) {
    if (binding.sourceChecks.length === 0) {
      issues.push(`SOURCE_CHECKS_EMPTY:${binding.routeFile}`);
    }
    for (const sourceCheck of binding.sourceChecks) {
      const source = sourceReader(sourceCheck.file);
      if (source === undefined) {
        issues.push(`SOURCE_MISSING:${binding.routeFile}:${sourceCheck.file}`);
        continue;
      }
      if (sourceCheck.requiredMarkers.length === 0) {
        issues.push(`MARKERS_EMPTY:${binding.routeFile}:${sourceCheck.file}`);
      }
      for (const marker of sourceCheck.requiredMarkers) {
        if (!source.includes(marker)) {
          issues.push(
            `MARKER_MISSING:${binding.routeFile}:${sourceCheck.file}:${marker}`,
          );
        }
      }
    }
  }

  return [...new Set(issues)].toSorted();
}

function binding(
  routeFile: string,
  strategy: WebhookDeduplicationBinding["strategy"],
  sourceChecks: readonly WebhookDeduplicationSourceCheck[],
): WebhookDeduplicationBinding {
  return { routeFile, strategy, sourceChecks };
}

function check(
  file: string,
  requiredMarkers: readonly string[],
): WebhookDeduplicationSourceCheck {
  return { file, requiredMarkers };
}
