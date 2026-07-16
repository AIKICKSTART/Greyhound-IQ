import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  PRODUCT_COMMUNITY_DROPPED_CALL_RECOVERY_EVIDENCE_FILE,
  PRODUCT_COMMUNITY_DROPPED_CALL_RECOVERY_EXPECTED_GAIN,
  PRODUCT_COMMUNITY_DROPPED_CALL_RECOVERY_MASTER_EVIDENCE,
  PRODUCT_COMMUNITY_DROPPED_CALL_RECOVERY_REQUIREMENT_IDS,
  PRODUCT_COMMUNITY_DROPPED_CALL_RECOVERY_SCOPE,
  PRODUCT_COMMUNITY_DROPPED_CALL_RECOVERY_TEST_FILE,
} from "./product-community-dropped-call-recovery-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-COMMUNITY-DROPPED-CALL-RECOVERY

const REQUIREMENT_ID = "ROUTE.COMMUNITY.connection-dropped" as const;

assert.deepEqual(
  PRODUCT_COMMUNITY_DROPPED_CALL_RECOVERY_REQUIREMENT_IDS,
  [REQUIREMENT_ID],
);
assert.equal(PRODUCT_COMMUNITY_DROPPED_CALL_RECOVERY_EXPECTED_GAIN, 1);
assert.deepEqual(
  Object.keys(PRODUCT_COMMUNITY_DROPPED_CALL_RECOVERY_MASTER_EVIDENCE),
  [REQUIREMENT_ID],
);

const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  (candidate) => candidate.id === REQUIREMENT_ID,
);
assert.ok(requirement);
assert.equal(requirement.requirement, "Handle a dropped call connection.");

const evidence =
  PRODUCT_COMMUNITY_DROPPED_CALL_RECOVERY_MASTER_EVIDENCE[REQUIREMENT_ID];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_COMMUNITY_DROPPED_CALL_RECOVERY_EVIDENCE_FILE,
  PRODUCT_COMMUNITY_DROPPED_CALL_RECOVERY_TEST_FILE,
]);
assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
evidence.evidence.forEach((path) => assert.equal(existsSync(path), true, path));

for (const scopeAssertion of [
  /source and unit/i,
  /unexpected LiveKit terminal disconnect/i,
  /explicit error state/i,
  /retains a bounded rejoin target/i,
  /Try again and Dismiss/i,
  /does not misclassify the local Leave control/i,
  /does not prove browser media behavior/i,
  /deployed realtime delivery/i,
  /successful rejoin under an upstream outage/i,
]) {
  assert.match(PRODUCT_COMMUNITY_DROPPED_CALL_RECOVERY_SCOPE, scopeAssertion);
}

const panelPath = "src/components/conversation-call-panel.tsx";
const panelSource = source(panelPath);
const disconnectHandler = between(
  panelSource,
  "nextRoom.on(RoomEvent.Disconnected",
  "nextRoom.on(RoomEvent.Reconnecting",
);
for (const assertion of [
  "if (roomRef.current !== nextRoom) return",
  "const retry = retryRef.current",
  "resetCallState()",
  'setStatus("error")',
  "The call connection dropped. Check your connection and try again.",
]) {
  assert.ok(disconnectHandler.includes(assertion), assertion);
}

const retryHandler = between(panelSource, "function tryAgain()", "async function acceptInvite");
assert.match(retryHandler, /setLocalRoom\(\{ id: retry\.roomId, callType: retry\.callType \}\)/);
assert.match(retryHandler, /connectToRoom\(retry\.roomId, retry\.callType\)/);

for (const assertion of [
  "Try again",
  "Dismiss",
  'if (status === "error") setStatus("idle")',
  "retryRef.current = null",
]) {
  assert.ok(panelSource.includes(assertion), `${panelPath}: ${assertion}`);
}

const cleanupHandler = between(
  panelSource,
  "useEffect(() => {\n    return () => {",
  "  }, []);",
);
assert.ok(
  cleanupHandler.indexOf("roomRef.current = null") <
    cleanupHandler.indexOf("activeConnection?.disconnect()"),
  "cleanup must clear the active-room marker before intentional disconnect",
);

const leaveHandler = between(
  panelSource,
  "async function leave()",
  "function deviceSelectValue",
);
assert.ok(
  leaveHandler.indexOf("roomRef.current = null") <
    leaveHandler.indexOf("activeConnection?.disconnect()"),
  "Leave must clear the active-room marker before intentional disconnect",
);
assert.match(leaveHandler, /await endRoom\(target\.id\)/);
assert.match(leaveHandler, /could not confirm that it ended/);

const endRoomHelper = between(
  panelSource,
  "async function endRoom",
  "function bindRemoteTracks",
);
assert.match(endRoomHelper, /if \(!response\.ok\)/);
assert.match(endRoomHelper, /throw new Error/);

const evidenceSource = source(
  PRODUCT_COMMUNITY_DROPPED_CALL_RECOVERY_EVIDENCE_FILE,
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Dropped-call recovery evidence passed in isolation: unexpected terminal disconnects now preserve a rejoin target and expose error, retry and dismiss states for exact +1 central wiring; live network proof remains open.",
);

function source(path: string) {
  return readFileSync(path, "utf8");
}

function between(contents: string, start: string, end: string) {
  const startIndex = contents.indexOf(start);
  const endIndex = contents.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing source section start: ${start}`);
  assert.notEqual(endIndex, -1, `missing source section end: ${end}`);
  return contents.slice(startIndex, endIndex);
}
