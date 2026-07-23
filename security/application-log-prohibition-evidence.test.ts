import assert from "node:assert/strict";

import { logError, logWarn } from "../src/lib/logger";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import {
  APPLICATION_LOG_PROHIBITION_MASTER_EVIDENCE,
  APPLICATION_LOG_PROHIBITION_REQUIREMENT_IDS,
} from "./application-log-prohibition-evidence";

const secrets = {
  password: "password-evidence-secret",
  sessionToken: "session-evidence-secret",
  accessToken: "access-evidence-secret",
  refreshToken: "refresh-evidence-secret",
  recoveryToken: "recovery-evidence-secret",
  webhookSignature: "webhook-evidence-secret",
  apiSecret: "api-evidence-secret",
  cardNumber: "4111111111111111",
  cardCvc: "123",
  databaseUrl: "postgresql://user:database-evidence-secret@db.example/app",
  authenticationHeader: "Bearer authentication-evidence-secret",
  privateMessageBody: "private-message-evidence-secret",
  uploadedFileContents: "uploaded-file-evidence-secret",
  providerPayload: "provider-payload-evidence-secret",
};
const forbiddenValues = Object.values(secrets);
const lines: string[] = [];
const originalWarn = console.warn;
const originalError = console.error;
console.warn = (line: string) => lines.push(line);
console.error = (line: string) => lines.push(line);
try {
  logWarn("security.redaction_context", secrets);
  logError(
    "security.redaction_error",
    {},
    new Error(
      "password=password-evidence-secret sessionToken=session-evidence-secret accessToken=access-evidence-secret refreshToken=refresh-evidence-secret recoveryToken=recovery-evidence-secret webhookSignature=webhook-evidence-secret apiSecret=api-evidence-secret cardNumber=4111111111111111 cardCvc=123 databaseUrl=postgresql://user:database-evidence-secret@db.example/app authenticationHeader=Bearer-authentication-evidence-secret privateMessageBody=private-message-evidence-secret uploadedFileContents=uploaded-file-evidence-secret providerPayload=provider-payload-evidence-secret",
    ),
  );
} finally {
  console.warn = originalWarn;
  console.error = originalError;
}

assert.equal(lines.length, 2);
for (const line of lines) {
  for (const forbiddenValue of forbiddenValues) {
    assert.ok(!line.includes(forbiddenValue), `log leaked ${forbiddenValue}`);
  }
  assert.match(line, /\[REDACTED\]/);
}

assert.equal(APPLICATION_LOG_PROHIBITION_REQUIREMENT_IDS.length, 14);
for (const requirementId of APPLICATION_LOG_PROHIBITION_REQUIREMENT_IDS) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) =>
      candidate.prompt === "security" && candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    APPLICATION_LOG_PROHIBITION_MASTER_EVIDENCE[requirementId],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
}

console.log(
  "application log prohibition passed: all 14 credential, payment and content requirements redacted",
);
