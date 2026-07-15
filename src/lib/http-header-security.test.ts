import assert from "node:assert/strict";

import {
  MAX_HTTP_HEADER_VALUE_LENGTH,
  isSafeHttpHeaderName,
  isSafeHttpHeaderValue,
  setSafeHttpHeader,
} from "./http-header-security";

assert.equal(isSafeHttpHeaderName("content-range"), true);
assert.equal(isSafeHttpHeaderName("x-greyhoundiq-request-id"), true);
assert.equal(isSafeHttpHeaderName("x injected"), false);
assert.equal(isSafeHttpHeaderName("x-injected\r\nname"), false);

for (const value of [
  "safe-value",
  "bytes 0-99/100",
  "application/vnd.apple.mpegurl",
]) {
  assert.equal(isSafeHttpHeaderValue(value), true);
}
for (const value of [
  "safe\r\nset-cookie: attacker=1",
  "safe\nlocation: https://attacker.example",
  "safe\u0000truncated",
  "safe\tcontinued",
  "emoji-💥",
  "x".repeat(MAX_HTTP_HEADER_VALUE_LENGTH + 1),
]) {
  assert.equal(isSafeHttpHeaderValue(value), false);
}

const headers = new Headers();
assert.equal(setSafeHttpHeader(headers, "content-range", "bytes 0-99/100"), true);
assert.equal(headers.get("content-range"), "bytes 0-99/100");
assert.equal(
  setSafeHttpHeader(headers, "content-range", "bytes 0-99/100\r\nx: injected"),
  false,
);
assert.equal(headers.get("x"), null);

assert.throws(
  () => new Headers({ "x-test": "safe\r\nx-injected: yes" }),
  TypeError,
);

console.log("HTTP header security passed: names and values reject controls, CRLF, oversized input and non-ByteString characters.");
