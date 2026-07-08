import assert from "node:assert/strict";
import { sanitizeWorkosClientId } from "./workos-env";

assert.equal(
  sanitizeWorkosClientId(`\uFEFFclient_123 \n`),
  "client_123"
);

console.log("workos env tests passed");
