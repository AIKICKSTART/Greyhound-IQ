import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { MASTER_AUDIT_REQUIREMENTS } from "../src/components/master-audit-requirements";
import { jsonError } from "../src/lib/api-errors";
import {
  isPublicStorageBucket,
  PRIVATE_USER_MEDIA_BUCKET,
  publicStorageUrl,
  PUBLIC_USER_MEDIA_BUCKET,
  SITE_ASSETS_BUCKET,
} from "../src/lib/storage-paths";
import {
  INFRASTRUCTURE_POLICY_CONTROL_MASTER_EVIDENCE,
  INFRASTRUCTURE_POLICY_EVIDENCE_BOUNDARY,
  OPEN_INFRASTRUCTURE_POLICY_CONTROL_GAPS,
  VERIFIED_INFRASTRUCTURE_POLICY_CONTROL_IDS,
} from "./infrastructure-policy-control-evidence";

async function main() {
  const storagePaths = readFileSync("src/lib/storage-paths.ts", "utf8");
  const initialStorageMigration = readFileSync(
    "prisma/migrations/20260630170000_supabase_storage/migration.sql",
    "utf8",
  );
  const privateMediaMigration = readFileSync(
    "prisma/migrations/20260710133500_private_user_media_quarantine/migration.sql",
    "utf8",
  );
  const productionSafety = readFileSync(
    "scripts/check-production-safety.ts",
    "utf8",
  );

  assert.equal(isPublicStorageBucket(SITE_ASSETS_BUCKET), true);
  assert.equal(isPublicStorageBucket(PUBLIC_USER_MEDIA_BUCKET), false);
  assert.equal(isPublicStorageBucket(PRIVATE_USER_MEDIA_BUCKET), false);
  assert.equal(
    publicStorageUrl(PUBLIC_USER_MEDIA_BUCKET, "users/example/file"),
    null,
  );
  assert.equal(
    publicStorageUrl(PRIVATE_USER_MEDIA_BUCKET, "users/example/file"),
    null,
  );
  assert.match(
    storagePaths,
    /const PUBLIC_BUCKETS = new Set<SupabaseStorageBucket>\(\[\s*SITE_ASSETS_BUCKET,\s*\]\)/,
  );
  assert.doesNotMatch(
    storagePaths.match(/const PUBLIC_BUCKETS[\s\S]*?\]\);/)?.[0] ?? "",
    /PUBLIC_USER_MEDIA_BUCKET|PRIVATE_USER_MEDIA_BUCKET/,
  );

  assert.match(
    privateMediaMigration,
    /UPDATE storage\.buckets\s+SET public = false\s+WHERE id IN \('public-user-media', 'private-user-media'\)/,
  );
  for (const [operation, sqlOperation] of [
    ["select", "SELECT"],
    ["insert", "INSERT"],
    ["update", "UPDATE"],
    ["delete", "DELETE"],
  ] as const) {
    assert.match(
      privateMediaMigration,
      new RegExp(
        `CREATE POLICY "GreyhoundIQ deny direct user media ${operation}"[\\s\\S]*?AS RESTRICTIVE FOR ${sqlOperation} TO anon, authenticated`,
      ),
    );
  }
  assert.match(productionSafety, /--public-access-prevention/);

  assert.match(
    initialStorageMigration,
    /CREATE POLICY "GreyhoundIQ public read site assets"[\s\S]*USING \(bucket_id = 'site-assets'\)/,
  );
  for (const [operation, sqlOperation] of [
    ["upload", "INSERT"],
    ["update", "UPDATE"],
    ["delete", "DELETE"],
  ] as const) {
    assert.match(
      initialStorageMigration,
      new RegExp(
        `CREATE POLICY "GreyhoundIQ ${operation} site assets as admin"[\\s\\S]*?FOR ${sqlOperation}[\\s\\S]*?TO authenticated[\\s\\S]*?giq_is_storage_admin\\(\\)`,
      ),
    );
  }
  assert.match(
    privateMediaMigration,
    /DROP POLICY IF EXISTS "GreyhoundIQ public read public user media"/,
  );

  const routeFiles = listApiRuntimeFiles("src/app/api");
  assert.ok(routeFiles.length >= 75, "API runtime scan must remain non-vacuous");
  const customCatchRoutes: string[] = [];
  for (const routeFile of routeFiles) {
    const source = readFileSync(routeFile, "utf8");
    assert.doesNotMatch(
      source,
      /(?:err|error)\.stack|\bstack\s*:|JSON\.stringify\((?:err|error)\)|String\((?:err|error)\)|(?:error|message)\s*:\s*(?:err|error)\.message/,
      `${routeFile}: raw error or stack serialization`,
    );
    if (/catch\s*\(/.test(source) && !source.includes("jsonError")) {
      customCatchRoutes.push(routeFile.replaceAll("\\", "/"));
    }
  }
  assert.deepEqual(customCatchRoutes.sort(), [
    "src/app/api/health/ready/route.ts",
    "src/app/api/replay/stream/handler.ts",
    "src/app/api/webhooks/lago/route.ts",
    "src/app/api/webhooks/stripe/route.ts",
  ]);

  const stackMarker = "INFRASTRUCTURE_STACK_MARKER_DO_NOT_EXPOSE";
  const rawError = new Error("postgres password=do-not-expose");
  rawError.stack = `${stackMarker}\n    at private-database-host:5432`;
  const capturedErrors: string[] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => capturedErrors.push(args.join(" "));
  let response: Response;
  try {
    response = await jsonError(rawError, "Could not complete request");
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(response.status, 500);
  const responseBody = await response.text();
  assert.doesNotMatch(
    responseBody,
    /do-not-expose|private-database-host|STACK_MARKER/,
  );
  assert.equal(
    capturedErrors.length,
    1,
    "the private error must still be logged server-side",
  );

  const verifiedIds = Object.keys(
    INFRASTRUCTURE_POLICY_CONTROL_MASTER_EVIDENCE,
  );
  assert.deepEqual(verifiedIds, [
    ...VERIFIED_INFRASTRUCTURE_POLICY_CONTROL_IDS,
  ]);
  const openIds = OPEN_INFRASTRUCTURE_POLICY_CONTROL_GAPS.map(
    (gap) => gap.requirementId,
  );
  assert.equal(new Set([...verifiedIds, ...openIds]).size, 12);
  assert.equal(verifiedIds.length + openIds.length, 12);
  assert.match(
    INFRASTRUCTURE_POLICY_EVIDENCE_BOUNDARY,
    /does not verify deployed/,
  );
  for (const requirementId of [...verifiedIds, ...openIds]) {
    assert.ok(
      MASTER_AUDIT_REQUIREMENTS.some(
        (requirement) => requirement.id === requirementId,
      ),
      `${requirementId}: missing immutable requirement`,
    );
  }
  for (const gap of OPEN_INFRASTRUCTURE_POLICY_CONTROL_GAPS) {
    assert.ok(gap.reason.trim());
    assert.ok(gap.requiredEvidence.trim());
  }

  console.log(
    "Infrastructure policy controls passed: three locally verified controls and nine explicit deployment/operations gaps.",
  );
}

function listApiRuntimeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listApiRuntimeFiles(path);
    return entry.name === "route.ts" || entry.name === "handler.ts" ? [path] : [];
  });
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
