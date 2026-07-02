/**
 * Short-lived Prisma connectivity check for bulk archive replay.
 *
 * If DATABASE_IMPORT_URL is configured, this uses that URL instead of the app
 * runtime DATABASE_URL. Keep this isolated so callers can kill the process when
 * the Prisma engine blocks while Supabase is unavailable.
 */
import "./load-import-env";
import { prisma } from "../src/lib/db";

async function main() {
  await prisma.$queryRaw`select 1 as ok`;
  console.log("[preflight:import-database] ok");
}

main()
  .catch((err) => {
    console.error("[preflight:import-database] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      // Keep the original preflight result.
    }
  });
