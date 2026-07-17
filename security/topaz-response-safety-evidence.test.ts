import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  TOPAZ_RESPONSE_SAFETY_FACTS,
  TOPAZ_RESPONSE_SAFETY_MASTER_EVIDENCE,
  VERIFIED_TOPAZ_RESPONSE_SAFETY_REQUIREMENT_IDS,
  evaluateTopazResponseSafetyFacts,
} from "./topaz-response-safety-evidence";

const root = process.cwd();
const source = readFileSync(resolve(root, "src/lib/live/topaz.ts"), "utf8");
const runtimeTest = readFileSync(
  resolve(root, "src/lib/live/topaz.test.ts"),
  "utf8",
);

assert.match(source, /readBoundedTextResponse\(response, TOPAZ_JSON_POLICY\)/);
assert.match(source, /schema\.safeParse\(payload\)/);
assert.match(source, /topaz\.response_invalid_json/);
assert.match(source, /topaz\.response_invalid/);
assert.match(source, /z\.array\(topazRecentResultSchema\)\.max\(5_000\)/);
assert.doesNotMatch(source, /response\.json\(\)/);
assert.match(runtimeTest, /rejectsInvalidFieldTypes/);
assert.match(runtimeTest, /rejectsMalformedAndOversizedResponses/);
assert.match(runtimeTest, /rejectsUnboundedCollections/);
assert.match(runtimeTest, /unexpectedPrivilege/);
assert.match(runtimeTest, /providerSecret/);

const evaluation = evaluateTopazResponseSafetyFacts(
  TOPAZ_RESPONSE_SAFETY_FACTS,
);
for (const requirementId of VERIFIED_TOPAZ_RESPONSE_SAFETY_REQUIREMENT_IDS) {
  assert.equal(evaluation[requirementId], true, requirementId);
  assert.equal(
    TOPAZ_RESPONSE_SAFETY_MASTER_EVIDENCE[requirementId]?.status,
    "verified",
    requirementId,
  );
}

console.log(
  `Topaz response safety evidence passed: ${VERIFIED_TOPAZ_RESPONSE_SAFETY_REQUIREMENT_IDS.length} control.`,
);
