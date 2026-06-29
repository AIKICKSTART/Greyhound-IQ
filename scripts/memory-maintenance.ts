/**
 * Decay idle memories and reinforce recently accessed memories.
 *
 * Usage: npm run maintain:memory
 * The production cron normally calls /api/internal/memory-decay with
 * X-Internal-Secret; this script gives operators the same logic locally.
 */
import { runMemoryMaintenance } from "../src/lib/agent-service";

runMemoryMaintenance()
  .then((result) => {
    console.log("Done:", result);
  })
  .catch((err) => {
    console.error("[memory-maintenance] failed:", err);
    process.exit(1);
  });
