/**
 * Mark agent runs older than 24 hours as failed when they never completed.
 *
 * Usage: npm run maintain:agents
 * The production cron normally calls /api/internal/agent-cleanup with
 * X-Internal-Secret; this script gives operators the same logic locally.
 */
import { runAgentCleanup } from "../src/lib/agent-service";

runAgentCleanup()
  .then((result) => {
    console.log("Done:", result);
  })
  .catch((err) => {
    console.error("[agent-cleanup] failed:", err);
    process.exit(1);
  });
