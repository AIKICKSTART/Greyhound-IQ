import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { MASTER_AUDIT_REQUIREMENTS } from "../src/components/master-audit-requirements";
import {
  INPUT_VALIDATION_BOUNDARY_MASTER_EVIDENCE,
  INPUT_VALIDATION_BOUNDARY_REQUIREMENT_IDS,
} from "./input-validation-boundary-evidence";

assert.deepEqual(
  Object.keys(INPUT_VALIDATION_BOUNDARY_MASTER_EVIDENCE),
  INPUT_VALIDATION_BOUNDARY_REQUIREMENT_IDS,
);

for (const requirementId of INPUT_VALIDATION_BOUNDARY_REQUIREMENT_IDS) {
  assert.ok(
    MASTER_AUDIT_REQUIREMENTS.some(({ id }) => id === requirementId),
    `${requirementId}: immutable requirement missing`,
  );
}

const source = readFileSync("src/lib/json-request.ts", "utf8");
for (const marker of [
  "JSON_REQUEST_MAX_ARRAY_ITEMS",
  "JSON_REQUEST_MAX_DEPTH",
  "assertUtf8Charset(contentType)",
  "assertJsonShape(value)",
]) {
  assert.ok(source.includes(marker), `JSON request boundary missing ${marker}`);
}

const tests = readFileSync("src/lib/json-request.test.ts", "utf8");
for (const marker of [
  "charset=iso-8859-1",
  "JSON_REQUEST_MAX_ARRAY_ITEMS + 1",
  "JSON_REQUEST_MAX_DEPTH + 1",
]) {
  assert.ok(tests.includes(marker), `JSON request regression missing ${marker}`);
}

console.log(
  "Input-validation boundary evidence passed: JSON request charsets, arrays and nesting are explicitly bounded.",
);
