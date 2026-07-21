import assert from "node:assert/strict";
import { parseWatchdogPayload } from "./watchdog-response";

assert.throws(
  () =>
    parseWatchdogPayload({
      meetings: [{ id: 1, meetingDate: "not-a-date" }],
    }),
  /watchdog\.response_invalid:meetings\.0\.meetingDate:custom/,
);

for (const resultPlace of ["F", "P", "T"] as const) {
  assert.doesNotThrow(() =>
    parseWatchdogPayload({
      participants: [
        { raceId: 1, dogId: 1, dogName: "Verified Dog", resultPlace },
      ],
    }),
  );
}

console.log("watchdog response diagnostics: ok");
