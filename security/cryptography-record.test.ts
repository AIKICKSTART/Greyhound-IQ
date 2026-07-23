import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { CRYPTOGRAPHY_RECORD } from "./cryptography-record";
import {
  CRYPTOGRAPHY_RECORD_MASTER_EVIDENCE,
  CRYPTOGRAPHY_RECORD_REQUIREMENT_IDS,
} from "./cryptography-record-evidence";

const fields = Object.values(CRYPTOGRAPHY_RECORD);
assert.equal(fields.length, 10);
for (const field of fields) {
  assert.ok(field.observation.trim());
  assert.ok(field.verificationStatus.trim());
  assert.ok(field.requiredAction.trim());
  assert.ok(field.evidence.length > 0);
  for (const evidencePath of field.evidence) {
    assert.ok(existsSync(evidencePath), `missing ${evidencePath}`);
  }
}

assert.match(
  readFileSync("src/lib/realtime-service.ts", "utf8"),
  /createHmac\("sha256"/,
);
assert.match(
  readFileSync("src/lib/internal-auth.ts", "utf8"),
  /timingSafeEqual/,
);
assert.match(
  readFileSync("src/lib/call-token.ts", "utf8"),
  /new AccessToken[\s\S]*ttl: LIVEKIT_TOKEN_TTL_SECONDS/,
);
assert.match(
  readFileSync("src/lib/realtime-service.ts", "utf8"),
  /secret\.length < 32/,
);

assert.equal(CRYPTOGRAPHY_RECORD_REQUIREMENT_IDS.length, 10);
for (const requirementId of CRYPTOGRAPHY_RECORD_REQUIREMENT_IDS) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) =>
      candidate.prompt === "security" && candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    CRYPTOGRAPHY_RECORD_MASTER_EVIDENCE[requirementId],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
}

console.log(
  "cryptography record passed: 10 documented fields; live key and TLS controls remain open",
);
