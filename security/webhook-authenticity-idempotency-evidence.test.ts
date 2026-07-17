import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  validateWebhookDeduplicationBindings,
  WEBHOOK_DEDUPLICATION_BINDINGS,
} from "./webhook-deduplication-ci-evidence";
import {
  buildWebhookAuthenticityIdempotencyMasterEvidence,
  WEBHOOK_AUTHENTICITY_IDEMPOTENCY_FACTS,
  WEBHOOK_AUTHENTICITY_IDEMPOTENCY_MASTER_EVIDENCE,
  WEBHOOK_AUTHENTICITY_IDEMPOTENCY_REQUIREMENT_IDS,
  type WebhookAuthenticityIdempotencyFacts,
} from "./webhook-authenticity-idempotency-evidence";

const webhookRouteFiles = collectRouteFiles("src/app").filter((file) =>
  /\/webhooks?\//i.test(file),
);
const readSource = (file: string) =>
  existsSync(file) ? readFileSync(file, "utf8") : undefined;

assert.deepEqual(
  validateWebhookDeduplicationBindings(
    WEBHOOK_DEDUPLICATION_BINDINGS,
    webhookRouteFiles,
    readSource,
  ),
  [],
);
assert.equal(WEBHOOK_DEDUPLICATION_BINDINGS.length, webhookRouteFiles.length);
assert.ok(
  WEBHOOK_DEDUPLICATION_BINDINGS.every(({ strategy }) =>
    ["domain-compare-and-set", "unique-receipt-and-fenced-reducer"].includes(
      strategy,
    ),
  ),
);

assert.deepEqual(
  validateWebhookDeduplicationBindings(
    WEBHOOK_DEDUPLICATION_BINDINGS,
    [...webhookRouteFiles, "src/app/api/webhooks/unregistered/route.ts"],
    readSource,
  ).filter((issue) => issue.startsWith("ROUTE_UNREGISTERED:")),
  ["ROUTE_UNREGISTERED:src/app/api/webhooks/unregistered/route.ts"],
);
const firstCheck = WEBHOOK_DEDUPLICATION_BINDINGS[0].sourceChecks[0];
assert.ok(firstCheck.requiredMarkers.length > 0);
assert.ok(
  validateWebhookDeduplicationBindings(
    WEBHOOK_DEDUPLICATION_BINDINGS,
    webhookRouteFiles,
    (file) =>
      file === firstCheck.file
        ? readSource(file)?.replaceAll(firstCheck.requiredMarkers[0], "")
        : readSource(file),
  ).some((issue) => issue.startsWith("MARKER_MISSING:")),
);

const immutableRequirementIds = new Set(
  SECURITY_MASTER_REQUIREMENTS.map(({ id }) => id),
);
for (const requirementId of WEBHOOK_AUTHENTICITY_IDEMPOTENCY_REQUIREMENT_IDS) {
  assert.ok(
    immutableRequirementIds.has(requirementId),
    `${requirementId}: missing immutable requirement`,
  );
  const evidence =
    WEBHOOK_AUTHENTICITY_IDEMPOTENCY_MASTER_EVIDENCE[requirementId];
  assert.equal(evidence.status, "verified");
  for (const path of evidence.evidence) {
    assert.ok(existsSync(path), `${requirementId}: missing ${path}`);
  }
}

for (const fact of Object.keys(
  WEBHOOK_AUTHENTICITY_IDEMPOTENCY_FACTS,
) as Array<keyof WebhookAuthenticityIdempotencyFacts>) {
  assert.deepEqual(
    buildWebhookAuthenticityIdempotencyMasterEvidence({
      ...WEBHOOK_AUTHENTICITY_IDEMPOTENCY_FACTS,
      [fact]: false,
    }),
    {},
    `${fact}: incomplete webhook proof must withhold both aggregate gates`,
  );
}

console.log(
  `Webhook authenticity/idempotency aggregate passed: ${webhookRouteFiles.length} ingresses have exact-body authentication and duplicate suppression.`,
);

function collectRouteFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Unsupported symlink under route source: ${fullPath}`);
      }
      if (entry.isDirectory()) return collectRouteFiles(fullPath);
      return entry.name === "route.ts"
        ? [relative(process.cwd(), fullPath).replaceAll("\\", "/")]
        : [];
    })
    .toSorted();
}
