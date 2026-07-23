import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { PRODUCT_MASTER_EVIDENCE } from "./master-audit-evidence";
import {
  PRODUCT_ADMIN_SECRET_SAFETY_EVIDENCE_FILE,
  PRODUCT_ADMIN_SECRET_SAFETY_MASTER_EVIDENCE,
  PRODUCT_ADMIN_SECRET_SAFETY_REQUIREMENT_IDS,
  PRODUCT_ADMIN_SECRET_SAFETY_SCOPE,
  PRODUCT_ADMIN_SECRET_SAFETY_TEST_FILE,
} from "./product-admin-secret-safety-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

const REQUIREMENT_ID = "ROUTE.ADMIN.secret-safety" as const;
const productionFiles = sourceFiles("src/app/admin").filter(
  (file) => !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file),
);

assert.deepEqual(PRODUCT_ADMIN_SECRET_SAFETY_REQUIREMENT_IDS, [REQUIREMENT_ID]);
assert.equal(
  PRODUCT_MASTER_REQUIREMENTS.find(({ id }) => id === REQUIREMENT_ID)
    ?.requirement,
  "Never expose internal errors, secrets, or provider payloads.",
);
const evidence = PRODUCT_ADMIN_SECRET_SAFETY_MASTER_EVIDENCE[REQUIREMENT_ID];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_ADMIN_SECRET_SAFETY_EVIDENCE_FILE,
  PRODUCT_ADMIN_SECRET_SAFETY_TEST_FILE,
]);
assert.deepEqual(PRODUCT_MASTER_EVIDENCE[REQUIREMENT_ID], evidence);
evidence.evidence.forEach((file) => assert.equal(existsSync(file), true, file));

assert.equal(productionFiles.length, 47);
for (const file of productionFiles) {
  const source = readFileSync(file, "utf8");
  const disclosureSource = source
    .replaceAll('err.message === "auth.unauthorized"', "")
    .replaceAll('err.message === "auth.forbidden"', "")
    .replaceAll('err.message === "auth.profile_missing"', "");
  assert.doesNotMatch(
    disclosureSource,
    /(?:error|err)\.(?:message|stack)|String\((?:error|err)\)|JSON\.stringify\((?:error|err)\)/,
    file,
  );
  assert.doesNotMatch(
    source,
    /\.(?:rawPayload|payload|requestBody|responseBody|webhookBody|secret|token|metadata|errorMessage|lastError)\b/,
    file,
  );
  if (/^\s*["']use client["'];?/m.test(source.slice(0, 300))) {
    assert.doesNotMatch(
      source,
      /process\.env|getStripeCheckoutEnv|getStripeClient|secretKey|SERVICE_ROLE|DATABASE_URL/,
      file,
    );
  }
}

const pricingAdmin = readFileSync("src/app/admin/site-content/page.tsx", "utf8");
assert.match(pricingAdmin, /catch \{[\s\S]*unavailable: true/);
assert.match(pricingAdmin, /Could not read Stripe prices\. Try again later\./);
assert.doesNotMatch(pricingAdmin, /error: err|stripe\.error|err\.message/);

const errorBoundary = readFileSync("src/app/admin/error.tsx", "utf8");
assert.match(errorBoundary, /Reference \{error\.digest\}/);
assert.doesNotMatch(errorBoundary, /error\.(?:message|stack)/);

const reportRoute = readFileSync(
  "src/app/api/reports/[id]/resolve/route.ts",
  "utf8",
);
assert.match(reportRoute, /return jsonError\(err, "Could not resolve report"\)/);
assert.doesNotMatch(reportRoute, /NextResponse\.json\([^\n]*(?:err|error)/);

assert.match(PRODUCT_ADMIN_SECRET_SAFETY_SCOPE, /complete current src\/app\/admin/i);
assert.match(PRODUCT_ADMIN_SECRET_SAFETY_SCOPE, /fixed recovery copy/i);
assert.match(PRODUCT_ADMIN_SECRET_SAFETY_SCOPE, /does not prove deployed provider behavior/i);
assert.doesNotMatch(
  readFileSync(PRODUCT_ADMIN_SECRET_SAFETY_EVIDENCE_FILE, "utf8"),
  /from ["']node:/,
);

console.log(
  `Administrator secret-safety evidence passed across ${productionFiles.length} production source files.`,
);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return /\.[cm]?[jt]sx?$/.test(entry.name)
      ? [file.replaceAll("\\", "/")]
      : [];
  });
}
