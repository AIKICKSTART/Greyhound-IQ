/**
 * Pull live race data from the configured provider into the database.
 *
 * Usage: npm run sync:live
 * Uses TOPAZ_API_KEY when available. Without it, a bounded FastTrack prototype
 * reader is enabled unless FASTTRACK_PROTOTYPE_ENABLED=false.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const [{ syncLiveData }, { prisma }] = await Promise.all([
    import("../src/lib/live/sync"),
    import("../src/lib/db"),
  ]);

  try {
    const result = await syncLiveData(3);
    if (!result.synced) return;
    console.log("Done:", result);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[sync:live] failed:", err);
  process.exit(1);
});
