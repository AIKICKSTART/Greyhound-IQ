import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "scripts/backfill-thedogs-dog-profiles.ts",
  "utf8",
);

const optionsIndex = source.indexOf("const options = parseOptions");
const guardIndex = source.indexOf(
  "direct canonical profile backfill is disabled",
);
const exitIndex = source.indexOf(
  "process.exitCode = CANONICAL_BACKFILL_DISABLED_EXIT_CODE",
);
const databaseReadIndex = source.indexOf("await findDogs(options, completed)");

assert.ok(optionsIndex > 0);
assert.ok(guardIndex > optionsIndex);
assert.ok(exitIndex > guardIndex);
assert.ok(
  exitIndex < databaseReadIndex,
  "the fail-closed guard must run before any database read or canonical write",
);
assert.match(
  source.slice(exitIndex, databaseReadIndex),
  /return;/,
  "execution must stop after the disabled exit code",
);
assert.match(source, /backfill:thedogs:dog-profile-raw/);
assert.match(source, /identity-audited v2 full-history merge/);

console.log("The Dogs direct canonical backfill safety contract: PASS");
