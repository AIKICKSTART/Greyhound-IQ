import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import { SECURITY_MASTER_REQUIREMENTS } from "./security-master-requirements";
import {
  PRODUCT_MASTER_EVIDENCE,
  SECURITY_MASTER_EVIDENCE,
  TESTED_REGISTERED_PAGE_ROUTE_REQUIREMENTS,
} from "./master-audit-evidence";
import { PRODUCT_ROUTE_MASTER_EVIDENCE } from "./product-route-master-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  MASTER_AUDIT_SUMMARY,
  isMasterRequirementComplete,
  type MasterAuditRequirement,
} from "./master-audit-requirements";

const repositoryRoot = resolve(__dirname, "../..");
const testedPromotionEvidence = {
  "REG.ROUTE.single-source": [
    "src/components/demo-experience-registry.ts",
    "src/components/demo-experience-registry.test.ts",
  ],
  "REG.ROUTE.field-id": [
    "src/components/demo-experience-registry.ts",
    "src/components/demo-experience-registry.test.ts",
  ],
  "REG.ROUTE.field-route": [
    "src/components/demo-experience-registry.ts",
    "src/components/demo-experience-registry.test.ts",
  ],
  "REG.ROUTE.field-description": [
    "src/components/demo-experience-registry.ts",
    "src/components/demo-experience-registry.test.ts",
  ],
  "REG.ROUTE.field-actors": [
    "src/components/demo-experience-registry.ts",
    "src/components/demo-experience-registry.test.ts",
  ],
  "REG.ROUTE.field-authentication": [
    "src/components/demo-experience-registry.ts",
    "src/components/demo-experience-registry.test.ts",
  ],
  "REG.ROUTE.field-roles": [
    "src/components/demo-experience-registry.ts",
    "src/components/demo-experience-registry.test.ts",
  ],
  "REG.ROUTE.field-tiers": [
    "src/components/demo-experience-registry.ts",
    "src/components/demo-experience-registry.test.ts",
  ],
  "ROUTE.PUBLIC.not-found": [
    "src/app/not-found.tsx",
    "src/proxy-detail-routes.test.ts",
  ],
  "SYSTEM.not-found": [
    "src/app/not-found.tsx",
    "src/proxy-detail-routes.test.ts",
  ],
  "DL.ROUTE.demo-experience": [
    "src/app/design-lab/demo-experience/page.tsx",
    "src/components/screen-contracts/design-lab-screen-inventory.test.ts",
    "src/components/design-lab-route-safety.test.ts",
  ],
  "DL.ROUTE.dock-skins": [
    "src/app/design-lab/dock-skins/page.tsx",
    "src/components/screen-contracts/design-lab-screen-inventory.test.ts",
    "src/components/design-lab-route-safety.test.ts",
  ],
  "DL.ROUTE.role-blueprints": [
    "src/app/design-lab/role-blueprints/page.tsx",
    "src/components/screen-contracts/design-lab-screen-inventory.test.ts",
    "src/components/design-lab-route-safety.test.ts",
  ],
  "DL.ROUTE.feed-device-preview": [
    "src/app/feed/device-preview/page.tsx",
    "src/components/screen-contracts/design-lab-screen-inventory.test.ts",
    "src/components/design-lab-route-safety.test.ts",
  ],
  "DL.ROUTE.marketplace": [
    "src/app/marketplace/design-lab/page.tsx",
    "src/components/screen-contracts/design-lab-screen-inventory.test.ts",
    "src/components/design-lab-route-safety.test.ts",
  ],
  "DL.SAFE.no-production-data": [
    "src/lib/demo-production-isolation.test.ts",
    "src/lib/design-lab-local-data-policy.test.ts",
    "security/local-data-policy.ts",
  ],
} as const;

assert.equal(
  MASTER_AUDIT_REQUIREMENTS.length,
  PRODUCT_MASTER_REQUIREMENTS.length + SECURITY_MASTER_REQUIREMENTS.length,
);
assert.equal(
  new Set(MASTER_AUDIT_REQUIREMENTS.map((item) => item.id)).size,
  MASTER_AUDIT_REQUIREMENTS.length,
  "Master requirement IDs must be unique across both prompts.",
);
assert.equal(
  MASTER_AUDIT_SUMMARY.prompts.product,
  PRODUCT_MASTER_REQUIREMENTS.length,
);
assert.equal(
  MASTER_AUDIT_SUMMARY.prompts.security,
  SECURITY_MASTER_REQUIREMENTS.length,
);
assert.ok(
  MASTER_AUDIT_REQUIREMENTS.every((item) => item.owner.trim().length > 0),
);
assert.ok(
  MASTER_AUDIT_REQUIREMENTS.every(
    (item) =>
      item.requirement.trim().length > 0 && item.section.trim().length > 0,
  ),
);
for (const [id, record] of Object.entries(PRODUCT_MASTER_EVIDENCE)) {
  assert.ok(
    PRODUCT_MASTER_REQUIREMENTS.some((item) => item.id === id),
    `Evidence references unknown product requirement ${id}.`,
  );
  assert.ok(record.evidence.length > 0, `${id} must name durable evidence.`);
  for (const evidencePath of record.evidence) {
    assert.ok(
      existsSync(resolve(repositoryRoot, evidencePath)),
      `${id} evidence does not exist: ${evidencePath}`,
    );
  }
}
for (const [id, expectedEvidence] of Object.entries(testedPromotionEvidence)) {
  const evidenceRecord = PRODUCT_MASTER_EVIDENCE[id];
  assert.equal(evidenceRecord?.status, "tested", `${id} must remain tested`);
  assert.deepEqual(
    evidenceRecord?.evidence,
    expectedEvidence,
    `${id} must retain its complete focused evidence set`,
  );
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (item) => item.prompt === "product" && item.id === id,
  );
  assert.ok(requirement, `${id} must remain in the product master registry`);
  assert.equal(requirement.status, "tested");
  assert.equal(isMasterRequirementComplete(requirement), true);
}
for (const [id, route] of Object.entries(
  TESTED_REGISTERED_PAGE_ROUTE_REQUIREMENTS,
)) {
  const expectedEvidence = PRODUCT_ROUTE_MASTER_EVIDENCE[id].evidence;
  const evidenceRecord = PRODUCT_MASTER_EVIDENCE[id];
  assert.equal(evidenceRecord?.status, "tested", `${id} must remain tested`);
  assert.deepEqual(
    evidenceRecord?.evidence,
    expectedEvidence,
    `${id} must remain bound to its page, exact registry parity and route audit`,
  );
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (item) => item.prompt === "product" && item.id === id,
  );
  assert.ok(requirement, `${id} must remain in the product master registry`);
  assert.equal(requirement.requirement, `Register and cover ${route}.`);
  assert.equal(isMasterRequirementComplete(requirement), true);
}
for (const [id, record] of Object.entries(SECURITY_MASTER_EVIDENCE)) {
  assert.ok(
    SECURITY_MASTER_REQUIREMENTS.some((item) => item.id === id),
    `Evidence references unknown security requirement ${id}.`,
  );
  assert.ok(record.evidence.length > 0, `${id} must name durable evidence.`);
  for (const evidencePath of record.evidence) {
    assert.ok(
      existsSync(resolve(repositoryRoot, evidencePath)),
      `${id} evidence does not exist: ${evidencePath}`,
    );
  }
}

const productComplete: MasterAuditRequirement = {
  ...MASTER_AUDIT_REQUIREMENTS.find((item) => item.prompt === "product")!,
  status: "verified",
  evidence: ["test:product"],
};
const securityComplete: MasterAuditRequirement = {
  ...MASTER_AUDIT_REQUIREMENTS.find((item) => item.prompt === "security")!,
  status: "verified",
  evidence: ["test:security"],
};
assert.equal(isMasterRequirementComplete(productComplete), true);
assert.equal(isMasterRequirementComplete(securityComplete), true);

for (const prompt of ["product", "security"] as const) {
  const output = MASTER_AUDIT_REQUIREMENTS.find(
    (item) =>
      item.prompt === prompt &&
      item.section === (prompt === "product" ? "outputs" : "required-output"),
  );
  assert.ok(output, `${prompt} required output must exist`);
  assert.equal(isMasterRequirementComplete(output), true);
  assert.equal(
    isMasterRequirementComplete({ ...output, verificationScope: undefined }),
    false,
    `${prompt} output existence must not become an unscoped readiness claim`,
  );
}

for (const section of [
  "final-traceability-field",
  "final-summary-metric",
] as const) {
  const finalReportRequirement = MASTER_AUDIT_REQUIREMENTS.find(
    (item) => item.prompt === "security" && item.section === section,
  );
  assert.ok(finalReportRequirement, `${section} requirement must exist`);
  assert.equal(
    finalReportRequirement.verificationScope,
    "final-report-structure-only",
  );
  assert.equal(isMasterRequirementComplete(finalReportRequirement), true);
  assert.equal(
    isMasterRequirementComplete({
      ...finalReportRequirement,
      verificationScope: undefined,
    }),
    false,
    `${section} must not become an unscoped readiness claim`,
  );
  assert.equal(
    isMasterRequirementComplete({
      ...finalReportRequirement,
      verificationScope: "output-existence-only",
    }),
    false,
    `${section} requires the exact final-report structure scope`,
  );
  assert.equal(
    isMasterRequirementComplete({
      ...finalReportRequirement,
      status: "not-applicable-with-justification",
      notApplicableJustification: "test-only mutation",
      verificationScope: undefined,
    }),
    false,
    `${section} cannot bypass its scope through another completion status`,
  );
}
assert.equal(
  isMasterRequirementComplete({ ...productComplete, evidence: [] }),
  false,
);
assert.equal(
  isMasterRequirementComplete({
    ...securityComplete,
    status: "risk-accepted-temporarily",
  }),
  false,
);
assert.equal(
  isMasterRequirementComplete({
    ...securityComplete,
    status: "not-applicable-with-justification",
    notApplicableJustification:
      "The product has no password authentication path.",
  }),
  true,
);
assert.equal(
  isMasterRequirementComplete({
    ...securityComplete,
    status: "risk-accepted-temporarily",
    riskAcceptance: {
      owner: "Security owner",
      reason: "Time-bound low residual risk.",
      severity: "low",
      compensatingControls: ["Alert and deny on anomaly"],
      expiresOn: "2099-01-01",
      remediationPlan: "Replace the temporary control.",
      retestRequirement: "Repeat the negative test before expiry.",
    },
  }),
  true,
);

console.log("Master product and security requirement registry tests passed");
