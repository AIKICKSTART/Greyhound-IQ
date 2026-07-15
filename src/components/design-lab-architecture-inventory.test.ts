import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  ARCHITECTURE_COMPONENT_FIELD_REQUIREMENTS,
  ARCHITECTURE_COMPONENTS,
  ARCHITECTURE_INFRASTRUCTURE_SURFACES,
  ARCHITECTURE_INVENTORY_EVIDENCE,
  ARCHITECTURE_MASTER_EVIDENCE_REQUIREMENT_IDS,
  ARCHITECTURE_TRUST_FLOW_FIELD_REQUIREMENTS,
  ARCHITECTURE_TRUST_FLOWS,
} from "./design-lab-architecture-inventory";
import { SECURITY_MASTER_EVIDENCE } from "./master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "./master-audit-requirements";
import { SECURITY_MASTER_REQUIREMENTS } from "./security-master-requirements";

const targetSections = new Set([
  "architecture-infrastructure-surface",
  "architecture-component-record",
  "trust-boundary-diagram",
]);
const targetRequirements = SECURITY_MASTER_REQUIREMENTS.filter((requirement) =>
  targetSections.has(requirement.section),
);
const targetIds = targetRequirements.map((requirement) => requirement.id).toSorted();

assert.equal(ARCHITECTURE_COMPONENTS.length, 25);
assert.equal(ARCHITECTURE_COMPONENT_FIELD_REQUIREMENTS.length, 12);
assert.equal(ARCHITECTURE_INFRASTRUCTURE_SURFACES.length, 32);
assert.equal(ARCHITECTURE_TRUST_FLOWS.length, 16);
assert.equal(ARCHITECTURE_TRUST_FLOW_FIELD_REQUIREMENTS.length, 13);
assert.equal(ARCHITECTURE_MASTER_EVIDENCE_REQUIREMENT_IDS.length, 73);
assert.equal(
  new Set(ARCHITECTURE_MASTER_EVIDENCE_REQUIREMENT_IDS).size,
  ARCHITECTURE_MASTER_EVIDENCE_REQUIREMENT_IDS.length,
);
assert.deepEqual(
  [...ARCHITECTURE_MASTER_EVIDENCE_REQUIREMENT_IDS].toSorted(),
  targetIds,
  "Architecture evidence must cover exactly the three source-static master sections.",
);

const componentIds = new Set(ARCHITECTURE_COMPONENTS.map(({ id }) => id));
assert.equal(componentIds.size, ARCHITECTURE_COMPONENTS.length);
assert.equal(componentIds.has("application-realtime"), true);
assert.equal(componentIds.has("supabase-transition"), false);
assert.ok(
  ARCHITECTURE_COMPONENTS.every(
    ({ evidence, regions }) => evidence.length > 0 && regions.length > 0,
  ),
);
for (const [requirementId, field] of ARCHITECTURE_COMPONENT_FIELD_REQUIREMENTS) {
  assert.equal(
    recordsHaveExplicitValue(ARCHITECTURE_COMPONENTS, field),
    true,
    `${requirementId} requires every component to record ${field}`,
  );
  const firstWithoutField = omitField(ARCHITECTURE_COMPONENTS[0], field);
  assert.equal(
    recordsHaveExplicitValue([firstWithoutField, ...ARCHITECTURE_COMPONENTS.slice(1)], field),
    false,
    `${requirementId} must fail closed when one component omits ${field}`,
  );
}

const infrastructureRequirements = SECURITY_MASTER_REQUIREMENTS.filter(
  ({ section }) => section === "architecture-infrastructure-surface",
).map(({ id }) => id);
assert.deepEqual(
  ARCHITECTURE_INFRASTRUCTURE_SURFACES.map(({ requirementId }) => requirementId).toSorted(),
  infrastructureRequirements.toSorted(),
);
for (const item of ARCHITECTURE_INFRASTRUCTURE_SURFACES) {
  assert.ok(item.note.trim(), `${item.id} needs an explicit mapping note`);
  assert.ok(item.evidence.length > 0, `${item.id} needs evidence`);
  assert.ok(item.componentIds.length > 0, `${item.id} needs a component mapping`);
  for (const componentId of item.componentIds) {
    assert.ok(componentIds.has(componentId), `${item.id} references unknown ${componentId}`);
  }
}
assert.deepEqual(
  ARCHITECTURE_INFRASTRUCTURE_SURFACES.find(({ id }) => id === "object-storage")
    ?.componentIds,
  ["au-object-storage"],
);
assert.deepEqual(
  ARCHITECTURE_INFRASTRUCTURE_SURFACES.find(
    ({ id }) => id === "messaging-provider",
  )?.componentIds,
  ["livekit-calls", "application-realtime"],
);
assert.deepEqual(
  [...new Set(ARCHITECTURE_INFRASTRUCTURE_SURFACES.flatMap(({ componentIds }) => componentIds))].toSorted(),
  [...componentIds].toSorted(),
  "Every component record must be reachable from the infrastructure surface map.",
);
const brokenSurface = {
  ...ARCHITECTURE_INFRASTRUCTURE_SURFACES[0],
  componentIds: ["missing-component"],
};
assert.equal(
  brokenSurface.componentIds.every((id) => componentIds.has(id)),
  false,
  "Surface mappings must fail closed on an unknown component.",
);

const requiredFlowIds = SECURITY_MASTER_REQUIREMENTS.filter(
  ({ section, id }) =>
    section === "trust-boundary-diagram" &&
    !ARCHITECTURE_TRUST_FLOW_FIELD_REQUIREMENTS.some(
      ([fieldRequirementId]) => fieldRequirementId === id,
    ),
).map(({ id }) => id);
assert.deepEqual(
  ARCHITECTURE_TRUST_FLOWS.map(({ requirementId }) => requirementId).toSorted(),
  requiredFlowIds.toSorted(),
);
assert.equal(
  new Set(ARCHITECTURE_TRUST_FLOWS.map(({ id }) => id)).size,
  ARCHITECTURE_TRUST_FLOWS.length,
);
assert.ok(ARCHITECTURE_TRUST_FLOWS.every(({ path }) => path.length >= 2));
assert.ok(
  ARCHITECTURE_TRUST_FLOWS.every(
    ({ evidence, format }) =>
      evidence.length > 0 && format === "Design Lab typed flow v1",
  ),
);
for (const [requirementId, field] of ARCHITECTURE_TRUST_FLOW_FIELD_REQUIREMENTS) {
  assert.equal(
    recordsHaveExplicitValue(ARCHITECTURE_TRUST_FLOWS, field),
    true,
    `${requirementId} requires ${field} in every flow`,
  );
  const firstWithoutField = omitField(ARCHITECTURE_TRUST_FLOWS[0], field);
  assert.equal(
    recordsHaveExplicitValue([firstWithoutField, ...ARCHITECTURE_TRUST_FLOWS.slice(1)], field),
    false,
    `${requirementId} must fail closed when one flow omits ${field}`,
  );
}

const repositoryRoot = resolve(__dirname, "../..");
for (const path of ARCHITECTURE_INVENTORY_EVIDENCE) {
  assert.equal(existsSync(resolve(repositoryRoot, path)), true, `Missing ${path}`);
}
for (const path of new Set([
  ...ARCHITECTURE_COMPONENTS.flatMap(({ evidence }) => evidence),
  ...ARCHITECTURE_INFRASTRUCTURE_SURFACES.flatMap(({ evidence }) => evidence),
  ...ARCHITECTURE_TRUST_FLOWS.flatMap(({ evidence }) => evidence),
])) {
  assert.equal(existsSync(resolve(repositoryRoot, path)), true, `Missing ${path}`);
}

for (const id of ARCHITECTURE_MASTER_EVIDENCE_REQUIREMENT_IDS) {
  assert.deepEqual(SECURITY_MASTER_EVIDENCE[id], {
    status: "verified",
    evidence: ARCHITECTURE_INVENTORY_EVIDENCE,
  });
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.prompt === "security" && candidate.id === id,
  );
  assert.ok(requirement, `${id} must remain in the combined master registry`);
  assert.equal(isMasterRequirementComplete(requirement), true);
}

console.log(
  "Design Lab architecture source evidence passed: 32 surfaces, 12 component fields and 29 trust-flow checks; runtime claims remain unverified.",
);

function recordsHaveExplicitValue(records: readonly object[], field: string) {
  return (
    records.length > 0 &&
    records.every((record) => {
      if (!Object.prototype.hasOwnProperty.call(record, field)) return false;
      const value = Reflect.get(record, field);
      if (Array.isArray(value)) {
        return value.length > 0 && value.every((item) => String(item).trim());
      }
      return typeof value === "string" && value.trim().length > 0;
    })
  );
}

function omitField(record: object, field: string) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== field));
}
