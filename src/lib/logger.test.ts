import assert from "node:assert/strict";
import { logError, logWarn } from "./logger";

const captured: string[] = [];
const origError = console.error;
const origWarn = console.warn;
console.error = (line: string) => captured.push(line);
console.warn = (line: string) => captured.push(line);

try {
  // logError → one-line JSON with severity ERROR and context fields spread
  logError("test.event", { userId: "u1", count: 2 });
  const errorLine = captured[captured.length - 1];
  assert.ok(!errorLine.includes("\n"), "JSON line must be single-line");
  const e = JSON.parse(errorLine);
  assert.equal(e.severity, "ERROR");
  assert.equal(e.event, "test.event");
  assert.equal(e.userId, "u1");
  assert.equal(e.count, 2);

  // logWarn → severity WARNING
  logWarn("test.warn", { flag: true });
  const warnObj = JSON.parse(captured[captured.length - 1]);
  assert.equal(warnObj.severity, "WARNING");
  assert.equal(warnObj.event, "test.warn");
  assert.equal(warnObj.flag, true);

  // Error passed → stack embedded in message
  const err = new Error("boom");
  logError("test.stack", {}, err);
  const stackObj = JSON.parse(captured[captured.length - 1]);
  assert.ok(stackObj.message.includes("test.stack"), "message must include event");
  assert.ok(stackObj.message.includes("boom"), "message must include error text");
  // err.stack includes newline between "Error: …" and frames
  assert.ok(stackObj.message.includes("\n"), "stack must embed newline in message value");

  // Non-Error err → coerced to string detail in message
  logError("test.str_err", {}, "plain-string-error");
  const strObj = JSON.parse(captured[captured.length - 1]);
  assert.ok(strObj.message.includes("plain-string-error"));
} finally {
  console.error = origError;
  console.warn = origWarn;
}

console.log("logger tests passed");
