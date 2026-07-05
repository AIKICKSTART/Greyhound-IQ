import assert from "node:assert/strict";
import { callMediaErrorMessage } from "./call-client-errors";

function namedError(name: string, message = "test"): Error {
  const err = new Error(message);
  err.name = name;
  return err;
}

// PermissionDenied path (NotAllowedError)
const permMsg = callMediaErrorMessage(namedError("NotAllowedError"), "microphone");
assert.ok(permMsg.toLowerCase().includes("allow"), `expected permission message, got: ${permMsg}`);
assert.ok(permMsg.includes("microphone"));

// PermissionDenied path (PermissionDeniedError)
const permMsg2 = callMediaErrorMessage(namedError("PermissionDeniedError"), "camera");
assert.ok(permMsg2.toLowerCase().includes("allow"));
assert.ok(permMsg2.includes("camera"));

// NotFound path (NotFoundError)
const notFoundMsg = callMediaErrorMessage(namedError("NotFoundError"), "microphone");
assert.ok(notFoundMsg.toLowerCase().includes("no microphone") || notFoundMsg.toLowerCase().includes("not found") || notFoundMsg.toLowerCase().includes("no"), `expected not-found message, got: ${notFoundMsg}`);
assert.ok(notFoundMsg.includes("microphone"));

// DeviceInUse path (NotReadableError)
const inUseMsg = callMediaErrorMessage(namedError("NotReadableError"), "camera");
assert.ok(inUseMsg.toLowerCase().includes("use") || inUseMsg.toLowerCase().includes("in use"), `expected in-use message, got: ${inUseMsg}`);
assert.ok(inUseMsg.includes("camera"));

// DeviceInUse path (TrackStartError)
const inUseMsg2 = callMediaErrorMessage(namedError("TrackStartError"), "screen");
assert.ok(inUseMsg2.includes("screen"));

// Fallback: unknown error name → err.message used
const fallback = callMediaErrorMessage(namedError("UnknownError", "custom message here"), "microphone");
assert.equal(fallback, "custom message here");

// Fallback: null error → generic "Could not access" message
const genericFallback = callMediaErrorMessage(null, "camera");
assert.ok(genericFallback.includes("camera"));

console.log("call-client-errors tests passed");
