/**
 * Expire stale marketplace listings and archive sold listings after 30 days.
 *
 * Usage: npm run maintain:listings
 * The production cron normally calls /api/internal/listing-expiry with
 * X-Internal-Secret; this script gives operators the same logic locally.
 */
import { runListingMaintenance } from "../src/lib/listing-service";

runListingMaintenance()
  .then((result) => {
    console.log("Done:", result);
  })
  .catch((err) => {
    console.error("[listing-maintenance] failed:", err);
    process.exit(1);
  });
