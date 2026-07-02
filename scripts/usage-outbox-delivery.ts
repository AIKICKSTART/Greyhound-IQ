/**
 * Dry-run inspection for pending UsageOutbox delivery state.
 *
 * Usage:
 *   npm run inspect:usage-outbox -- --dry-run
 *   npm run inspect:usage-outbox -- --dry-run --limit 25
 */
import "./load-env";

import { Prisma, PrismaClient } from "@prisma/client";

type Args = {
  dryRun: boolean;
  limit: number;
};

type UsageOutboxRow = Awaited<ReturnType<typeof findPendingUsageOutboxRows>>[number];

class UsageError extends Error {}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const prisma = new PrismaClient();

async function main() {
  const args = parseArgs(process.argv.slice(2));
  assertDatabaseConfigured();

  const [pendingCount, rows] = await Promise.all([
    prisma.usageOutbox.count({ where: { status: "pending" } }),
    findPendingUsageOutboxRows(args.limit),
  ]);

  printInspection(args, pendingCount, rows);
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, limit: DEFAULT_LIMIT };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    if (arg === "--limit") {
      args.limit = parseLimit(nextValue(argv, index, arg));
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

  return args;
}

function nextValue(argv: string[], index: number, flag: string) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new UsageError(`Missing value for ${flag}.\n\n${usage()}`);
  }
  return value;
}

function parseLimit(value: string) {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new UsageError(
      `--limit must be an integer between 1 and ${MAX_LIMIT}.\n\n${usage()}`
    );
  }
  return limit;
}

function usage() {
  return [
    "Usage:",
    "  npm run inspect:usage-outbox -- --dry-run",
    "  npm run inspect:usage-outbox -- --dry-run --limit 25",
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

function findPendingUsageOutboxRows(limit: number) {
  return prisma.usageOutbox.findMany({
    where: { status: "pending" },
    orderBy: [{ nextRetryAt: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: {
      id: true,
      usageEventId: true,
      idempotencyKey: true,
      metricKey: true,
      userId: true,
      billingCustomerId: true,
      subscriptionId: true,
      quantity: true,
      status: true,
      retryCount: true,
      metadataJson: true,
      occurredAt: true,
      lastAttemptAt: true,
      nextRetryAt: true,
      sentAt: true,
      failedAt: true,
      error: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

function printInspection(args: Args, pendingCount: number, rows: UsageOutboxRow[]) {
  console.log("[usage-outbox-delivery] dry-run inspection");
  console.log(`dryRun: ${args.dryRun}`);
  console.log("dbMutations: none");
  console.log("lagoCalls: none");
  console.log(`pendingRowsTotal: ${pendingCount}`);
  console.log(`pendingRowsListed: ${rows.length}`);
  console.log(`limit: ${args.limit}`);
  console.log("");
  console.log("pendingUsageOutboxRows:");

  if (rows.length === 0) {
    console.log("  none");
    return;
  }

  for (const row of rows) {
    const metadata = inspectMetadata(row.metadataJson);

    console.log(`  - id: ${row.id}`);
    console.log(`    usageEventId: ${row.usageEventId ?? "none"}`);
    console.log(`    idempotencyKey: ${row.idempotencyKey}`);
    console.log(`    metricKey: ${row.metricKey}`);
    console.log(`    userId: ${row.userId ?? "none"}`);
    console.log(`    billingCustomerId: ${row.billingCustomerId ?? "none"}`);
    console.log(`    subscriptionId: ${row.subscriptionId ?? "none"}`);
    console.log(`    quantity: ${row.quantity}`);
    console.log(`    status: ${row.status}`);
    console.log(`    retryCount: ${row.retryCount}`);
    console.log(`    occurredAt: ${formatDate(row.occurredAt)}`);
    console.log(`    nextRetryAt: ${formatDate(row.nextRetryAt)}`);
    console.log(`    lastAttemptAt: ${formatDate(row.lastAttemptAt)}`);
    console.log(`    sentAt: ${formatDate(row.sentAt)}`);
    console.log(`    failedAt: ${formatDate(row.failedAt)}`);
    console.log(`    errorPresent: ${Boolean(row.error)}`);
    console.log(`    createdAt: ${formatDate(row.createdAt)}`);
    console.log(`    updatedAt: ${formatDate(row.updatedAt)}`);
    console.log(`    metadataPresent: ${metadata.present}`);
    console.log(`    metadataBytes: ${metadata.bytes}`);
    console.log(`    metadataShape: ${metadata.shape}`);
    console.log(`    metadataItemCount: ${metadata.itemCount}`);
  }
}

function inspectMetadata(metadataJson: string | null) {
  if (!metadataJson) {
    return {
      present: false,
      bytes: 0,
      shape: "none",
      itemCount: 0,
    };
  }

  const bytes = Buffer.byteLength(metadataJson, "utf8");

  try {
    const parsed = JSON.parse(metadataJson) as unknown;
    if (Array.isArray(parsed)) {
      return {
        present: true,
        bytes,
        shape: `array(length=${parsed.length})`,
        itemCount: parsed.length,
      };
    }

    if (parsed && typeof parsed === "object") {
      const keyCount = Object.keys(parsed).length;
      return {
        present: true,
        bytes,
        shape: "object",
        itemCount: keyCount,
      };
    }

    return {
      present: true,
      bytes,
      shape: typeof parsed,
      itemCount: 0,
    };
  } catch {
    return {
      present: true,
      bytes,
      shape: "invalid-json",
      itemCount: 0,
    };
  }
}

function formatDate(value: Date | null) {
  return value?.toISOString() ?? "none";
}

main()
  .catch((err) => {
    if (err instanceof UsageError) {
      console.error(err.message);
    } else if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2021"
    ) {
      console.error(
        "UsageOutbox table does not exist in the configured database; run migrations before inspecting delivery."
      );
    } else {
      console.error("[usage-outbox-delivery] failed:", errorMessage(err));
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
