import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { resolveDesignLabAccessDecision } from "../src/lib/design-lab-access-policy";
import { isDemoReadMethod, isFullAccessDemo } from "../src/lib/demo-access";
import { DESIGN_LAB_ISOLATION_MASTER_EVIDENCE } from "./design-lab-isolation-evidence";

assert.equal(
  isFullAccessDemo({ APP_ENV: "demo", DEMO_AUTH_MODE: "full-access" }),
  true,
);
assert.equal(
  isFullAccessDemo({ APP_ENV: "production", DEMO_AUTH_MODE: "full-access" }),
  false,
);
assert.equal(
  isFullAccessDemo({ APP_ENV: "demo", DEMO_AUTH_MODE: "administrator" }),
  false,
);

assert.equal(
  resolveDesignLabAccessDecision({
    nodeEnv: "production",
    enabled: undefined,
    isolatedDemo: false,
  }),
  "deny",
);
assert.equal(
  resolveDesignLabAccessDecision({
    nodeEnv: "production",
    enabled: "true",
    isolatedDemo: false,
  }),
  "require-administrator",
);
assert.equal(
  resolveDesignLabAccessDecision({
    nodeEnv: "production",
    enabled: "true",
    isolatedDemo: true,
  }),
  "allow-isolated-demo",
);

for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
  assert.equal(isDemoReadMethod(method), false);
}
for (const method of ["GET", "HEAD", "OPTIONS"]) {
  assert.equal(isDemoReadMethod(method), true);
}

const layout = readFileSync("src/app/layout.tsx", "utf8");
const access = readFileSync("src/lib/design-lab-access.ts", "utf8");
const proxy = readFileSync("src/proxy.ts", "utf8");
const designLabPage = readFileSync("src/app/design-lab/page.tsx", "utf8");

assert.match(layout, /const user = fullAccessDemo \? null : await getCurrentUser\(\)/);
assert.match(
  layout,
  /const auth = fullAccessDemo \? \{ user: null as null \} : await withAuth\(\)/,
);
assert.match(layout, /data-demo-read-only=/);
assert.match(access, /import "server-only"/);
assert.match(access, /await requireAdminProfile\(\)/);
assert.match(access, /if \(decision === "deny"\) notFound\(\)/);
assert.match(designLabPage, /await requireDesignLabReviewer\(\)/);
assert.match(designLabPage, /robots: \{ index: false, follow: false \}/);
assert.match(
  proxy,
  /if \(demo && !isDemoReadMethod\(request\.method\)\) \{\s*return securedErrorResponse\(403, "demo\.read_only"/,
);

const expectedIds = Object.keys(DESIGN_LAB_ISOLATION_MASTER_EVIDENCE);
assert.equal(expectedIds.length, 3);
for (const requirementId of expectedIds) {
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    DESIGN_LAB_ISOLATION_MASTER_EVIDENCE[requirementId],
  );
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.equal(isMasterRequirementComplete(requirement), true);
}

console.log(
  "Design Lab isolation passed: simulation cannot change real authorization or mutate production data",
);
