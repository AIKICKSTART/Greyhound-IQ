import assert from "node:assert/strict";
import {
  AUTH_CALLBACK_RECOVERY_COPY,
  classifyAuthCallbackFailure,
  parseAuthCallbackFailureReason,
  parseAuthCallbackReference,
} from "./auth-callback-recovery";

assert.equal(classifyAuthCallbackFailure("access_denied"), "cancelled");
assert.equal(classifyAuthCallbackFailure("invalid_grant"), "expired");
assert.equal(classifyAuthCallbackFailure("interaction_required"), "expired");
assert.equal(classifyAuthCallbackFailure("login_required"), "expired");
assert.equal(classifyAuthCallbackFailure("server_error"), "provider");
assert.equal(
  classifyAuthCallbackFailure("temporarily_unavailable"),
  "provider"
);
assert.equal(classifyAuthCallbackFailure("unexpected"), "failed");
assert.equal(classifyAuthCallbackFailure(null), "failed");
for (const reason of ["cancelled", "expired", "provider", "failed"] as const) {
  assert.equal(parseAuthCallbackFailureReason(reason), reason);
  assert.ok(AUTH_CALLBACK_RECOVERY_COPY[reason].title.length > 0);
  assert.ok(AUTH_CALLBACK_RECOVERY_COPY[reason].description.length > 0);
}
assert.equal(parseAuthCallbackFailureReason("raw-provider-error"), "failed");
assert.equal(parseAuthCallbackFailureReason(["expired", "failed"]), "expired");
assert.equal(
  parseAuthCallbackReference("2e831fa8-988f-4ed8-a83a-165e2ecd258d"),
  "2e831fa8-988f-4ed8-a83a-165e2ecd258d"
);
assert.equal(parseAuthCallbackReference("not-a-reference"), undefined);

console.log("auth callback recovery classification tests passed");
