import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import { SECURITY_CI_MASTER_EVIDENCE } from "./ci-gate-evidence";
import {
  WEBHOOK_DEDUPLICATION_BINDINGS,
  validateWebhookDeduplicationBindings,
} from "./webhook-deduplication-ci-evidence";

const webhookRouteFiles = collectRouteFiles("src/app").filter((file) =>
  /\/webhooks?\//i.test(file),
);
const sourceReader = (file: string) =>
  existsSync(file) ? readFileSync(file, "utf8") : undefined;

assert.deepEqual(
  validateWebhookDeduplicationBindings(
    WEBHOOK_DEDUPLICATION_BINDINGS,
    webhookRouteFiles,
    sourceReader,
  ),
  [],
);
assert.equal(WEBHOOK_DEDUPLICATION_BINDINGS.length, 3);
assert.deepEqual(
  WEBHOOK_DEDUPLICATION_BINDINGS.map(({ routeFile, strategy }) => ({
    routeFile,
    strategy,
  })),
  [
    {
      routeFile: "src/app/api/livekit/webhook/route.ts",
      strategy: "domain-compare-and-set",
    },
    {
      routeFile: "src/app/api/webhooks/lago/route.ts",
      strategy: "unique-receipt-and-fenced-reducer",
    },
    {
      routeFile: "src/app/api/webhooks/stripe/route.ts",
      strategy: "unique-receipt-and-fenced-reducer",
    },
  ],
);

const missingMarkerReader = (file: string) => {
  const source = sourceReader(file);
  return file === "src/lib/call-service.ts"
    ? source?.replace("if (flip.count === 0) return", "")
    : source;
};
assert.ok(
  validateWebhookDeduplicationBindings(
    WEBHOOK_DEDUPLICATION_BINDINGS,
    webhookRouteFiles,
    missingMarkerReader,
  ).some((issue) => issue.startsWith("MARKER_MISSING:")),
  "removing a compare-and-set guard must fail closed",
);
assert.deepEqual(
  validateWebhookDeduplicationBindings(
    WEBHOOK_DEDUPLICATION_BINDINGS,
    [...webhookRouteFiles, "src/app/api/webhooks/new-provider/route.ts"],
    sourceReader,
  ).filter((issue) => issue.startsWith("ROUTE_UNREGISTERED:")),
  ["ROUTE_UNREGISTERED:src/app/api/webhooks/new-provider/route.ts"],
  "a new webhook must not bypass the deduplication registry",
);

const requirementId = "security.ci.17.webhook-no-dedupe";
const requirement = MASTER_AUDIT_REQUIREMENTS.find(
  (candidate) => candidate.id === requirementId,
);
assert.ok(requirement, `${requirementId}: missing immutable requirement`);
assert.deepEqual(
  SECURITY_MASTER_EVIDENCE[requirementId],
  SECURITY_CI_MASTER_EVIDENCE[requirementId],
);
assert.equal(isMasterRequirementComplete(requirement), true);

console.log(
  "Webhook deduplication CI evidence passed: every webhook ingress has a registered unique-receipt or domain compare-and-set strategy.",
);

function collectRouteFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Unsupported symbolic link under route source: ${fullPath}`);
      }
      if (entry.isDirectory()) return collectRouteFiles(fullPath);
      return entry.name === "route.ts"
        ? [relative(process.cwd(), fullPath).replaceAll("\\", "/")]
        : [];
    })
    .toSorted();
}
