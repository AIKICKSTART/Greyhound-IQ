import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  ONBOARDING_ANALYTICS_LEGACY_STEP_IDS,
  ONBOARDING_ANALYTICS_LEGACY_TOUR_ID,
  ONBOARDING_ANALYTICS_SCHEMA_VERSION,
  parseOnboardingAnalyticsEvent,
} from "../src/components/onboarding-analytics";
import {
  SECRET_CONTROL_MASTER_EVIDENCE,
  VERIFIED_SECRET_CONTROL_IDS,
} from "./secret-control-evidence";

assert.equal(VERIFIED_SECRET_CONTROL_IDS.length, 9);
for (const requirementId of VERIFIED_SECRET_CONTROL_IDS) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    SECRET_CONTROL_MASTER_EVIDENCE[requirementId],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
}

const analyticsBase = {
  schemaVersion: ONBOARDING_ANALYTICS_SCHEMA_VERSION,
  event: "step-viewed",
  tourId: ONBOARDING_ANALYTICS_LEGACY_TOUR_ID,
  stepId: ONBOARDING_ANALYTICS_LEGACY_STEP_IDS[0],
} as const;
for (const secretField of [
  "secret",
  "token",
  "authorization",
  "cookie",
  "password",
  "apiKey",
  "databaseUrl",
]) {
  assert.equal(
    parseOnboardingAnalyticsEvent({
      ...analyticsBase,
      [secretField]: "must-not-be-accepted",
    }),
    null,
    `analytics must reject ${secretField}`,
  );
}

const logger = readFileSync("src/lib/logger.ts", "utf8");
const loggerTest = readFileSync("src/lib/logger.test.ts", "utf8");
assert.match(logger, /function sanitizeValue\(/);
assert.match(logger, /function safeErrorText\(/);
assert.match(logger, /Bearer\\s\+/);
assert.match(logger, /\\beyJ/);
assert.match(loggerTest, /postgresql:\/\/dbuser:url-secret/);

const replayCapability = readFileSync("src/lib/live/replay-proxy.ts", "utf8");
const realtime = readFileSync("src/lib/realtime-service.ts", "utf8");
const internalAuth = readFileSync("src/lib/internal-auth.ts", "utf8");
assert.match(replayCapability, /createCipheriv\("aes-256-gcm"/);
assert.match(replayCapability, /randomBytes\(REPLAY_CAPABILITY_IV_BYTES\)/);
assert.match(replayCapability, /hkdfSync\(\s*"sha256"/);
assert.match(realtime, /createHmac\("sha256"/);
assert.match(internalAuth, /timingSafeEqual/);

assert.equal(
  SECURITY_MASTER_EVIDENCE["security.secret-control.environment-separation"],
  undefined,
);
assert.equal(
  SECURITY_MASTER_EVIDENCE["security.secret-control.safe-rotation"],
  undefined,
);
assert.equal(
  SECURITY_MASTER_EVIDENCE["security.secret-control.revocable"],
  undefined,
);
console.log(
  "Secret controls passed: nine source-enforced boundaries; environment separation, rotation and revocation remain open.",
);
