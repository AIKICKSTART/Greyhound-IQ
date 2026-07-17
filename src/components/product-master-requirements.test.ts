import assert from "node:assert/strict";

import {
  PRODUCT_MASTER_PROMPT_ID,
  PRODUCT_MASTER_REQUIREMENTS,
  PRODUCT_MASTER_REQUIRED_SECTIONS,
  PRODUCT_MASTER_REQUIREMENT_TOTAL,
} from "./product-master-requirements";

assert.equal(
  PRODUCT_MASTER_REQUIREMENT_TOTAL,
  PRODUCT_MASTER_REQUIREMENTS.length,
);
assert.equal(
  new Set(PRODUCT_MASTER_REQUIREMENTS.map((item) => item.id)).size,
  PRODUCT_MASTER_REQUIREMENT_TOTAL,
  "master-prompt requirement IDs must be unique",
);

const actualSections = [
  ...new Set(PRODUCT_MASTER_REQUIREMENTS.map((item) => item.section)),
].toSorted();
assert.deepEqual(
  actualSections,
  [...PRODUCT_MASTER_REQUIRED_SECTIONS].toSorted(),
  "the atomic registry and required-section contract must stay aligned",
);

for (const section of PRODUCT_MASTER_REQUIRED_SECTIONS) {
  assert.ok(
    PRODUCT_MASTER_REQUIREMENTS.some((item) => item.section === section),
    `required section ${section} must contain at least one item`,
  );
}

for (const item of PRODUCT_MASTER_REQUIREMENTS) {
  assert.ok(item.id.length > 0);
  assert.equal(item.prompt, PRODUCT_MASTER_PROMPT_ID);
  assert.ok(item.section.length > 0);
  assert.ok(item.requirement.length > 0);
  assert.ok(item.owner.length > 0);
  assert.equal(typeof item.releaseBlocking, "boolean");
  assert.ok(Array.isArray(item.evidence));

  if (item.status === "verified" || item.status === "tested") {
    assert.ok(
      item.evidence.length > 0,
      `${item.id} cannot claim ${item.status} without evidence`,
    );
  }

  if (item.status === "excluded") {
    assert.ok(
      item.evidence.length > 0,
      `${item.id} must record the exclusion reason as evidence`,
    );
  }
}

assertSectionCount("outcomes", 10);
assertSectionCount("outputs", 17);
assertSectionCount("verification.e2e-journeys", 22);
assertSectionCount("verification.automated-gates", 14);
assertSectionCount("global.responsive-widths", 11);

console.log(
  `product master requirements tests passed (${PRODUCT_MASTER_REQUIREMENT_TOTAL} atomic items)`,
);

function assertSectionCount(section: string, expected: number): void {
  assert.equal(
    PRODUCT_MASTER_REQUIREMENTS.filter((item) => item.section === section)
      .length,
    expected,
    `${section} should preserve every atomic item from the master prompt`,
  );
}
