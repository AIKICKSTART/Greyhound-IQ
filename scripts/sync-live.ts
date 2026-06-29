/**
 * Pull live race data from the configured provider into the database.
 *
 * Usage: npm run sync:live
 * No-ops gracefully until a provider key (TOPAZ_API_KEY) is set. Intended to be
 * run on a schedule (cron) once a live feed is wired.
 */
import { syncLiveData } from "../src/lib/live/sync";

syncLiveData(3)
  .then((r) => {
    if (!r.synced) process.exit(0);
    console.log("Done:", r);
  })
  .catch((e) => {
    console.error("[sync:live] failed:", e);
    process.exit(1);
  });
