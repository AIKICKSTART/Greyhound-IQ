import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  DATABASE_CANONICAL_FACT_DECISIONS,
  DATABASE_CANONICAL_FACT_IDS,
} from "./database-canonical-fact-decisions";

assert.deepEqual(
  DATABASE_CANONICAL_FACT_DECISIONS.map(({ id }) => id),
  DATABASE_CANONICAL_FACT_IDS,
  "Every reviewed canonical-fact decision must remain present and ordered.",
);

const projectionIds = new Set<string>();
for (const decision of DATABASE_CANONICAL_FACT_DECISIONS) {
  assert.equal(decision.status, "accepted", `${decision.id} must be accepted.`);
  assert.ok(decision.decisionOwner.trim(), `${decision.id} needs a decision owner.`);
  assert.ok(decision.canonicalFact.trim().endsWith("."), `${decision.id} needs one canonical fact.`);
  assert.ok(decision.rationale.trim().endsWith("."), `${decision.id} needs a rationale.`);
  decision.sourceRefs.forEach(assertSourceReference);

  for (const projection of decision.retainedProjections) {
    assert.equal(projectionIds.has(projection.id), false, `${projection.id} must be unique.`);
    projectionIds.add(projection.id);
    assert.ok(projection.writer.trim(), `${projection.id} needs exactly one named writer.`);
    assertSourceReference(projection.writerRef);
    assert.equal(projection.driftThreshold, 0, `${projection.id} must fail on any drift.`);
    assert.match(
      projection.reconciliationRule,
      /\b(?:exactly|same|equal|match|trace|reference|exist|rebuild|true|newest)\b/i,
      `${projection.id} needs an objective reconciliation rule.`,
    );
  }
}

console.log(
  `Database canonical-fact ADRs passed: ${DATABASE_CANONICAL_FACT_DECISIONS.length} accepted decisions and ${projectionIds.size} single-writer projections with zero drift tolerance.`,
);

function assertSourceReference(reference: string) {
  const separator = reference.indexOf("#");
  assert.ok(separator > 0 && separator < reference.length - 1, `${reference} must include a source anchor.`);
  const path = reference.slice(0, separator);
  const anchor = reference.slice(separator + 1);
  assert.match(path, /^(?:prisma|src)\//, `${reference} must remain repository-local.`);
  assert.ok(
    readFileSync(resolve(path), "utf8").includes(anchor),
    `${reference} must resolve to current source.`,
  );
}
