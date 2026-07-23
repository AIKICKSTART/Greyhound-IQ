import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  JSON_REQUEST_MAX_DEPTH,
  readBoundedJsonRequest,
} from "../src/lib/json-request";
import {
  buildNestedInputLimitMasterEvidence,
  NESTED_INPUT_LIMIT_FACTS,
  NESTED_INPUT_LIMIT_MASTER_EVIDENCE,
  NESTED_INPUT_LIMIT_REQUIREMENT_ID,
  NESTED_INPUT_LIMIT_SCOPE,
} from "./nested-input-limit-aggregate-evidence";

async function main() {
  const requirement = SECURITY_MASTER_REQUIREMENTS.find(
    ({ id }) => id === NESTED_INPUT_LIMIT_REQUIREMENT_ID,
  );
  assert.ok(requirement, "immutable nested-input limit requirement missing");
  assert.equal(requirement.requirement, "Define nested-object limits.");

  const evidence =
    NESTED_INPUT_LIMIT_MASTER_EVIDENCE[NESTED_INPUT_LIMIT_REQUIREMENT_ID];
  assert.ok(evidence, "nested-input limit evidence must be emitted");
  assert.equal(evidence.status, "verified");
  for (const path of evidence.evidence) {
    assert.ok(existsSync(path), `missing nested-input evidence: ${path}`);
  }
  assert.equal(NESTED_INPUT_LIMIT_FACTS.jsonRouteInventoryCount, 33);
  assert.match(NESTED_INPUT_LIMIT_SCOPE, /not a claim about provider payloads/i);

  assert.deepEqual(
    await parseNested(JSON_REQUEST_MAX_DEPTH),
    nestedObject(JSON_REQUEST_MAX_DEPTH),
    "the documented maximum depth must remain accepted",
  );
  await assert.rejects(
    parseNested(JSON_REQUEST_MAX_DEPTH + 1),
    /request\.invalid_body/,
    "one level beyond the maximum must fail closed",
  );

  for (const fact of [
    "sharedDepthPolicy",
    "boundedRequestBodyPolicy",
  ] as const) {
    assert.deepEqual(
      buildNestedInputLimitMasterEvidence({
        ...NESTED_INPUT_LIMIT_FACTS,
        [fact]: false,
      }),
      {},
      `${fact}: missing enforcement must withhold master evidence`,
    );
  }
  assert.deepEqual(
    buildNestedInputLimitMasterEvidence({
      ...NESTED_INPUT_LIMIT_FACTS,
      jsonRouteInventoryCount: 0,
    }),
    {},
    "a vacuous route inventory must withhold master evidence",
  );

  console.log(
    `Nested-input limit aggregate passed: depth ${JSON_REQUEST_MAX_DEPTH} accepted, depth ${JSON_REQUEST_MAX_DEPTH + 1} rejected, and ${NESTED_INPUT_LIMIT_FACTS.jsonRouteInventoryCount} JSON/form routes remain on bounded readers.`,
  );
}

function parseNested(depth: number) {
  return readBoundedJsonRequest(
    new Request("http://local.test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(nestedObject(depth)),
    }),
  );
}

function nestedObject(depth: number) {
  let value: unknown = "leaf";
  for (let index = 0; index < depth; index += 1) {
    value = { value };
  }
  return value;
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
