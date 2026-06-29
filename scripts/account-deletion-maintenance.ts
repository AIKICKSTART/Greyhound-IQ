/**
 * Finalize account deletions that are past the 30-day recovery window.
 *
 * Usage: npm run maintain:accounts
 * The production cron normally calls /api/internal/account-deletion with
 * X-Internal-Secret; this script gives operators the same logic locally.
 */
import { runAccountDeletionMaintenance } from "../src/lib/account-service";

runAccountDeletionMaintenance()
  .then((result) => {
    console.log("Done:", result);
  })
  .catch((err) => {
    console.error("[account-deletion-maintenance] failed:", err);
    process.exit(1);
  });
