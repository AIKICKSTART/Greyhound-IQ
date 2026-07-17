import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "src/components/design-lab-preproduction-checklist.tsx",
  "utf8"
);

assert.match(source, /isDesignLabPreproductionRequirementComplete\(item\)/);
assert.match(source, /isDesignLabDatabaseOperationComplete\(operation\)/);
assert.match(source, /role="checkbox"/);
assert.match(source, /aria-checked=\{complete\}/);
assert.match(source, /aria-readonly="true"/);
assert.match(source, /data-preproduction-complete/);
assert.match(source, /data-query-contract-complete/);
assert.doesNotMatch(source, /onClick=/);

console.log("Design Lab pre-production checklist UI tests passed");
