/**
 * Dry-run inspection for a Lago webhook replay decision.
 *
 * Usage:
 *   npm run inspect:lago-webhook-replay -- --dry-run --event-id <lago-event-id>
 *   npm run inspect:lago-webhook-replay -- --dry-run --webhook-id <webhook-event-id>
 */
import "./load-env";

import { PrismaClient } from "@prisma/client";

type Args = {
  dryRun: boolean;
  eventId?: string;
  webhookId?: string;
};

type WebhookSnapshot = NonNullable<
  Awaited<ReturnType<typeof findWebhookSnapshot>>
>;

type BillingSnapshot = Awaited<ReturnType<typeof findBillingSnapshots>>[number];

class UsageError extends Error {}

const prisma = new PrismaClient();

async function main() {
  const args = parseArgs(process.argv.slice(2));
  assertDatabaseConfigured();

  const webhook = await findWebhookSnapshot(args);
  const billingEvents = await findBillingSnapshots(args, webhook);
  const inspection = inspectReplayState(webhook, billingEvents);

  printInspection(args, webhook, billingEvents, inspection);
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    if (arg === "--event-id") {
      args.eventId = nextValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--webhook-id") {
      args.webhookId = nextValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }

    throw new UsageError(`Unknown flag: ${arg}\n\n${usage()}`);
  }

  if (!args.dryRun) {
    throw new UsageError(`This inspector requires --dry-run.\n\n${usage()}`);
  }

  if (Boolean(args.eventId) === Boolean(args.webhookId)) {
    throw new UsageError(
      `Pass exactly one of --event-id or --webhook-id.\n\n${usage()}`
    );
  }

  return args;
}

function nextValue(argv: string[], index: number, flag: string) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new UsageError(`Missing value for ${flag}.\n\n${usage()}`);
  }
  return value;
}

function usage() {
  return [
    "Usage:",
    "  npm run inspect:lago-webhook-replay -- --dry-run --event-id <lago-event-id>",
    "  npm run inspect:lago-webhook-replay -- --dry-run --webhook-id <webhook-event-id>",
  ].join("\n");
}

function assertDatabaseConfigured() {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (
    !databaseUrl.startsWith("postgresql://") &&
    !databaseUrl.startsWith("postgres://")
  ) {
    throw new UsageError(
      "DATABASE_URL must be configured with a Postgres connection string for read-only inspection."
    );
  }
}

async function findWebhookSnapshot(args: Args) {
  const where = args.webhookId
    ? { id: args.webhookId }
    : { provider: "lago", lagoEventId: args.eventId };

  return prisma.webhookEvent.findFirst({
    where,
    select: {
      id: true,
      provider: true,
      lagoEventId: true,
      eventType: true,
      status: true,
      payloadHash: true,
      payloadJson: true,
      retryCount: true,
      receivedAt: true,
      processedAt: true,
      error: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

async function findBillingSnapshots(
  args: Args,
  webhook: Awaited<ReturnType<typeof findWebhookSnapshot>>
) {
  const filters = [];
  if (webhook?.id) filters.push({ webhookEventId: webhook.id });
  if (args.eventId) filters.push({ lagoEventId: args.eventId });
  if (webhook?.lagoEventId) filters.push({ lagoEventId: webhook.lagoEventId });

  if (filters.length === 0) return [];

  return prisma.billingEvent.findMany({
    where: { OR: filters },
    orderBy: { occurredAt: "desc" },
    select: {
      id: true,
      webhookEventId: true,
      lagoEventId: true,
      eventType: true,
      status: true,
      occurredAt: true,
      billingCustomerId: true,
      subscriptionId: true,
      invoiceRecordId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

function inspectReplayState(
  webhook: WebhookSnapshot | null,
  billingEvents: BillingSnapshot[]
) {
  if (!webhook) {
    if (billingEvents.length > 0) {
      return {
        status: "billing_snapshot_without_webhook",
        nextOperatorAction:
          "Do not replay from local state; reconcile the missing WebhookEvent snapshot against Lago as the source of truth first.",
      };
    }

    return {
      status: "local_snapshot_missing",
      nextOperatorAction:
        "Confirm the identifier against Lago as the source of truth; no local WebhookEvent or BillingEvent snapshot was found.",
    };
  }

  if (webhook.provider !== "lago") {
    return {
      status: "unsupported_provider",
      nextOperatorAction:
        "Use the provider-specific inspection path; this script is Lago-only.",
    };
  }

  if (webhook.error) {
    return {
      status: "webhook_error_recorded",
      nextOperatorAction:
        "Review the recorded webhook error, fix the cause, then use the approved replay procedure if Lago still requires replay.",
    };
  }

  if (webhook.status === "processed" && billingEvents.length > 0) {
    return {
      status: "replay_not_required",
      nextOperatorAction:
        "No replay is indicated from local snapshots; verify the account state against Lago if operator concern remains.",
    };
  }

  if (webhook.status === "ignored") {
    return {
      status: "ignored_locally",
      nextOperatorAction:
        "Inspect the stored payload type and reducer support before any replay; ignored events should not be replayed blindly.",
    };
  }

  if (webhook.status === "received" && billingEvents.length === 0) {
    return {
      status: "replay_candidate",
      nextOperatorAction:
        "Compare the event against Lago as the source of truth, then run the approved replay procedure if the delivery is still missing locally.",
    };
  }

  if (webhook.status === "received" && billingEvents.length > 0) {
    return {
      status: "status_reconciliation_required",
      nextOperatorAction:
        "Do not replay yet; BillingEvent snapshots exist while the WebhookEvent is still received, so reconcile local status first.",
    };
  }

  if (webhook.status === "processed" && billingEvents.length === 0) {
    return {
      status: "processed_without_billing_snapshot",
      nextOperatorAction:
        "Inspect the stored event type and payload before replay; local status says processed but no BillingEvent snapshot exists.",
    };
  }

  return {
    status: "operator_review_required",
    nextOperatorAction:
      "Review the local WebhookEvent and BillingEvent snapshots against Lago before taking replay action.",
  };
}

function printInspection(
  args: Args,
  webhook: WebhookSnapshot | null,
  billingEvents: BillingSnapshot[],
  inspection: ReturnType<typeof inspectReplayState>
) {
  console.log("[lago-webhook-replay] dry-run inspection");
  console.log(`dryRun: ${args.dryRun}`);
  console.log(`targetType: ${args.eventId ? "event-id" : "webhook-id"}`);
  console.log(`targetId: ${args.eventId ?? args.webhookId}`);
  console.log("dbMutations: none");
  console.log("lagoCalls: none");
  console.log(`status: ${inspection.status}`);
  console.log(`nextOperatorAction: ${inspection.nextOperatorAction}`);
  console.log("");
  console.log("webhookEvent:");

  if (!webhook) {
    console.log("  found: false");
  } else {
    console.log("  found: true");
    console.log(`  id: ${webhook.id}`);
    console.log(`  provider: ${webhook.provider}`);
    console.log(`  lagoEventId: ${webhook.lagoEventId ?? "none"}`);
    console.log(`  eventType: ${webhook.eventType}`);
    console.log(`  status: ${webhook.status}`);
    console.log(`  retryCount: ${webhook.retryCount}`);
    console.log(`  payloadHash: ${webhook.payloadHash ?? "none"}`);
    console.log(`  payloadBytes: ${Buffer.byteLength(webhook.payloadJson, "utf8")}`);
    console.log(`  receivedAt: ${formatDate(webhook.receivedAt)}`);
    console.log(`  processedAt: ${formatDate(webhook.processedAt)}`);
    console.log(`  errorPresent: ${Boolean(webhook.error)}`);
    console.log(`  createdAt: ${formatDate(webhook.createdAt)}`);
    console.log(`  updatedAt: ${formatDate(webhook.updatedAt)}`);
  }

  console.log("");
  console.log(`billingEvents: ${billingEvents.length}`);
  for (const event of billingEvents) {
    console.log(`  - id: ${event.id}`);
    console.log(`    webhookEventId: ${event.webhookEventId ?? "none"}`);
    console.log(`    lagoEventId: ${event.lagoEventId ?? "none"}`);
    console.log(`    eventType: ${event.eventType}`);
    console.log(`    status: ${event.status}`);
    console.log(`    occurredAt: ${formatDate(event.occurredAt)}`);
    console.log(`    billingCustomerId: ${event.billingCustomerId ?? "none"}`);
    console.log(`    subscriptionId: ${event.subscriptionId ?? "none"}`);
    console.log(`    invoiceRecordId: ${event.invoiceRecordId ?? "none"}`);
    console.log(`    createdAt: ${formatDate(event.createdAt)}`);
    console.log(`    updatedAt: ${formatDate(event.updatedAt)}`);
  }
}

function formatDate(value: Date | null) {
  return value?.toISOString() ?? "none";
}

main()
  .catch((err) => {
    if (err instanceof UsageError) {
      console.error(err.message);
    } else {
      console.error("[lago-webhook-replay] failed:", errorMessage(err));
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      // Preserve the inspection result.
    }
  });

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}
