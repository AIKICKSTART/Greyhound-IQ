import assert from "node:assert/strict";

import {
  assertMigrationReplayUrls,
  assertMigrationReplaySourceUnchanged,
  evaluateMigrationReplayResult,
  sanitizeMigrationReplayOutput,
} from "./check-database-migration-replay";

assert.deepEqual(
  assertMigrationReplayUrls(
    "postgresql://greyhoundiq_runtime@127.0.0.1:55734/greyhoundiq",
    "postgresql://postgres@127.0.0.1:55734/greyhoundiq_shadow",
  ),
  {
    target: {
      protocol: "postgresql",
      host: "127.0.0.1",
      port: 55734,
      database: "greyhoundiq",
    },
    shadow: {
      protocol: "postgresql",
      host: "127.0.0.1",
      port: 55734,
      database: "greyhoundiq_shadow",
    },
  },
);
assert.throws(
  () =>
    assertMigrationReplayUrls(
      "postgresql://greyhoundiq_runtime@127.0.0.1:55734/greyhoundiq",
      "postgresql://postgres@127.0.0.1:55734/greyhoundiq",
    ),
  /separate from the target/,
);
assert.throws(
  () =>
    assertMigrationReplayUrls(
      "postgresql://greyhoundiq_runtime@127.0.0.1:55734/greyhoundiq",
      "postgresql://postgres@[::1]:55734/greyhoundiq",
    ),
  /literal 127\.0\.0\.1/,
);
assert.throws(
  () =>
    assertMigrationReplayUrls(
      "postgresql://greyhoundiq_runtime@127.0.0.1:55733/greyhoundiq",
      "postgresql://postgres@127.0.0.1:55733/greyhoundiq_shadow",
    ),
  /disposable replay port 55734/,
);
assert.throws(
  () =>
    assertMigrationReplayUrls(
      "postgresql://greyhoundiq_runtime@127.0.0.1:55734/greyhoundiq?host=db.example",
      "postgresql://postgres@127.0.0.1:55734/greyhoundiq_shadow",
    ),
  /must not override its endpoint/,
);
assert.throws(
  () =>
    assertMigrationReplayUrls(
      "postgresql://greyhoundiq_runtime@127.0.0.1:55734/greyhoundiq",
      "postgresql://postgres@[::1]:55734/greyhoundiq_shadow",
    ),
  /literal 127\.0\.0\.1/,
);
assert.throws(
  () =>
    assertMigrationReplayUrls(
      "postgresql://greyhoundiq_runtime@localhost:55734/greyhoundiq",
      "postgresql://postgres@127.0.0.1:55734/greyhoundiq_shadow",
    ),
  /must use literal/,
);
assert.throws(
  () =>
    assertMigrationReplayUrls(
      "postgresql://greyhoundiq_runtime@db.example/greyhoundiq",
      "postgresql://postgres@127.0.0.1:55734/greyhoundiq_shadow",
    ),
  /must use loopback PostgreSQL/,
);
assert.throws(
  () =>
    assertMigrationReplayUrls(
      "postgresql://postgres@127.0.0.1:55734/greyhoundiq",
      "postgresql://postgres@127.0.0.1:55734/greyhoundiq_shadow",
    ),
  /isolated greyhoundiq_runtime role/,
);
assert.throws(
  () =>
    assertMigrationReplayUrls(
      "postgresql://greyhoundiq_runtime@127.0.0.1:55734/greyhoundiq",
      "postgresql://greyhoundiq_runtime@127.0.0.1:55734/greyhoundiq_shadow",
    ),
  /local postgres administrative role/,
);
assert.throws(
  () =>
    assertMigrationReplayUrls(
      "postgresql://greyhoundiq_runtime:secret@127.0.0.1:55734/greyhoundiq",
      "postgresql://postgres@127.0.0.1:55734/greyhoundiq_shadow",
    ),
  /passwordless/,
);

assert.equal(
  evaluateMigrationReplayResult(0, "No difference detected.\n", "").status,
  "verified",
);
assert.equal(
  evaluateMigrationReplayResult(2, "+ unexpected table", "").status,
  "drift-detected",
);
assert.equal(
  evaluateMigrationReplayResult(1, "", "connector failed").status,
  "error",
);
const sanitized = sanitizeMigrationReplayOutput(
  'postgresql://admin:password@127.0.0.1:55734/secret password="hunter 2" api_key=top-secret Authorization:BearerToken Bearer abc.def\nNo difference detected.',
);
assert.ok(!sanitized.includes("hunter 2"));
assert.ok(!sanitized.includes("admin:password"));
assert.ok(!sanitized.includes("top-secret"));
assert.ok(!sanitized.includes("BearerToken"));
assert.ok(!sanitized.includes("abc.def"));
assert.match(sanitized, /<redacted/);

const sourceState = {
  headSha: "a".repeat(40),
  sourceSha256: "b".repeat(64),
  sourceFileCount: 1,
  schemaSha256: "c".repeat(64),
  migrationsSha256: "d".repeat(64),
  migrationCount: 1,
  replayControlSha256: "e".repeat(64),
};
assert.doesNotThrow(() =>
  assertMigrationReplaySourceUnchanged(sourceState, { ...sourceState }),
);
assert.throws(
  () =>
    assertMigrationReplaySourceUnchanged(sourceState, {
      ...sourceState,
      migrationsSha256: "f".repeat(64),
    }),
  /source changed during migration replay/,
);
assert.throws(
  () =>
    assertMigrationReplaySourceUnchanged(sourceState, {
      ...sourceState,
      replayControlSha256: "f".repeat(64),
    }),
  /source changed during migration replay/,
);

console.log("database migration replay tests passed");
