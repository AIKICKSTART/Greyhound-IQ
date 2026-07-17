import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  collectConfiguredServerSecrets,
  findClientBundleSecretLeaks,
  findExampleSecretIssues,
  findSecretBoundarySourceIssues,
} from "./check-secret-boundaries";

const validInputs = {
  ciWorkflow: `
    fetch-depth: 0
    ghcr.io/gitleaks/gitleaks@sha256:${"a".repeat(64)} git . --redact --no-banner
    - run: npm run build
    - run: npm run check:secret-boundaries -- --built
  `,
  deployWorkflow: `
    id-token: write
    uses: google-github-actions/auth@${"b".repeat(40)}
    with:
      workload_identity_provider: \${{ secrets.GCP_WIF_PROVIDER }}
      service_account: \${{ secrets.GCP_BUILD_SERVICE_ACCOUNT }}
  `,
  packageJson: JSON.stringify({
    scripts: { "check:secret-boundaries": "tsx scripts/check-secret-boundaries.ts" },
  }),
  exampleEnvironment: `
    DATABASE_URL="postgresql://user:YOUR_DB_PASSWORD@postgres/db"
    NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
    LIVEKIT_API_SECRET="devsecret"
  `,
};

assert.deepEqual(findSecretBoundarySourceIssues(validInputs), []);
assert.deepEqual(
  findSecretBoundarySourceIssues({
    ...validInputs,
    ciWorkflow: validInputs.ciWorkflow.replace("fetch-depth: 0", "fetch-depth: 1"),
  }),
  ["FULL_HISTORY_CHECKOUT_MISSING"],
);
assert.deepEqual(
  findSecretBoundarySourceIssues({
    ...validInputs,
    deployWorkflow: `${validInputs.deployWorkflow}\ncredentials_json: \${{ secrets.GCP_KEY }}`,
  }),
  ["LONG_LIVED_CLOUD_KEY_CONFIGURED"],
);
assert.deepEqual(
  findExampleSecretIssues('STRIPE_SECRET_KEY="sk_live_actual_value"'),
  ["EXAMPLE_SECRET_VALUE_NOT_PLACEHOLDER:STRIPE_SECRET_KEY"],
);

const configured = collectConfiguredServerSecrets({
  NEXTAUTH_SECRET: "server-secret-value",
  STRIPE_SECRET_KEY: "sk_test_YOUR_STRIPE_SECRET_KEY",
  GCP_WIF_PROVIDER: "projects/123/locations/global/pools/p/providers/github",
});
assert.deepEqual(configured, [
  { identifier: "NEXTAUTH_SECRET", value: "server-secret-value" },
]);

const directory = mkdtempSync(join(tmpdir(), "greyhoundiq-secret-boundary-"));
try {
  mkdirSync(join(directory, "chunks"));
  writeFileSync(join(directory, "chunks", "safe.js"), "public content");
  assert.deepEqual(findClientBundleSecretLeaks(directory, configured), []);

  writeFileSync(
    join(directory, "chunks", "leak.js"),
    `window.__bad = ${JSON.stringify(configured[0].value)}`,
  );
  assert.deepEqual(findClientBundleSecretLeaks(directory, configured), [
    {
      identifier: "NEXTAUTH_SECRET",
      file: join(directory, "chunks", "leak.js").replace(/\\/g, "/"),
    },
  ]);
} finally {
  rmSync(directory, { recursive: true, force: true });
}

console.log(
  "Secret boundary checker passed: CI, placeholders, managed identity and client bundle leakage fail closed.",
);
