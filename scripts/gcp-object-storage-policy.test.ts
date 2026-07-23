import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const cors = JSON.parse(
  readFileSync(path.join(root, "config", "gcs-object-storage-cors.json"), "utf8"),
) as Array<{
  origin: string[];
  method: string[];
  responseHeader: string[];
  maxAgeSeconds: number;
}>;

assert.equal(cors.length, 1);
assert.deepEqual(cors[0]?.origin, [
  "https://greyhoundsiq.com.au",
  "https://www.greyhoundsiq.com.au",
]);
assert.deepEqual(cors[0]?.method, ["GET", "HEAD", "PUT"]);
assert.deepEqual(cors[0]?.responseHeader, [
  "Content-Type",
  "Content-Length",
  "Content-Range",
  "Range",
  "ETag",
  "x-goog-generation",
  "x-goog-hash",
  "x-goog-if-generation-match",
]);
assert.equal(cors[0]?.maxAgeSeconds, 3600);

const adapter = readFileSync(
  path.join(root, "src", "lib", "gcs-object-storage.ts"),
  "utf8",
);
assert.match(adapter, /extensionHeaders: CREATE_ONLY_UPLOAD_HEADERS/);
assert.match(adapter, /"x-goog-if-generation-match": "0"/);
assert.match(adapter, /"content-type",\s*"host",\s*"x-goog-if-generation-match"/);

const reconciler = readFileSync(
  path.join(root, "scripts", "gcp-object-storage-reconcile.ps1"),
  "utf8",
);
for (const required of [
  '"giq-site-assets-$ProjectId"',
  '"giq-public-user-media-$ProjectId"',
  '"giq-private-user-media-$ProjectId"',
  '"--uniform-bucket-level-access"',
  '"--public-access-prevention"',
  '"--cors-file=$corsFile"',
  "Write-CorsBackup",
  "RestoreDirectory",
]) {
  assert.ok(reconciler.includes(required), `missing reconciler contract: ${required}`);
}
assert.match(
  reconciler,
  /-BackupDirectory is required with -Apply/,
  "writes must require a rollback destination",
);

console.log("GCS object-storage policy tests passed");
