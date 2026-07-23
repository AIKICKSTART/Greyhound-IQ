import assert from "node:assert/strict";
import { canonicalTrackName } from "./track-name";

assert.equal(canonicalTrackName("Sandown Park"), "Sandown");
assert.equal(canonicalTrackName("Sandown (SAP)"), "Sandown");
assert.equal(canonicalTrackName("Meadows (MEP)"), "The Meadows");
assert.equal(canonicalTrackName("  meadows  "), "The Meadows");
assert.equal(canonicalTrackName("Warragul"), "Warragul");

console.log("track name aliases: ok");
