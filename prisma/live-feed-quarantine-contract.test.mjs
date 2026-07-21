import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = readFileSync(
  new URL("./schema.prisma", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL(
    "./migrations/20260718060000_add_live_feed_quarantine/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const writer = readFileSync(
  new URL("../src/lib/live/quarantine.ts", import.meta.url),
  "utf8",
);

const model = modelBlock(schema, "LiveFeedQuarantine");
for (const field of [
  "id",
  "observedAt",
  "provider",
  "entityKind",
  "sourceId",
  "naturalIdentity",
  "reasonCode",
  "classification",
  "evidenceSha256",
  "evidenceJson",
  "createdAt",
]) {
  assert.match(model, new RegExp(`\\b${field}\\s`));
}
assert.doesNotMatch(
  model,
  /@@unique/,
  "quarantine occurrences must not deduplicate",
);

assert.match(migration, /BEGIN;/);
assert.match(migration, /COMMIT;/);
assert.match(migration, /SET LOCAL lock_timeout = '5s'/);
assert.match(migration, /SET LOCAL statement_timeout = '60s'/);
assert.match(
  migration,
  /"classification" IN \('invalid', 'incomplete', 'conflict'\)/,
);
assert.match(migration, /octet_length\("evidenceJson"\).*16384/s);
assert.match(migration, /jsonb_typeof\("evidenceJson"::jsonb\) = 'object'/);
assert.doesNotMatch(migration, /CREATE UNIQUE INDEX "LiveFeedQuarantine/);
assert.match(migration, /BEFORE UPDATE OR DELETE ON "LiveFeedQuarantine"/);
assert.match(
  migration,
  /ALTER TABLE "LiveFeedQuarantine" ENABLE ROW LEVEL SECURITY/,
);
assert.match(
  migration,
  /ALTER TABLE "LiveFeedQuarantine" FORCE ROW LEVEL SECURITY/,
);
assert.match(
  migration,
  /ON "LiveFeedQuarantine" FOR SELECT\s+USING \(public\.giq_is_admin\(\)\)/,
);
assert.match(
  migration,
  /ON "LiveFeedQuarantine" FOR INSERT\s+WITH CHECK \(public\.giq_is_system\(\)\)/,
);
assert.match(
  migration,
  /GRANT SELECT, INSERT ON "LiveFeedQuarantine" TO greyhoundiq_runtime/,
);
assert.match(
  migration,
  /GRANT SELECT, INSERT ON "LiveFeedQuarantine" TO greyhoundiq_app/,
);
assert.doesNotMatch(
  migration,
  /GRANT [^;]*(?:UPDATE|DELETE)[^;]*"LiveFeedQuarantine"/s,
);

assert.match(writer, /withDbSystemContext\(\(tx\) =>/);
assert.match(writer, /tx\.liveFeedQuarantine\.createMany/);
assert.match(writer, /createHash\("sha256"\)/);
assert.match(writer, /LIVE_FEED_QUARANTINE_MAX_EVIDENCE_BYTES = 16_384/);

console.log("Live feed quarantine schema contract passed");

function modelBlock(source, modelName) {
  const match = source.match(
    new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`),
  );
  assert(match, `missing ${modelName}`);
  return match[0];
}
