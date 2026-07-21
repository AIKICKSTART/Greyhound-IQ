import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  createLiveFeedQuarantineOccurrence,
  LIVE_FEED_QUARANTINE_MAX_EVIDENCE_BYTES,
} from "./quarantine";

const circular: Record<string, unknown> = { dogName: "Fast Hound" };
circular.self = circular;

const input = {
  observedAt: new Date("2026-07-18T06:00:00.000Z"),
  provider: " Watchdog ",
  entityKind: "runner",
  sourceId: " dog-7 ",
  naturalIdentity: " Fast Hound|2022-01-01 ",
  reasonCode: "duplicate_runner_identity",
  classification: "conflict" as const,
  evidence: {
    circular,
    resultTime: 29.8,
    startingPrice: 2.4,
    token: "must-not-survive",
    message: "authorization=must-not-survive Bearer live-secret",
    sourceRawJson: "must-not-survive",
  },
};

const occurrence = createLiveFeedQuarantineOccurrence(input, {
  id: "11111111-1111-4111-8111-111111111111",
});
const evidence = JSON.parse(occurrence.evidenceJson) as Record<string, unknown>;

assert.equal(occurrence.provider, "watchdog");
assert.equal(occurrence.sourceId, "dog-7");
assert.equal(occurrence.naturalIdentity, "Fast Hound|2022-01-01");
assert.equal(evidence.startingPrice, undefined);
assert.equal(evidence.token, "[REDACTED]");
assert.equal(evidence.sourceRawJson, "[REDACTED]");
assert.doesNotMatch(occurrence.evidenceJson, /must-not-survive|live-secret/);
assert.match(occurrence.evidenceJson, /\[CIRCULAR\]/);
assert.equal(
  occurrence.evidenceSha256,
  createHash("sha256").update(occurrence.evidenceJson).digest("hex"),
);

const repeat = createLiveFeedQuarantineOccurrence(input, {
  id: "22222222-2222-4222-8222-222222222222",
});
assert.notEqual(repeat.id, occurrence.id);
assert.equal(repeat.evidenceSha256, occurrence.evidenceSha256);

const large = createLiveFeedQuarantineOccurrence(
  {
    ...input,
    evidence: Object.fromEntries(
      Array.from({ length: 500 }, (_, index) => [
        `field${index}`,
        "🐕".repeat(1_000),
      ]),
    ),
  },
  { id: "33333333-3333-4333-8333-333333333333" },
);
assert(
  Buffer.byteLength(large.evidenceJson) <=
    LIVE_FEED_QUARANTINE_MAX_EVIDENCE_BYTES,
);
assert.match(large.evidenceJson, /_quarantineTruncated|\[TRUNCATED\]/);

assert.throws(
  () =>
    createLiveFeedQuarantineOccurrence(
      { ...input, classification: "accepted" as "conflict" },
      { id: "44444444-4444-4444-8444-444444444444" },
    ),
  /invalid_classification/,
);
assert.throws(
  () =>
    createLiveFeedQuarantineOccurrence(
      { ...input, evidence: [] as unknown as Record<string, unknown> },
      { id: "55555555-5555-4555-8555-555555555555" },
    ),
  /invalid_evidence/,
);

console.log("live feed quarantine reducer tests passed");
