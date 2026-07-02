/**
 * Pull live race data from the configured provider into the database.
 *
 * Usage: npm run sync:live -- [days:1-7] [upcoming|results|all]
 */
import { loadEnvConfig } from "@next/env";
import type { SyncScope } from "../src/lib/live/sync";

loadEnvConfig(process.cwd());

async function main() {
  const [{ syncLiveData }, { prisma }] = await Promise.all([
    import("../src/lib/live/sync"),
    import("../src/lib/db"),
  ]);

  try {
    const result = await syncLiveData(daysArg(), scopeArg());
    if (!result.synced) return;
    console.log("Done:", result);
  } finally {
    await prisma.$disconnect();
  }
}

function daysArg() {
  const raw = process.argv[2] ?? process.env.LIVE_SYNC_DAYS ?? "7";
  const days = Number(raw);
  if (!Number.isInteger(days) || days < 1 || days > 7) {
    throw new Error("Usage: npm run sync:live -- [days:1-7] [upcoming|results|all]");
  }
  return days;
}

function scopeArg(): SyncScope {
  const raw = process.argv[3] ?? process.env.LIVE_SYNC_SCOPE ?? "all";
  if (raw === "upcoming" || raw === "results" || raw === "all") return raw;
  throw new Error("Usage: npm run sync:live -- [days:1-7] [upcoming|results|all]");
}

main().catch((err) => {
  console.error("[sync:live] failed:", err);
  process.exit(1);
});
