import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const restore = readFileSync(
  new URL("./restore.sh", import.meta.url),
  "utf8",
);

assert.match(restore, /EXPECTED_DATABASE="giq_production_stage11_20260718_r2"/);
assert.match(restore, /EXPECTED_ARCHIVE_FILES="116"/);
assert.match(restore, /EXPECTED_ARCHIVE_SIZE="2781982754"/);
assert.match(
  restore,
  /EXPECTED_CHECKSUM_SHA256="4ea0ec9862ce161d87b7568fe5abee5c79315e42ef3d5f0a66dde3f40662974a"/,
);
assert.ok(restore.includes("-e '/ ROW SECURITY /s/^/;/'"));
assert.doesNotMatch(restore, /--enable-row-security/);
assert.match(restore, /deferred_rls_count[\s\S]*?= "114"/);
assert.match(restore, /foreign_key_count[\s\S]*?= "209"/);
assert.match(
  restore,
  /ALTER TABLE %I\.%I ENABLE ROW LEVEL SECURITY/,
);
assert.match(
  restore,
  /database_marker" != "\$VERIFIED_DATABASE_MARKER"[\s\S]*?RECREATE_INCOMPLETE_DATABASE" = "\$EXPECTED_DATABASE"/,
);
assert.match(restore, /COMMENT ON DATABASE[\s\S]*?VERIFIED_DATABASE_MARKER/);
assert.match(restore, /history_start[\s\S]*?'YYYY-MM-DD'/);
assert.match(
  restore,
  /invalid_replay_count[\s\S]*?coalesce\(video\.\\"sourceId\\", ''\) = ''/,
);

console.log("full-history restore contract: ok");
