import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  LIVE_DATA_RESPONSE_VALIDATION_EVIDENCE,
  LIVE_DATA_RESPONSE_VALIDATION_GLOBAL_GAP,
  LIVE_DATA_RESPONSE_VALIDATION_PROVIDERS,
  LIVE_DATA_RESPONSE_VALIDATION_REQUIREMENT_IDS,
  LIVE_DATA_RESPONSE_SIGNATURE_DISPOSITION,
  LIVE_DATA_RESPONSE_VALIDATION_SCOPE_STATUS,
} from "./live-data-response-validation-evidence";

const immutableIds = new Set(SECURITY_MASTER_REQUIREMENTS.map(({ id }) => id));
assert.equal(LIVE_DATA_RESPONSE_VALIDATION_REQUIREMENT_IDS.length, 14);
for (const requirementId of LIVE_DATA_RESPONSE_VALIDATION_REQUIREMENT_IDS) {
  assert.ok(immutableIds.has(requirementId), `${requirementId}: immutable gate missing`);
}
assert.equal(LIVE_DATA_RESPONSE_VALIDATION_PROVIDERS.length, 3);
assert.equal(
  LIVE_DATA_RESPONSE_VALIDATION_SCOPE_STATUS,
  "source-verified-for-three-target-adapters",
);
assert.match(LIVE_DATA_RESPONSE_SIGNATURE_DISPOSITION, /Not applicable/);
assert.match(LIVE_DATA_RESPONSE_SIGNATURE_DISPOSITION, /not signature evidence/);
assert.match(LIVE_DATA_RESPONSE_VALIDATION_GLOBAL_GAP, /remain global gates/);
assert.match(LIVE_DATA_RESPONSE_VALIDATION_GLOBAL_GAP, /Topaz is owned by the lead/);
assert.match(LIVE_DATA_RESPONSE_VALIDATION_GLOBAL_GAP, /profile\/replay/);
assert.match(LIVE_DATA_RESPONSE_VALIDATION_GLOBAL_GAP, /non-racing provider/);

for (const path of LIVE_DATA_RESPONSE_VALIDATION_EVIDENCE) {
  assert.ok(existsSync(path), `missing evidence: ${path}`);
}

const remoteResponse = read("src/lib/remote-response.ts");
assert.match(remoteResponse, /content-type/);
assert.match(remoteResponse, /content-length/);
assert.match(remoteResponse, /size > policy\.maxBytes/);
assert.match(remoteResponse, /reader\.cancel\(\)/);

for (const path of [
  "src/lib/live/thedogs.ts",
  "src/lib/live/fasttrack.ts",
  "src/lib/live/watchdog.ts",
]) {
  const source = read(path);
  assert.match(source, /readBoundedTextResponse\(/, `${path}: unbounded response`);
  assert.match(source, /AbortSignal\.timeout\(/, `${path}: request deadline absent`);
  assert.match(source, /redirect:\s*"error"/, `${path}: redirects are followed`);
  assert.doesNotMatch(source, /response\.(?:json|text)\(\)/);
  assert.doesNotMatch(source, /response\.statusText/);
}

const theDogs = read("src/lib/live/thedogs.ts");
assert.match(theDogs, /THEDOGS_HTML_POLICY/);
assert.match(theDogs, /normalizeTheDogsUrl/);
assert.match(theDogs, /candidate\.origin === base\.origin/);
assert.match(theDogs, /links\.has\(href\)/);
assert.match(theDogs, /isValidDateKey/);
assert.match(theDogs, /parsed <= 100_000_000/);

const fastTrack = read("src/lib/live/fasttrack.ts");
assert.match(fastTrack, /FASTTRACK_HTML_POLICY/);
assert.match(fastTrack, /meeting\.races\.length > 0/);
assert.match(fastTrack, /links\.has\(id\)/);
assert.match(fastTrack, /isValidDateParts/);
assert.match(fastTrack, /parsed <= 100_000_000/);

const watchdog = read("src/lib/live/watchdog.ts");
assert.match(watchdog, /WATCHDOG_JSON_POLICY/);
assert.match(watchdog, /JSON\.parse\(body\)/);
assert.match(watchdog, /parseWatchdogPayload\(payload\)/);

const watchdogSchema = read("src/lib/live/watchdog-response.ts");
for (const marker of [
  "identifierSchema",
  "timestampSchema",
  "watchdogUrlSchema",
  "watchdogMeetingSchema",
  "watchdogRaceSchema",
  "watchdogParticipantSchema",
  "uniqueRecords",
  "duplicate provider record",
  "recognized Watchdog collection required",
  "watchdog.response_invalid",
]) {
  assert.match(watchdogSchema, new RegExp(escapeRegExp(marker)));
}

console.log(
  "Live-data response validation passed for TheDogs meeting/results, FastTrack prototype and Watchdog; global third-party gates remain explicitly open",
);

function read(path: string) {
  return readFileSync(path, "utf8");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
