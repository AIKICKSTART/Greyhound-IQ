/**
 * Short-lived Prisma connectivity check.
 *
 * This is intentionally isolated so parent import/backfill scripts can kill the
 * process if the Prisma engine blocks while Supabase is unavailable.
 */
import "./load-env";
import { prisma } from "../src/lib/db";

async function main() {
  await prisma.$queryRaw`select 1 as ok`;
  console.log("[preflight:database] ok");
}

main()
  .catch((err) => {
    console.error("[preflight:database] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      // Keep the original preflight result.
    }
  });
