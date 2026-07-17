import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "scripts/import-thedogs-dog-profile-raw.ts",
  "utf8",
);

const guardIndex = source.indexOf("if (!options.dryRun && !options.archiveOnly)");
const discoveryIndex = source.indexOf("await findCandidates(options)");
const preflightIndex = source.indexOf("preflightDatabaseWithRetries(options)");
const canonicalWriteIndex = source.indexOf("async function saveProfileArchive(");

assert.ok(guardIndex > 0, "direct canonical import must be disabled");
assert.ok(
  guardIndex < discoveryIndex &&
    guardIndex < preflightIndex &&
    guardIndex < canonicalWriteIndex,
  "the fail-closed guard must run before discovery, database access, or canonical writes",
);
assert.match(
  source,
  /identity-audited v2 full-history merge so whole-database matching, provenance, relationship review, and no-loss checks run/,
);
assert.match(source, /process\.exitCode = CANONICAL_IMPORT_DISABLED_EXIT_CODE/);

console.log("The Dogs direct canonical import safety contract: PASS");
