import assert from "node:assert/strict";

import { buildDogWinNotification } from "./dog-win-message";

const withTrack = buildDogWinNotification("Zipping Bella", "Wentworth Park", "/account/pages/abc");
assert.equal(withTrack.title, "🏆 Zipping Bella won!", "title names the dog");
assert.ok(withTrack.body.includes("at Wentworth Park"), "body includes track when known");
assert.ok(withTrack.body.includes("winner card"), "body prompts card generation");
assert.equal(withTrack.href, "/account/pages/abc", "href passed through");

const noTrack = buildDogWinNotification("Swift Missile", null, "/account/pages?dogId=d1");
assert.ok(!noTrack.body.includes(" at "), "no dangling track phrase when track unknown");
assert.ok(noTrack.body.startsWith("Swift Missile finished 1st"), "body reads cleanly without track");

console.log("dog-win-message: ok");
